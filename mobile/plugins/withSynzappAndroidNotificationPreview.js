const fs = require('fs');
const path = require('path');
const {
  AndroidConfig,
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod
} = require('expo/config-plugins');

const SERVICE_CLASS = 'com.synzapp.mobile.notifications.SynzappFirebaseMessagingService';
const LARGE_ICON_RESOURCE = 'notification_large_icon';
const SERVICE_SOURCE = `package com.synzapp.mobile.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.os.Build
import android.util.Base64
import android.util.Log
import androidx.core.content.ContextCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.RemoteMessage
import expo.modules.notifications.service.ExpoFirebaseMessagingService
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
    if (handleSynzappEncryptedPreview(remoteMessage)) {
      return
    }

    super.onMessageReceived(remoteMessage)
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

    return true
  }

  private fun decryptPreview(data: Map<String, String>): String? {
    if (
      data["notificationPreviewAlgorithm"] != NOTIFICATION_PREVIEW_ALGORITHM ||
      data["notificationPreviewVersion"] != "1"
    ) {
      return null
    }

    return try {
      val identity = readStoredDeviceIdentity() ?: return null
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

  private fun readStoredDeviceIdentity(): JSONObject? {
    val preferences = getSharedPreferences("SecureStore", Context.MODE_PRIVATE)
    val encryptedValue = preferences.getString("$SECURE_STORE_SERVICE-$SECURE_STORE_KEY", null)
      ?: preferences.getString(SECURE_STORE_KEY, null)
      ?: return null
    val encryptedItem = JSONObject(encryptedValue)

    if (encryptedItem.optString("scheme") != "aes") {
      return null
    }

    val keyStore = KeyStore.getInstance("AndroidKeyStore")
    keyStore.load(null)

    val alias = if (encryptedItem.optBoolean("usesKeystoreSuffix", false)) {
      "AES/GCM/NoPadding:$SECURE_STORE_SERVICE:keystoreUnauthenticated"
    } else {
      "AES/GCM/NoPadding:$SECURE_STORE_SERVICE"
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

    return JSONObject(String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8))
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
    val notificationIcon = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
    val smallIcon = when {
      notificationIcon != 0 -> notificationIcon
      context.applicationInfo.icon != 0 -> context.applicationInfo.icon
      else -> android.R.drawable.sym_def_app_icon
    }
    val largeIcon = loadLargeIcon(context)
    val notificationBuilder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setAutoCancel(true)
      .setCategory(NotificationCompat.CATEGORY_MESSAGE)
      .setContentText(body)
      .setContentTitle(title)
      .setDefaults(NotificationCompat.DEFAULT_ALL)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setSmallIcon(smallIcon)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))

    if (badgeCount != null) {
      notificationBuilder
        .setBadgeIconType(NotificationCompat.BADGE_ICON_LARGE)
        .setNumber(badgeCount)
    }

    if (largeIcon != null) {
      notificationBuilder.setLargeIcon(largeIcon)
    }

    if (pendingIntent != null) {
      notificationBuilder.setContentIntent(pendingIntent)
    }

    notificationManager.notify(notificationId, notificationBuilder.build())
  }

  private fun decodeBase64(value: String): ByteArray = Base64.decode(value, Base64.NO_WRAP)

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

  private fun hasPreviewFields(data: Map<String, String>): Boolean {
    return data.containsKey("notificationPreviewAlgorithm") ||
      data.containsKey("notificationPreviewCiphertext") ||
      data.containsKey("notificationPreviewNonce")
  }

  companion object {
    private const val CHANNEL_ID = "chat-messages"
    private const val DERIVATION_LABEL = "Synzapp notification preview v1"
    private const val NOTIFICATION_PREVIEW_ALGORITHM = "x25519-sha256-aes-256-gcm+synzapp-notification-preview-v1"
    private const val SECURE_STORE_KEY = "synzapp.deviceIdentity.v1"
    private const val SECURE_STORE_SERVICE = "synzapp.device.identity.v1"
    private const val TAG = "SynzappPushPreview"
  }
}
`;

module.exports = function withSynzappAndroidNotificationPreview(config) {
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const sourcePath = path.join(
        config.modRequest.projectRoot,
        'android/app/src/main/java/com/synzapp/mobile/notifications/SynzappFirebaseMessagingService.kt'
      );

      fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
      fs.writeFileSync(sourcePath, SERVICE_SOURCE);

      const largeIconSourcePath = path.join(config.modRequest.projectRoot, 'assets/notification-large-icon.png');
      const largeIconOutputPath = path.join(
        config.modRequest.platformProjectRoot,
        'app/src/main/res/drawable-nodpi',
        `${LARGE_ICON_RESOURCE}.png`
      );

      if (fs.existsSync(largeIconSourcePath)) {
        fs.mkdirSync(path.dirname(largeIconOutputPath), { recursive: true });
        fs.copyFileSync(largeIconSourcePath, largeIconOutputPath);
      }

      return config;
    }
  ]);

  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);

    manifest.$ = manifest.$ || {};
    manifest.$['xmlns:tools'] = manifest.$['xmlns:tools'] || 'http://schemas.android.com/tools';
    application.service = (application.service || []).filter((service) => {
      const name = service.$?.['android:name'];

      return name !== SERVICE_CLASS &&
        name !== 'expo.modules.notifications.service.ExpoFirebaseMessagingService';
    });
    application.service.push({
      $: {
        'android:name': 'expo.modules.notifications.service.ExpoFirebaseMessagingService',
        'tools:node': 'remove'
      }
    });
    application.service.push({
      $: {
        'android:exported': 'false',
        'android:name': SERVICE_CLASS
      },
      'intent-filter': [
        {
          action: [
            {
              $: {
                'android:name': 'com.google.firebase.MESSAGING_EVENT'
              }
            }
          ]
        }
      ]
    });
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      application,
      'expo.modules.notifications.large_notification_icon',
      `@drawable/${LARGE_ICON_RESOURCE}`,
      'resource'
    );

    return config;
  });

  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      return config;
    }

    if (!config.modResults.contents.includes('org.bouncycastle:bcprov-jdk15to18')) {
      config.modResults.contents = config.modResults.contents.replace(
        /dependencies\s*{/,
        "dependencies {\n    implementation 'org.bouncycastle:bcprov-jdk15to18:1.78.1'"
      );
    }
    if (!config.modResults.contents.includes('com.google.firebase:firebase-messaging')) {
      config.modResults.contents = config.modResults.contents.replace(
        /dependencies\s*{/,
        "dependencies {\n    implementation 'com.google.firebase:firebase-messaging:24.0.1'"
      );
    }

    return config;
  });

  return config;
};
