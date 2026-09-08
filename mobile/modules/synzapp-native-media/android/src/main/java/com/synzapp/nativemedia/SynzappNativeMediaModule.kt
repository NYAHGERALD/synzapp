package com.synzapp.nativemedia

import android.app.Activity
import android.content.ContentResolver
import android.content.Intent
import android.database.Cursor
import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import expo.modules.kotlin.Promise
import expo.modules.kotlin.events.OnActivityResultPayload
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.util.Collections
import java.util.Base64
import java.util.UUID
import java.util.concurrent.Executors
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

private const val REQUEST_PICK_MEDIA = 42073
private const val CACHE_DIR_NAME = "SynzappNativeMedia"
private const val PERSISTENT_MEDIA_DIR_NAME = "SynzappMedia"

class SynzappNativeMediaModule : Module() {
  private var activePickerPromise: Promise? = null
  /** Cached once: the cipher probe should not run on every chunk. */
  private var nativeAeadSupported: Boolean? = null
  private val cancelledPreparations = Collections.synchronizedSet(mutableSetOf<String>())

  // One transcode at a time. Two concurrent MediaCodec pipelines starve each
  // other on the hardware encoder and make every send slower, not faster.
  private val transcodeExecutor = Executors.newSingleThreadExecutor()
  private val videoTranscoder: SynzappNativeVideoTranscoder by lazy {
    SynzappNativeVideoTranscoder(cacheDir)
  }

  /**
   * Moves media left in the old no_backup directory.
   *
   * Media used to be written to noBackupFilesDir, which expo-file-system cannot
   * write to. Anything already there was put there by native code and is still
   * referenced by messages, so it is moved rather than abandoned — otherwise
   * every photo and voice note from before this change would render as missing.
   *
   * A rename is attempted first because it costs nothing; a copy is the fallback
   * for the case where the two directories sit on different mounts.
   */
  private fun migrateLegacyPersistentMedia(legacyRoot: File, root: File) {
    if (!legacyRoot.isDirectory) {
      return
    }

    runCatching {
      legacyRoot.listFiles()?.forEach { file ->
        val target = File(root, file.name)

        if (target.exists()) {
          return@forEach
        }

        if (!file.renameTo(target)) {
          file.copyTo(target, overwrite = false)
          file.delete()
        }
      }

      legacyRoot.delete()
    }
  }

  override fun definition() = ModuleDefinition {
    Name("SynzappNativeMedia")
    Events("onSynzappNativeMediaPreparationEvent", "onSynzappNativeMediaTranscodeEvent")

    /**
     * Where chat media is kept so it survives.
     *
     * This is filesDir, not noBackupFilesDir. Both are internal storage that
     * Android never reclaims on its own, but expo-file-system refuses to write
     * anywhere outside the directories it scopes — files/ and cache/ — so a copy
     * into no_backup fails with "isn't writable" no matter what the OS permits.
     * That is what stopped voice notes being sent on Android.
     *
     * Backup exclusion is not lost by moving: it is declared in the manifest's
     * backup rules, which back up shared preferences only, so nothing under
     * files/ travels into an employee's personal Google backup.
     */
    AsyncFunction("getPersistentMediaDirectory") { promise: Promise ->
      promise.resolve(
        runCatching {
          val context = requireNotNull(appContext.reactContext) {
            "React Application Context is null"
          }
          val root = File(context.filesDir, PERSISTENT_MEDIA_DIR_NAME)
          root.mkdirs()
          migrateLegacyPersistentMedia(File(context.noBackupFilesDir, PERSISTENT_MEDIA_DIR_NAME), root)
          Uri.fromFile(root).toString().trimEnd('/') + "/"
        }.getOrNull()
      )
    }

    AsyncFunction("readVideoPoster") { input: Map<String, Any?>, promise: Promise ->
      promise.resolve(runCatching { SynzappVideoPoster.read(input) }.getOrNull())
    }

    AsyncFunction("isAvailable") { promise: Promise ->
      promise.resolve(true)
    }

    AsyncFunction("getMediaPipelineCapabilities") { promise: Promise ->
      promise.resolve(
        mapOf(
          "backgroundMultipartUploadWorkerAvailable" to true,
          "killedAppSecretboxWorkerAvailable" to false,
          "nativeAeadMediaEncryptionAvailable" to isNativeAeadAvailable(),
          "nativeAeadMediaEncryptionMode" to NATIVE_AEAD_MODE,
          "reason" to if (isNativeAeadAvailable()) {
            "Legacy Secretbox media remains JavaScript-compatible. New large media can use native versioned ChaCha20-Poly1305 chunk encryption without changing old media semantics."
          } else {
            "This Android version does not expose platform ChaCha20-Poly1305. Synzapp will use the legacy Secretbox media path on this device."
          },
          "secretboxAlgorithm" to "nacl-secretbox-xsalsa20-poly1305",
          "videoTranscodingAvailable" to true
        )
      )
    }

    AsyncFunction("transcodeVideo") { input: Map<String, Any?>, promise: Promise ->
      transcodeExecutor.execute {
        try {
          promise.resolve(
            videoTranscoder.transcode(input) { body ->
              sendEvent("onSynzappNativeMediaTranscodeEvent", body)
            }
          )
        } catch (error: Throwable) {
          promise.reject(
            "transcode_failed",
            error.message ?: "Unable to compress this video.",
            error as? Exception
          )
        }
      }
    }

    AsyncFunction("cancelVideoTranscode") { input: Map<String, Any?>, promise: Promise ->
      val requestId = (input["requestId"] as? String)?.trim().orEmpty()

      promise.resolve(if (requestId.isEmpty()) false else videoTranscoder.cancel(requestId))
    }

    AsyncFunction("pickMediaAssets") { input: Map<String, Any?>?, promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject("activity_unavailable", "Synzapp could not open the media picker.", null)
        return@AsyncFunction
      }

      if (activePickerPromise != null) {
        promise.reject("picker_active", "A media picker is already open.", null)
        return@AsyncFunction
      }

      val limit = normalizeLimit(input?.get("limit"))
      val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        type = "*/*"
        putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/*", "video/*"))
        putExtra(Intent.EXTRA_ALLOW_MULTIPLE, limit > 1)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
      }

      activePickerPromise = promise
      activity.startActivityForResult(intent, REQUEST_PICK_MEDIA)
    }

    AsyncFunction("prepareMediaAsset") { input: Map<String, Any?>, promise: Promise ->
      val assetIdentifier = (input["assetIdentifier"] as? String)?.trim().orEmpty()
      if (assetIdentifier.isBlank()) {
        promise.reject("invalid_input", "assetIdentifier is required.", null)
        return@AsyncFunction
      }

      val resolver = contentResolver
      val sourceUri = Uri.parse(assetIdentifier)
      val metadata = buildAssetPayload(sourceUri)
      val fileName = sanitizeFileName(
        (input["fileName"] as? String)?.takeIf { it.isNotBlank() } ?: metadata["fileName"] as? String ?: "media"
      )
      // The on-disk name is prefixed to keep two picks of different files apart,
      // but the prefix is derived from a content:// URI and is not something to
      // show anyone. The display name is kept separately and reported instead.
      val destination = File(cacheDir, "${sanitizeFileName(assetIdentifier)}-$fileName")

      cancelledPreparations.remove(assetIdentifier)
      sendPreparationEvent(
        assetIdentifier = assetIdentifier,
        status = "running",
        progress = 0.01,
        message = "Preparing media."
      )

      try {
        resolver.openInputStream(sourceUri).use { inputStream ->
          if (inputStream == null) {
            throw IllegalStateException("Synzapp could not open the selected media.")
          }

          FileOutputStream(destination).use { outputStream ->
            val sizeBytes = (metadata["sizeBytes"] as? Long)?.takeIf { it > 0 }
            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
            var copiedBytes = 0L

            while (true) {
              if (cancelledPreparations.contains(assetIdentifier)) {
                destination.delete()
                sendPreparationEvent(
                  assetIdentifier = assetIdentifier,
                  status = "cancelled",
                  progress = 0.0,
                  message = "Media preparation was cancelled."
                )
                promise.reject("prepare_cancelled", "Media preparation was cancelled.", null)
                return@AsyncFunction
              }

              val read = inputStream.read(buffer)
              if (read == -1) {
                break
              }

              outputStream.write(buffer, 0, read)
              copiedBytes += read
              if (sizeBytes != null) {
                sendPreparationEvent(
                  assetIdentifier = assetIdentifier,
                  status = "running",
                  progress = (copiedBytes.toDouble() / sizeBytes.toDouble()).coerceIn(0.02, 0.98),
                  message = "Copying media."
                )
              }
            }
          }
        }

        val payload = metadata.toMutableMap().apply {
          put("assetIdentifier", assetIdentifier)
          // The readable name, not destination.name: that carries the sanitised
          // content URI prefix, which is how a video ended up displayed as
          // "content-com.android.providers.media.documents-document-...".
          put("fileName", fileName)
          put("fileUri", Uri.fromFile(destination).toString())
          put("sizeBytes", destination.length())
        }

        sendPreparationEvent(
          assetIdentifier = assetIdentifier,
          status = "completed",
          progress = 1.0,
          fileUri = payload["fileUri"] as? String,
          fileName = payload["fileName"] as? String,
          contentType = payload["contentType"] as? String,
          sizeBytes = destination.length()
        )
        promise.resolve(payload)
      } catch (error: Throwable) {
        destination.delete()
        sendPreparationEvent(
          assetIdentifier = assetIdentifier,
          status = "failed",
          progress = 0.0,
          message = error.message ?: "Synzapp could not prepare the selected media."
        )
        promise.reject("prepare_failed", error.message ?: "Synzapp could not prepare the selected media.", error)
      } finally {
        cancelledPreparations.remove(assetIdentifier)
      }
    }

    AsyncFunction("cancelMediaAssetPreparation") { input: Map<String, Any?>, promise: Promise ->
      val assetIdentifier = (input["assetIdentifier"] as? String)?.trim().orEmpty()
      if (assetIdentifier.isBlank()) {
        promise.resolve(false)
        return@AsyncFunction
      }

      cancelledPreparations.add(assetIdentifier)
      promise.resolve(true)
    }

    AsyncFunction("encryptMediaFile") { input: Map<String, Any?>, promise: Promise ->
      try {
        promise.resolve(encryptMediaFile(input))
      } catch (error: Throwable) {
        promise.reject("encrypt_failed", error.message ?: "Native media encryption failed.", error)
      }
    }

    AsyncFunction("decryptMediaFile") { input: Map<String, Any?>, promise: Promise ->
      try {
        promise.resolve(decryptMediaFile(input))
      } catch (error: Throwable) {
        promise.reject("decrypt_failed", error.message ?: "Native media decryption failed.", error)
      }
    }

    OnActivityResult { _: Activity, payload: OnActivityResultPayload ->
      if (payload.requestCode != REQUEST_PICK_MEDIA) {
        return@OnActivityResult
      }

      val promise = activePickerPromise ?: return@OnActivityResult
      activePickerPromise = null

      val data = payload.data
      if (payload.resultCode != Activity.RESULT_OK || data == null) {
        promise.resolve(mapOf("assets" to emptyList<Map<String, Any?>>(), "canceled" to true))
        return@OnActivityResult
      }

      val uris = selectedUris(data)
      uris.forEach(::persistUriPermission)
      promise.resolve(
        mapOf(
          "assets" to uris.map(::buildAssetPayload),
          "canceled" to false
        )
      )
    }
  }

  private val contentResolver: ContentResolver
    get() = requireNotNull(appContext.reactContext) {
      "React Application Context is null"
    }.contentResolver

  private val cacheDir: File
    get() {
      val root = File(
        requireNotNull(appContext.reactContext) {
          "React Application Context is null"
        }.cacheDir,
        CACHE_DIR_NAME
      )
      root.mkdirs()
      return root
    }

  private fun selectedUris(intent: Intent): List<Uri> {
    val clipData = intent.clipData
    if (clipData != null && clipData.itemCount > 0) {
      return (0 until clipData.itemCount).mapNotNull { index ->
        clipData.getItemAt(index)?.uri
      }
    }

    return intent.data?.let { listOf(it) } ?: emptyList()
  }

  private fun persistUriPermission(uri: Uri) {
    try {
      contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
    } catch (_: SecurityException) {
      // Some providers grant transient access only. The foreground flow can still use the URI.
    }
  }

  private fun buildAssetPayload(uri: Uri): Map<String, Any?> {
    val contentType = contentResolver.getType(uri).orEmpty()
    val isVideo = contentType.startsWith("video/")
    val metadata = readOpenableMetadata(uri)
    val dimensions = if (isVideo) readVideoMetadata(uri) else readImageDimensions(uri)
    val fallbackFileName = if (isVideo) "video" else "photo"

    return mutableMapOf<String, Any?>(
      "assetIdentifier" to uri.toString(),
      "contentType" to (contentType.ifBlank { if (isVideo) "video/mp4" else "image/jpeg" }),
      "fileName" to (metadata.fileName ?: fallbackFileName),
      "height" to dimensions.height,
      "kind" to if (isVideo) "video" else "image",
      "sizeBytes" to metadata.sizeBytes,
      "width" to dimensions.width
    ).apply {
      dimensions.durationMs?.let { put("durationMs", it) }
    }
  }

  private fun readOpenableMetadata(uri: Uri): OpenableMetadata {
    var cursor: Cursor? = null
    return try {
      cursor = contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)
      if (cursor != null && cursor.moveToFirst()) {
        val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
        OpenableMetadata(
          fileName = if (nameIndex >= 0) cursor.getString(nameIndex) else null,
          sizeBytes = if (sizeIndex >= 0) cursor.getLong(sizeIndex) else null
        )
      } else {
        OpenableMetadata()
      }
    } catch (_: Throwable) {
      OpenableMetadata()
    } finally {
      cursor?.close()
    }
  }

  private fun readImageDimensions(uri: Uri): MediaDimensions {
    return try {
      contentResolver.openInputStream(uri).use { stream ->
        val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeStream(stream, null, options)
        MediaDimensions(width = options.outWidth.takeIf { it > 0 }, height = options.outHeight.takeIf { it > 0 })
      }
    } catch (_: Throwable) {
      MediaDimensions()
    }
  }

  private fun readVideoMetadata(uri: Uri): MediaDimensions {
    val retriever = MediaMetadataRetriever()
    return try {
      retriever.setDataSource(requireNotNull(appContext.reactContext), uri)
      val width = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull()
      val height = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull()
      val durationMs = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull()
      MediaDimensions(width = width, height = height, durationMs = durationMs)
    } catch (_: Throwable) {
      MediaDimensions()
    } finally {
      retriever.release()
    }
  }

  private fun sendPreparationEvent(
    assetIdentifier: String,
    status: String,
    progress: Double,
    fileUri: String? = null,
    fileName: String? = null,
    contentType: String? = null,
    sizeBytes: Long? = null,
    message: String? = null
  ) {
    val body = mutableMapOf<String, Any?>(
      "assetIdentifier" to assetIdentifier,
      "progress" to progress,
      "status" to status
    )
    fileUri?.let { body["fileUri"] = it }
    fileName?.let { body["fileName"] = it }
    contentType?.let { body["contentType"] = it }
    sizeBytes?.let { body["sizeBytes"] = it }
    message?.let { body["message"] = it }
    sendEvent("onSynzappNativeMediaPreparationEvent", body)
  }

  private fun normalizeLimit(value: Any?): Int {
    val numericValue = when (value) {
      is Number -> value.toInt()
      else -> 10
    }
    return numericValue.coerceIn(1, 10)
  }

  private fun sanitizeFileName(value: String): String {
    return value.replace(Regex("[/\\\\?%*:|\"<>\\s]+"), "-")
      .trim('-')
      .ifBlank { "media" }
  }

  private fun encryptMediaFile(input: Map<String, Any?>): Map<String, Any?> {
    if (!isNativeAeadAvailable()) {
      throw IllegalStateException("Native media encryption is not available on this Android version.")
    }

    val sourceUri = (input["sourceUri"] as? String)?.trim().orEmpty()
    if (sourceUri.isBlank()) {
      throw IllegalArgumentException("sourceUri is required.")
    }

    val sourceFile = localFileFromUri(sourceUri)
    val chunkSizeBytes = normalizeChunkSize(input["chunkSizeBytes"])
    val outputFile = File(cacheDir, "native_aead_upload_${System.currentTimeMillis()}_${UUID.randomUUID()}.bin")
    val key = ByteArray(32).also { SECURE_RANDOM.nextBytes(it) }
    val partNonces = mutableListOf<String>()
    var encryptedSizeBytes = 0L

    FileInputStream(sourceFile).use { inputStream ->
      FileOutputStream(outputFile).use { outputStream ->
        val buffer = ByteArray(chunkSizeBytes)

        while (true) {
          val read = inputStream.read(buffer)
          if (read == -1) {
            break
          }

          val plainChunk = if (read == buffer.size) buffer else buffer.copyOf(read)
          val nonce = ByteArray(12).also { SECURE_RANDOM.nextBytes(it) }
          val sealedChunk = encryptChunk(plainChunk, key, nonce)
          outputStream.write(sealedChunk)
          encryptedSizeBytes += sealedChunk.size.toLong()
          partNonces.add(BASE64_ENCODER.encodeToString(nonce))
        }

        if (partNonces.isEmpty()) {
          val nonce = ByteArray(12).also { SECURE_RANDOM.nextBytes(it) }
          val sealedChunk = encryptChunk(ByteArray(0), key, nonce)
          outputStream.write(sealedChunk)
          encryptedSizeBytes += sealedChunk.size.toLong()
          partNonces.add(BASE64_ENCODER.encodeToString(nonce))
        }
      }
    }

    return mapOf(
      "chunkSizeBytes" to chunkSizeBytes,
      "encryptedFileUri" to Uri.fromFile(outputFile).toString(),
      "encryptedSizeBytes" to encryptedSizeBytes,
      "encryptionMode" to NATIVE_AEAD_MODE,
      "key" to BASE64_ENCODER.encodeToString(key),
      "partCount" to partNonces.size,
      "partNonces" to partNonces
    )
  }

  private fun decryptMediaFile(input: Map<String, Any?>): Map<String, Any?> {
    if (!isNativeAeadAvailable()) {
      throw IllegalStateException("Native media decryption is not available on this Android version.")
    }

    val encryptedFileUri = (input["encryptedFileUri"] as? String)?.trim().orEmpty()
    val keyBase64 = (input["key"] as? String)?.trim().orEmpty()
    val partNonces = input["partNonces"] as? List<*> ?: throw IllegalArgumentException("partNonces is required.")
    val partCount = (input["partCount"] as? Number)?.toInt() ?: throw IllegalArgumentException("partCount is required.")
    val originalSizeBytes = (input["originalSizeBytes"] as? Number)?.toLong()
      ?: throw IllegalArgumentException("originalSizeBytes is required.")
    val chunkSizeBytes = normalizeChunkSize(input["chunkSizeBytes"])

    if (encryptedFileUri.isBlank() || keyBase64.isBlank()) {
      throw IllegalArgumentException("encryptedFileUri and key are required.")
    }

    if (partNonces.size != partCount) {
      throw IllegalArgumentException("partNonces must match partCount.")
    }

    val encryptedFile = localFileFromUri(encryptedFileUri)
    val outputExtension = outputExtension(input["fileName"] as? String)
    val outputFile = File(cacheDir, "native_aead_plain_${System.currentTimeMillis()}_${UUID.randomUUID()}.$outputExtension")
    val key = BASE64_DECODER.decode(keyBase64)
    var remainingPlainBytes = originalSizeBytes

    FileInputStream(encryptedFile).use { inputStream ->
      FileOutputStream(outputFile).use { outputStream ->
        for (partIndex in 0 until partCount) {
          val plainLength = minOf(chunkSizeBytes.toLong(), remainingPlainBytes.coerceAtLeast(0L)).toInt()
          val encryptedLength = plainLength + AEAD_TAG_LENGTH
          val sealedChunk = inputStream.readExactly(encryptedLength)
          val nonce = BASE64_DECODER.decode(partNonces[partIndex] as? String ?: "")
          val plaintext = decryptChunk(sealedChunk, key, nonce)
          outputStream.write(plaintext)
          remainingPlainBytes -= plainLength.toLong()
        }
      }
    }

    return mapOf(
      "fileUri" to Uri.fromFile(outputFile).toString(),
      "sizeBytes" to outputFile.length()
    )
  }

  private fun localFileFromUri(uri: String): File {
    val parsedUri = Uri.parse(uri)
    if (parsedUri.scheme != "file") {
      throw IllegalArgumentException("Only local file URIs are supported.")
    }

    val path = parsedUri.path ?: throw IllegalArgumentException("Invalid file URI.")
    return File(path)
  }

  private fun normalizeChunkSize(value: Any?): Int {
    val requested = (value as? Number)?.toInt() ?: NATIVE_AEAD_DEFAULT_CHUNK_SIZE
    return requested.coerceIn(512 * 1024, 32 * 1024 * 1024)
  }

  private fun outputExtension(fileName: String?): String {
    val extension = fileName?.substringAfterLast('.', "")?.lowercase().orEmpty()
    return if (extension.matches(Regex("^[a-z0-9]{1,12}$"))) extension else "bin"
  }

  private fun encryptChunk(plainChunk: ByteArray, key: ByteArray, nonce: ByteArray): ByteArray {
    val cipher = Cipher.getInstance(NATIVE_AEAD_TRANSFORMATION)
    cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "ChaCha20"), IvParameterSpec(nonce))
    return cipher.doFinal(plainChunk)
  }

  private fun decryptChunk(sealedChunk: ByteArray, key: ByteArray, nonce: ByteArray): ByteArray {
    val cipher = Cipher.getInstance(NATIVE_AEAD_TRANSFORMATION)
    cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "ChaCha20"), IvParameterSpec(nonce))
    return cipher.doFinal(sealedChunk)
  }

  /**
   * Whether this device can actually do ChaCha20-Poly1305.
   *
   * The cipher is asked for, not just assumed from the Android version. The
   * version check alone said yes on every modern device while the cipher name
   * being used was invalid, so the app advertised the feature, used it for
   * every video, and failed on every single one — with the reason discarded.
   * Videos downloaded fully and then would not open.
   *
   * Probing means a device that genuinely cannot do this falls back to the
   * older path that works, instead of failing silently.
   */
  private fun isNativeAeadAvailable(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
      return false
    }

    nativeAeadSupported?.let { return it }

    val supported = try {
      Cipher.getInstance(NATIVE_AEAD_TRANSFORMATION)
      true
    } catch (_: Throwable) {
      false
    }

    nativeAeadSupported = supported

    return supported
  }

  private fun FileInputStream.readExactly(count: Int): ByteArray {
    val buffer = ByteArray(count)
    var offset = 0

    while (offset < count) {
      val read = read(buffer, offset, count - offset)
      if (read == -1) {
        throw IllegalArgumentException("Encrypted media is incomplete.")
      }
      offset += read
    }

    return buffer
  }
}

private const val NATIVE_AEAD_MODE = "native-chacha20poly1305-chunked-v1"

/**
 * Android's name for this cipher.
 *
 * Not "ChaCha20-Poly1305/NoPadding": Android rejects that with "Invalid
 * transformation format", because this is an AEAD cipher with no separate mode
 * or padding to name. Using the longer form meant every video sent from an
 * iPhone arrived complete and could never be opened.
 */
private const val NATIVE_AEAD_TRANSFORMATION = "ChaCha20-Poly1305"
private const val NATIVE_AEAD_DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024
private const val AEAD_TAG_LENGTH = 16
private val BASE64_ENCODER: Base64.Encoder = Base64.getEncoder()
private val BASE64_DECODER: Base64.Decoder = Base64.getDecoder()
private val SECURE_RANDOM = java.security.SecureRandom()

private data class OpenableMetadata(
  val fileName: String? = null,
  val sizeBytes: Long? = null
)

private data class MediaDimensions(
  val width: Int? = null,
  val height: Int? = null,
  val durationMs: Long? = null
)
