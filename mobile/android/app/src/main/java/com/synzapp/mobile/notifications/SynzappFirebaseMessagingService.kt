package com.synzapp.mobile.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.util.Base64
import android.util.Log
import androidx.core.content.ContextCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.content.LocusIdCompat
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.RemoteMessage
import expo.modules.notifications.notifications.RemoteMessageSerializer
import expo.modules.notifications.service.ExpoFirebaseMessagingService
import expo.modules.notifications.service.delegates.FirebaseMessagingDelegate
import org.bouncycastle.math.ec.rfc7748.X25519
import org.json.JSONObject
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import java.security.MessageDigest
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

class SynzappFirebaseMessagingService : ExpoFirebaseMessagingService() {
  override fun onMessageReceived(remoteMessage: RemoteMessage) {
    if (handleSynzappCallEnded(remoteMessage)) {
      return
    }

    if (handleSynzappIncomingCall(remoteMessage)) {
      return
    }

    if (handleSynzappEncryptedPreview(remoteMessage)) {
      return
    }

    if (handleSynzappActionNotification(remoteMessage)) {
      return
    }

    super.onMessageReceived(remoteMessage)
  }

  private fun handleSynzappCallEnded(remoteMessage: RemoteMessage): Boolean {
    val data = remoteMessage.data

    if (data["type"] != "call.ended") {
      return false
    }

    val callId = data["callId"] ?: remoteMessage.messageId ?: return true
    val notificationManager = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    notificationManager.cancel(callId.hashCode())

    return true
  }

  private fun handleSynzappIncomingCall(remoteMessage: RemoteMessage): Boolean {
    val data = remoteMessage.data

    if (data["type"] != "call.incoming") {
      return false
    }

    showIncomingCallNotification(remoteMessage)

    return true
  }

  /**
   * An action notification, drawn with the face of whoever caused it.
   *
   * A separate entry test from the chat one above, deliberately. The chat path
   * is finished and correct, and the cheapest way to break it would be to widen
   * its condition to let something else through — so this asks its own
   * question and shares only the parts that already worked.
   *
   * Returns false on anything unexpected, which hands the message back to
   * Expo's own handler. The server sends the title and body in the data for
   * exactly that reason: a fault in here costs the photo, never the
   * notification.
   */
  private fun handleSynzappActionNotification(remoteMessage: RemoteMessage): Boolean {
    val data = remoteMessage.data
    val type = data["type"] ?: return false

    if (!type.startsWith("ACTION_")) {
      return false
    }

    val title = data["title"]?.takeIf { it.isNotBlank() } ?: return false
    val body = data["message"]?.takeIf { it.isNotBlank() }
      ?: data["body"]?.takeIf { it.isNotBlank() }
      ?: return false

    return try {
      showActionNotification(remoteMessage, title, body)
      true
    } catch (error: Throwable) {
      Log.w(TAG, "Falling back to the plain action notification", error)
      false
    }
  }

  private fun showActionNotification(remoteMessage: RemoteMessage, title: String, body: String) {
    val context = applicationContext
    val data = remoteMessage.data
    val notificationManager = context.getSystemService(NotificationManager::class.java)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      if (notificationManager.getNotificationChannel(ACTIONS_CHANNEL_ID) == null) {
        // Its own channel so somebody can turn these down without turning down
        // chat — and without muting the app that also carries the overdue
        // escalation, which is the one thing this must never lose.
        val channel = NotificationChannel(
          ACTIONS_CHANNEL_ID,
          "Actions",
          NotificationManager.IMPORTANCE_DEFAULT
        )

        channel.description = "Work assigned to you, and reminders about it"
        notificationManager.createNotificationChannel(channel)
      }
    }

    val builder = NotificationCompat.Builder(context, ACTIONS_CHANNEL_ID)
      .setSmallIcon(getNotificationSmallIcon(context))
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .setContentIntent(buildActionLaunchIntent(context, remoteMessage))

    // The face of whoever did it. A plain large icon rather than the
    // conversation styling chat uses: an action is not a conversation, and
    // dressing it as one would file work alerts under the shade's conversation
    // section, where they do not belong.
    loadSenderAvatarLargeIcon(context, data)?.let { builder.setLargeIcon(it) }

    val tag = data["actionId"]?.takeIf { it.isNotBlank() } ?: remoteMessage.messageId
    // Keyed on the action, so a second notification about the same action
    // replaces the first instead of stacking beside it.
    notificationManager.notify(tag, ACTIONS_NOTIFICATION_ID, builder.build())
  }

  /**
   * Opens the app when the notification is tapped.
   *
   * Carries the action's id, so the app can take somebody to the thing they
   * were told about rather than to wherever they left off.
   */
  private fun buildActionLaunchIntent(context: Context, remoteMessage: RemoteMessage): PendingIntent? {
    val launchIntent = context.packageManager
      .getLaunchIntentForPackage(context.packageName)
      ?.apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        putExtra("type", remoteMessage.data["type"])
        putExtra("actionId", remoteMessage.data["actionId"])
      }
      ?: return null

    return PendingIntent.getActivity(
      context,
      (remoteMessage.data["actionId"] ?: remoteMessage.messageId ?: "action").hashCode(),
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun handleSynzappEncryptedPreview(remoteMessage: RemoteMessage): Boolean {
    val data = remoteMessage.data

    if (data["type"] != "chat.message") {
      return false
    }

    val previewText = decryptPreview(data)
    val body = previewText
      ?: data["notificationFallbackBody"]?.takeIf { it.isNotBlank() }
      ?: "New message"

    if (previewText == null && hasPreviewFields(data)) {
      Log.w(TAG, "Showing fallback Synzapp notification because encrypted preview could not be decrypted")
    }

    showNotification(remoteMessage, body)

    // This notification is drawn here rather than by the library, so the
    // library's own hook never runs — and that hook is what wakes the
    // JavaScript task that tells the server this phone has the message. Without
    // this line a message to a shut phone stays on one tick for ever, however
    // well the push worked.
    runBackgroundNotificationTasks(remoteMessage)

    return true
  }

  private fun runBackgroundNotificationTasks(remoteMessage: RemoteMessage) {
    try {
      FirebaseMessagingDelegate.runTaskManagerTasks(
        applicationContext,
        RemoteMessageSerializer.toBundle(remoteMessage)
      )
    } catch (error: Exception) {
      // Best effort. The receipt is made again when the app is next opened, so
      // the worst this costs is a tick that arrives late.
      Log.w(TAG, "Unable to run background notification tasks", error)
    }
  }

  private fun decryptPreview(data: Map<String, String>): String? {
    if (
      data["notificationPreviewAlgorithm"] != NOTIFICATION_PREVIEW_ALGORITHM ||
      data["notificationPreviewVersion"] != "1"
    ) {
      return null
    }

    // Every identity this phone holds is tried, and the right one proves
    // itself by opening the message. A preview is sealed for one device, and
    // AES-GCM refuses a wrong key rather than returning rubbish, so there is
    // nothing to choose between them and no need to guess which account a push
    // belongs to.
    for (identity in readStoredDeviceIdentities()) {
      val text = decryptPreviewWithIdentity(data, identity)

      if (text != null) {
        return text
      }
    }

    return null
  }

  private fun decryptPreviewWithIdentity(data: Map<String, String>, identity: JSONObject): String? {
    return try {
      val privateKey = decodeBase64(identity.getString("keyAgreementPrivateKey"))
      val recipientPublicKey = decodeBase64(identity.getString("keyAgreementPublicKey"))
      val senderPublicKey = decodeBase64(data["notificationPreviewSenderKeyAgreementPublicKey"] ?: return null)
      val ciphertext = decodeBase64(data["notificationPreviewCiphertext"] ?: return null)
      val nonce = decodeBase64(data["notificationPreviewNonce"] ?: return null)
      val sharedSecret = ByteArray(X25519.POINT_SIZE)

      X25519.scalarMult(privateKey, 0, senderPublicKey, 0, sharedSecret, 0)

      val keyMaterial = DERIVATION_LABEL.toByteArray(StandardCharsets.UTF_8) +
        sharedSecret +
        senderPublicKey +
        recipientPublicKey
      val aesKey = MessageDigest.getInstance("SHA-256").digest(keyMaterial)
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")

      cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(aesKey, "AES"), GCMParameterSpec(128, nonce))

      val plaintext = cipher.doFinal(ciphertext)
      val payload = JSONObject(String(plaintext, StandardCharsets.UTF_8))
      val text = payload.optString("text").trim()

      if (payload.optInt("version") == 1 && text.isNotEmpty()) text else null
    } catch (error: Exception) {
      Log.w(TAG, "Unable to decrypt Synzapp notification preview", error)
      null
    }
  }

  /**
   * Every device identity stored on this phone.
   *
   * This used to read one fixed name and find nothing, which is why chat
   * notifications had stopped revealing their message: the app now keeps an
   * identity **per signed-in account**, under
   * `synzapp.deviceIdentity.v1.user.<uid>`, and this was still looking for the
   * single global name it used before. It failed quietly — no key, no
   * exception, just the fallback wording every time.
   *
   * The old name is still tried first, for phones carrying an identity written
   * by an earlier build.
   */
  private fun readStoredDeviceIdentities(): List<JSONObject> {
    val context = applicationContext
    val identities = mutableListOf<JSONObject>()
    val seen = mutableSetOf<String>()

    fun add(stored: String?) {
      val value = stored ?: return

      if (seen.add(value)) {
        try {
          identities += JSONObject(value)
        } catch (error: Exception) {
          Log.w(TAG, "Ignoring an unreadable stored device identity", error)
        }
      }
    }

    add(readSecureStoreString(context, SECURE_STORE_KEY, SECURE_STORE_SERVICE))

    try {
      val preferences = context.getSharedPreferences(SECURE_STORE_PREFERENCES, Context.MODE_PRIVATE)

      for (preferenceKey in preferences.all.keys) {
        if (!preferenceKey.contains(DEVICE_IDENTITY_USER_KEY_MARKER)) {
          continue
        }

        add(decryptSecureStoreValue(preferences.getString(preferenceKey, null), SECURE_STORE_SERVICE))
      }
    } catch (error: Exception) {
      Log.w(TAG, "Unable to list stored device identities", error)
    }

    return identities
  }

  private fun showIncomingCallNotification(remoteMessage: RemoteMessage) {
    val context = applicationContext
    val data = remoteMessage.data
    val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) {
      Log.w(TAG, "Synzapp call invite was received but Android notifications are disabled for this app")
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
      val audioAttributes = AudioAttributes.Builder()
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
        .build()
      val existingChannel = notificationManager.getNotificationChannel(CALLS_CHANNEL_ID)

      if (existingChannel == null) {
        val channel = NotificationChannel(CALLS_CHANNEL_ID, "Synzapp calls", NotificationManager.IMPORTANCE_MAX)
        channel.enableVibration(true)
        channel.lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
        channel.setSound(ringtoneUri, audioAttributes)
        channel.setShowBadge(true)
        notificationManager.createNotificationChannel(channel)
      }
    }

    val callId = data["callId"] ?: remoteMessage.messageId ?: "synzapp-call"
    val notificationId = callId.hashCode()
    val mode = data["mode"] ?: "voice"
    val callerName = data["callerName"]?.takeIf { it.isNotBlank() }
      ?: data["title"]?.takeIf { it.isNotBlank() }
      ?: "Synzapp"
    val body = if (mode == "video") "Incoming video call" else "Incoming voice call"
    val callUri = Uri.Builder()
      .scheme("synzapp")
      .authority("call")
      .appendPath("incoming")
      .appendQueryParameter("type", data["type"])
      .appendQueryParameter("callId", data["callId"])
      .appendQueryParameter("callerName", data["callerName"])
      .appendQueryParameter("callerUid", data["callerUid"])
      .appendQueryParameter("chatType", data["chatType"])
      .appendQueryParameter("contactId", data["contactId"])
      .appendQueryParameter("createdAt", data["createdAt"])
      .appendQueryParameter("mode", data["mode"])
      .appendQueryParameter("participantUids", data["participantUids"])
      .appendQueryParameter("tenantId", data["tenantId"])
      .appendQueryParameter("title", data["title"])
      .build()
    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
      this.data = callUri
      putExtra("type", data["type"])
      putExtra("callId", data["callId"])
      putExtra("callerName", data["callerName"])
      putExtra("callerUid", data["callerUid"])
      putExtra("chatType", data["chatType"])
      putExtra("contactId", data["contactId"])
      putExtra("createdAt", data["createdAt"])
      putExtra("mode", data["mode"])
      putExtra("participantUids", data["participantUids"])
      putExtra("tenantId", data["tenantId"])
      putExtra("title", data["title"])
    }
    val pendingIntent = launchIntent?.let {
      PendingIntent.getActivity(
        context,
        notificationId,
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    }
    val notificationBuilder = NotificationCompat.Builder(context, CALLS_CHANNEL_ID)
      .setAutoCancel(false)
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setContentText(body)
      .setContentTitle(callerName)
      .setDefaults(NotificationCompat.DEFAULT_ALL)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setSmallIcon(getNotificationSmallIcon(context))
      .setTimeoutAfter(CALL_RING_TIMEOUT_MS)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)

    if (pendingIntent != null) {
      notificationBuilder
        .setContentIntent(pendingIntent)
        .setFullScreenIntent(pendingIntent, true)
    }

    loadLargeIcon(context)?.let { notificationBuilder.setLargeIcon(it) }
    notificationManager.notify(notificationId, notificationBuilder.build())
  }

  private fun showNotification(remoteMessage: RemoteMessage, body: String) {
    val context = applicationContext
    val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) {
      Log.w(TAG, "Synzapp notification was received but Android notifications are disabled for this app")
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val existingChannel = notificationManager.getNotificationChannel(CHANNEL_ID)

      if (existingChannel == null) {
        val channel = NotificationChannel(CHANNEL_ID, "Chat messages", NotificationManager.IMPORTANCE_HIGH)
        channel.setShowBadge(true)
        notificationManager.createNotificationChannel(channel)
      } else if (!existingChannel.canShowBadge()) {
        existingChannel.setShowBadge(true)
        notificationManager.createNotificationChannel(existingChannel)
      }
    }

    val title = remoteMessage.data["notificationTitle"] ?: remoteMessage.notification?.title ?: "Synzapp"
    val badgeCount = remoteMessage.data["badgeCount"]?.toIntOrNull()?.coerceAtLeast(0)
    val notificationId = (remoteMessage.data["envelopeId"] ?: remoteMessage.messageId ?: body).hashCode()
    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      putExtra("type", remoteMessage.data["type"])
      putExtra("contactId", remoteMessage.data["contactId"])
      putExtra("conversationId", remoteMessage.data["conversationId"])
      putExtra("envelopeId", remoteMessage.data["envelopeId"])
      putExtra("sentAt", remoteMessage.data["sentAt"])
    }
    val pendingIntent = launchIntent?.let {
      PendingIntent.getActivity(
        context,
        notificationId,
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    }
    val senderAvatar = loadSenderAvatarLargeIcon(context, remoteMessage.data)
    // MessagingStyle, not BigTextStyle, and the face comes from the sender's
    // Person rather than from setLargeIcon.
    //
    // This is what every messaging app does and it is not interchangeable:
    // a large icon on a message notification is drawn to the **right** of the
    // text when collapsed, and Android has required a Person for the avatar
    // position since API 28. Setting a large icon instead put the picture in
    // the wrong place, which is why the app's own logo kept showing where the
    // sender's face belongs.
    val personIcon = IconCompat.createWithAdaptiveBitmap(
      senderAvatar ?: buildInitialsAvatar(title)
    )
    val senderKey = remoteMessage.data["senderUid"] ?: title
    val senderPerson = Person.Builder()
      .setName(title)
      .setKey(senderKey)
      .apply {
        // The photo when there is one, otherwise the person's initials drawn
        // the way the app draws them in the chat list — same colours, same two
        // letters. Left to itself Android would draw its own initial in its own
        // colour, which would not match anything else in the app.
        setIcon(personIcon)
      }
      .build()
    val messagingStyle = NotificationCompat.MessagingStyle(
      Person.Builder().setName("You").build()
    ).addMessage(body, remoteMessage.sentTime, senderPerson)

    if (remoteMessage.data["chatType"] == "GROUP") {
      messagingStyle
        .setConversationTitle(title)
        .setGroupConversation(true)
    }

    // What actually puts the face on the **collapsed** row.
    //
    // Android draws the app's own icon there unless the notice counts as a
    // conversation, and a conversation is only recognised by a MessagingStyle
    // notification tied to a long-lived shortcut. Setting the sender's Person
    // alone reaches the expanded view and nothing else, which is why the photo
    // used to appear only after tapping the arrow — and setLargeIcon does not
    // help, because MessagingStyle ignores it outside group chats and puts it
    // on the far side when it does not.
    val shortcutId = publishConversationShortcut(
      context = context,
      icon = personIcon,
      name = title,
      person = senderPerson,
      shortcutId = remoteMessage.data["conversationId"] ?: senderKey
    )
    val notificationBuilder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setAutoCancel(true)
      .setCategory(NotificationCompat.CATEGORY_MESSAGE)
      .setContentText(body)
      .setContentTitle(title)
      .setDefaults(NotificationCompat.DEFAULT_ALL)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setSmallIcon(getNotificationSmallIcon(context))
      .setStyle(messagingStyle)

    shortcutId?.let {
      notificationBuilder.setShortcutId(it)
      notificationBuilder.setLocusId(LocusIdCompat(it))
    }

    // The face has to be set **twice**, because the shade draws the two states
    // from different places: collapsed takes the large icon and falls back to
    // the app's own icon when there is none, while expanded takes the avatar
    // off the sender's Person. Setting only the Person is why the photo
    // appeared only after tapping the arrow.
    //
    if (badgeCount != null) {
      notificationBuilder
        .setBadgeIconType(if (senderAvatar != null) NotificationCompat.BADGE_ICON_LARGE else NotificationCompat.BADGE_ICON_SMALL)
        .setNumber(badgeCount)
    }

    if (pendingIntent != null) {
      notificationBuilder.setContentIntent(pendingIntent)
    }

    notificationManager.notify(notificationId, notificationBuilder.build())
  }

  private fun decodeBase64(value: String): ByteArray = Base64.decode(value, Base64.NO_WRAP)

  private fun getNotificationSmallIcon(context: Context): Int {
    val notificationIcon = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)

    return when {
      notificationIcon != 0 -> notificationIcon
      context.applicationInfo.icon != 0 -> context.applicationInfo.icon
      else -> android.R.drawable.sym_def_app_icon
    }
  }

  private fun loadSenderAvatarLargeIcon(context: Context, data: Map<String, String>): Bitmap? {
    val primaryCacheKey = data["notificationSenderProfilePhotoCacheKey"]
    val fallbackCacheKey = data["notificationSenderFallbackProfilePhotoCacheKey"]
    val avatar = decodeSenderAvatarBitmap(context, primaryCacheKey)
      ?: decodeSenderAvatarBitmap(context, fallbackCacheKey)

    if (avatar == null) {
      // Which of the two it is matters: no key means the sender has no photo on
      // file, while a key with nothing behind it means this phone has never
      // loaded that person's picture and so has nothing to show.
      Log.w(
        TAG,
        "No sender avatar for this notification. primaryKey=$primaryCacheKey " +
          "fallbackKey=$fallbackCacheKey storedKeys=${countStoredAvatars(context)}"
      )
    }

    return avatar
  }

  /** How many avatars this phone has cached at all, as a sanity check. */
  private fun countStoredAvatars(context: Context): Int {
    return try {
      context
        .getSharedPreferences(SECURE_STORE_PREFERENCES, Context.MODE_PRIVATE)
        .all
        .keys
        .count { it.contains(NOTIFICATION_AVATAR_STORAGE_PREFIX) }
    } catch (error: Exception) {
      -1
    }
  }

  private fun decodeSenderAvatarBitmap(context: Context, cacheKey: String?): Bitmap? {
    val safeCacheKey = cacheKey?.trim()?.takeIf { it.isNotEmpty() } ?: return null
    val storedAvatar = readSecureStoreString(
      context,
      "$NOTIFICATION_AVATAR_STORAGE_PREFIX$safeCacheKey",
      NOTIFICATION_AVATAR_SECURE_STORE_SERVICE
    ) ?: return null

    return try {
      val avatar = JSONObject(storedAvatar)

      if (avatar.optInt("version") != 1) {
        return null
      }

      val avatarBytes = decodeBase64(avatar.optString("base64"))

      if (avatarBytes.isEmpty() || avatarBytes.size > MAX_AVATAR_BYTE_COUNT) {
        return null
      }

      BitmapFactory
        .decodeByteArray(avatarBytes, 0, avatarBytes.size)
        ?.toNotificationLargeIcon()
    } catch (error: Exception) {
      Log.w(TAG, "Unable to load sender avatar notification icon", error)
      null
    }
  }

  private fun readSecureStoreString(context: Context, key: String, service: String): String? {
    val preferences = context.getSharedPreferences(SECURE_STORE_PREFERENCES, Context.MODE_PRIVATE)
    val encryptedValue = preferences.getString("$service-$key", null)
      ?: preferences.getString(key, null)
      ?: return null

    return decryptSecureStoreValue(encryptedValue, service)
  }

  /**
   * Opens one stored entry, whatever name it was filed under.
   *
   * `fallbackAlias` is the keychain service the entry was written under, used
   * only when the entry does not name its own keystore alias.
   */
  private fun decryptSecureStoreValue(encryptedValue: String?, fallbackAlias: String): String? {
    if (encryptedValue == null) {
      return null
    }

    return try {
      val encryptedItem = JSONObject(encryptedValue)

      if (encryptedItem.optString("scheme") != "aes") {
        return null
      }

      val keyStore = KeyStore.getInstance("AndroidKeyStore")
      keyStore.load(null)

      val keyStoreAlias = encryptedItem.optString("keystoreAlias").takeIf { it.isNotBlank() } ?: fallbackAlias
      val alias = if (encryptedItem.optBoolean("usesKeystoreSuffix", false)) {
        "AES/GCM/NoPadding:$keyStoreAlias:keystoreUnauthenticated"
      } else {
        "AES/GCM/NoPadding:$keyStoreAlias"
      }
      val secretKeyEntry = keyStore.getEntry(alias, null) as? KeyStore.SecretKeyEntry ?: return null
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      val ciphertext = decodeBase64(encryptedItem.getString("ct"))
      val iv = decodeBase64(encryptedItem.getString("iv"))

      cipher.init(
        Cipher.DECRYPT_MODE,
        secretKeyEntry.secretKey,
        GCMParameterSpec(encryptedItem.getInt("tlen"), iv)
      )

      String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8)
    } catch (error: Exception) {
      Log.w(TAG, "Unable to read Synzapp secure notification value", error)
      null
    }
  }

  /**
   * Registers the conversation so the shade will treat it as one.
   *
   * Long-lived, carrying the person and their picture, because that is what
   * Android reads to decide whose face belongs on the collapsed row. Returns
   * the id to attach to the notification, or null if the shortcut could not be
   * published — in which case the notice still shows, with the app's icon.
   */
  private fun publishConversationShortcut(
    context: Context,
    icon: IconCompat,
    name: String,
    person: Person,
    shortcutId: String
  ): String? {
    return try {
      val intent = context.packageManager
        .getLaunchIntentForPackage(context.packageName)
        ?.apply { action = Intent.ACTION_VIEW }
        ?: return null
      val shortcut = ShortcutInfoCompat.Builder(context, shortcutId)
        .setIcon(icon)
        .setIntent(intent)
        // Without this the shortcut is short-lived and the shade will not
        // accept it as a conversation.
        .setLongLived(true)
        .setLocusId(LocusIdCompat(shortcutId))
        .setPerson(person)
        .setShortLabel(name)
        .build()

      ShortcutManagerCompat.pushDynamicShortcut(context, shortcut)

      shortcutId
    } catch (error: Exception) {
      Log.w(TAG, "Could not publish the conversation shortcut", error)

      null
    }
  }

  /**
   * The person's initials, drawn the way the chat list draws them.
   *
   * Up to two letters, uppercase, on the brand's soft tint — the same rule and
   * the same colours as `getInitials` and `profileAvatarFallback` in the app,
   * so a person who has no photo looks the same in a notification as they do in
   * the conversation.
   */
  private fun buildInitialsAvatar(name: String): Bitmap {
    val bitmap = Bitmap.createBitmap(LARGE_ICON_SIZE, LARGE_ICON_SIZE, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val radius = LARGE_ICON_SIZE / 2f
    val circlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = INITIALS_BACKGROUND_COLOR
      style = Paint.Style.FILL
    }

    canvas.drawCircle(radius, radius, radius, circlePaint)

    val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = INITIALS_TEXT_COLOR
      textAlign = Paint.Align.CENTER
      textSize = LARGE_ICON_SIZE * 0.4f
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
    }
    // Centred on the letters themselves rather than on the line box, which sits
    // low and would leave the initials looking dropped in the circle.
    val bounds = textPaint.fontMetrics
    val baseline = radius - (bounds.ascent + bounds.descent) / 2f

    canvas.drawText(initialsFor(name), radius, baseline, textPaint)

    return bitmap
  }

  /** Two letters at most, the same rule the app's own avatars use. */
  private fun initialsFor(name: String): String {
    val letters = name
      .trim()
      .split(Regex("\\s+"))
      .filter { it.isNotBlank() }
      .mapNotNull { part -> part.firstOrNull { it.isLetter() } ?: part.firstOrNull() }
      .take(2)
      .joinToString("")
      .uppercase()

    return letters.ifEmpty { "?" }
  }

  private fun loadLargeIcon(context: Context): Bitmap? {
    return try {
      val largeIconResource = context.resources.getIdentifier("notification_large_icon", "drawable", context.packageName)

      if (largeIconResource != 0) {
        BitmapFactory.decodeResource(context.resources, largeIconResource)
      } else {
        ContextCompat.getDrawable(context, context.applicationInfo.icon)?.toBitmap()
      }
    } catch (error: Exception) {
      Log.w(TAG, "Unable to load Synzapp notification large icon", error)
      null
    }
  }

  private fun Drawable.toBitmap(): Bitmap {
    if (this is BitmapDrawable && bitmap != null) {
      return bitmap
    }

    val width = if (intrinsicWidth > 0) intrinsicWidth else 96
    val height = if (intrinsicHeight > 0) intrinsicHeight else 96
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)

    setBounds(0, 0, canvas.width, canvas.height)
    draw(canvas)

    return bitmap
  }

  private fun Bitmap.toNotificationLargeIcon(): Bitmap {
    val sourceSize = minOf(width, height)
    val offsetX = ((width - sourceSize) / 2).coerceAtLeast(0)
    val offsetY = ((height - sourceSize) / 2).coerceAtLeast(0)
    val squareBitmap = Bitmap.createBitmap(this, offsetX, offsetY, sourceSize, sourceSize)

    return if (squareBitmap.width == LARGE_ICON_SIZE && squareBitmap.height == LARGE_ICON_SIZE) {
      squareBitmap
    } else {
      Bitmap.createScaledBitmap(squareBitmap, LARGE_ICON_SIZE, LARGE_ICON_SIZE, true)
    }
  }

  private fun hasPreviewFields(data: Map<String, String>): Boolean {
    return data.containsKey("notificationPreviewAlgorithm") ||
      data.containsKey("notificationPreviewCiphertext") ||
      data.containsKey("notificationPreviewNonce")
  }

  companion object {
    private const val CALL_RING_TIMEOUT_MS = 60_000L
    private const val CALLS_CHANNEL_ID = "synzapp-calls"
    private const val CHANNEL_ID = "chat-messages"
    private const val ACTIONS_CHANNEL_ID = "action-updates"
    private const val ACTIONS_NOTIFICATION_ID = 4210
    private const val DERIVATION_LABEL = "Synzapp notification preview v1"
    // The chat list's own avatar colours, so the two match.
    private const val INITIALS_BACKGROUND_COLOR = 0xFFDDF6F1.toInt()
    private const val INITIALS_TEXT_COLOR = 0xFF0F766E.toInt()
    private const val LARGE_ICON_SIZE = 128
    private const val MAX_AVATAR_BYTE_COUNT = 64 * 1024
    private const val NOTIFICATION_AVATAR_SECURE_STORE_SERVICE = "synzapp.notification.avatar.v1"
    private const val NOTIFICATION_AVATAR_STORAGE_PREFIX = "synzapp.notificationAvatar.v1."
    private const val NOTIFICATION_PREVIEW_ALGORITHM = "x25519-sha256-aes-256-gcm+synzapp-notification-preview-v1"
    private const val DEVICE_IDENTITY_USER_KEY_MARKER = "synzapp.deviceIdentity.v1.user."
    private const val SECURE_STORE_PREFERENCES = "SecureStore"
    private const val SECURE_STORE_KEY = "synzapp.deviceIdentity.v1"
    private const val SECURE_STORE_SERVICE = "synzapp.device.identity.v1"
    private const val TAG = "SynzappPushPreview"
  }
}
