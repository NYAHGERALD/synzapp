package com.synzapp.backgroundtransfers

import android.content.Context
import android.net.Uri
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

class SynzappBackgroundTransferWorker(
  appContext: Context,
  workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {
  override suspend fun doWork(): Result {
    val transferId = inputData.getString(TransferKeys.TRANSFER_ID) ?: return Result.failure()
    val transferType = inputData.getString(TransferKeys.TRANSFER_TYPE) ?: return Result.failure()
    val destinationUri = inputData.getString(TransferKeys.DESTINATION_URI)

    return try {
      SynzappBackgroundTransferStore.running(
        applicationContext,
        transferId,
        transferType,
        destinationUri = destinationUri
      )

      when (transferType) {
        "upload" -> upload(transferId, transferType)
        "download" -> download(transferId, transferType)
        else -> Result.failure()
      }
    } catch (error: Throwable) {
      SynzappBackgroundTransferStore.failed(
        applicationContext,
        transferId,
        transferType,
        error.message ?: "Background transfer failed.",
        destinationUri
      )
      Result.failure()
    }
  }

  private fun upload(transferId: String, transferType: String): Result {
    val fileUri = inputData.getString(TransferKeys.FILE_URI) ?: return Result.failure()
    val url = inputData.getString(TransferKeys.URL) ?: return Result.failure()
    val method = inputData.getString(TransferKeys.METHOD) ?: "PUT"
    val sourceFile = resolveLocalFile(fileUri)
    val bytesExpected = sourceFile.length()
    val connection = openConnection(url, method)

    connection.doOutput = true
    connection.setFixedLengthStreamingMode(bytesExpected)

    FileInputStream(sourceFile).use { input ->
      connection.outputStream.use { output ->
        val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
        var bytesTransferred = 0L
        var lastProgressUpdate = 0L

        while (true) {
          val read = input.read(buffer)
          if (read == -1) {
            break
          }

          output.write(buffer, 0, read)
          bytesTransferred += read

          val now = System.currentTimeMillis()
          if (now - lastProgressUpdate > PROGRESS_UPDATE_INTERVAL_MS || bytesTransferred == bytesExpected) {
            SynzappBackgroundTransferStore.running(
              applicationContext,
              transferId,
              transferType,
              bytesTransferred,
              bytesExpected
            )
            lastProgressUpdate = now
          }
        }
      }
    }

    return completeFromResponse(connection, transferId, transferType, bytesExpected, null)
  }

  private fun download(transferId: String, transferType: String): Result {
    val url = inputData.getString(TransferKeys.URL) ?: return Result.failure()
    val destinationUri = inputData.getString(TransferKeys.DESTINATION_URI) ?: return Result.failure()
    val destinationFile = resolveLocalFile(destinationUri)
    val temporaryFile = File(destinationFile.absolutePath + ".download")
    val connection = openConnection(url, "GET")
    val responseCode = connection.responseCode

    if (responseCode !in 200..299) {
      SynzappBackgroundTransferStore.failed(
        applicationContext,
        transferId,
        transferType,
        "HTTP $responseCode",
        destinationUri
      )
      return Result.failure()
    }

    destinationFile.parentFile?.mkdirs()
    val bytesExpected = connection.contentLengthLong.takeIf { it > 0 } ?: 0L
    var bytesTransferred = 0L
    var lastProgressUpdate = 0L

    connection.inputStream.use { input ->
      FileOutputStream(temporaryFile).use { output ->
        val buffer = ByteArray(DEFAULT_BUFFER_SIZE)

        while (true) {
          val read = input.read(buffer)
          if (read == -1) {
            break
          }

          output.write(buffer, 0, read)
          bytesTransferred += read

          val now = System.currentTimeMillis()
          if (now - lastProgressUpdate > PROGRESS_UPDATE_INTERVAL_MS || bytesTransferred == bytesExpected) {
            SynzappBackgroundTransferStore.running(
              applicationContext,
              transferId,
              transferType,
              bytesTransferred,
              bytesExpected,
              destinationUri
            )
            lastProgressUpdate = now
          }
        }
      }
    }

    // A dropped connection ends the read loop the same way a finished download
    // does, so without this check a partial body is renamed into place and
    // reported as a success. Downstream that surfaces as media stalling just
    // short of complete and failing to decrypt, because the file really is
    // short. Fail the transfer instead so the caller can retry cleanly.
    if (bytesExpected > 0L && bytesTransferred != bytesExpected) {
      temporaryFile.delete()
      SynzappBackgroundTransferStore.failed(
        applicationContext,
        transferId,
        transferType,
        "Incomplete download: received $bytesTransferred of $bytesExpected bytes.",
        destinationUri
      )
      return Result.failure()
    }

    if (destinationFile.exists()) {
      destinationFile.delete()
    }
    if (!temporaryFile.renameTo(destinationFile)) {
      temporaryFile.copyTo(destinationFile, overwrite = true)
      temporaryFile.delete()
    }

    SynzappBackgroundTransferStore.completed(
      applicationContext,
      transferId,
      transferType,
      bytesTransferred,
      bytesExpected,
      destinationUri
    )

    return Result.success()
  }

  private fun completeFromResponse(
    connection: HttpURLConnection,
    transferId: String,
    transferType: String,
    bytesExpected: Long,
    destinationUri: String?
  ): Result {
    val responseCode = connection.responseCode
    return if (responseCode in 200..299) {
      SynzappBackgroundTransferStore.completed(
        applicationContext,
        transferId,
        transferType,
        bytesExpected,
        bytesExpected,
        destinationUri
      )
      Result.success()
    } else {
      SynzappBackgroundTransferStore.failed(
        applicationContext,
        transferId,
        transferType,
        "HTTP $responseCode",
        destinationUri
      )
      Result.failure()
    }
  }

  private fun openConnection(url: String, method: String): HttpURLConnection {
    val connection = URL(url).openConnection() as HttpURLConnection
    connection.requestMethod = method
    connection.connectTimeout = CONNECT_TIMEOUT_MS
    connection.readTimeout = READ_TIMEOUT_MS
    connection.useCaches = false

    val headersJson = inputData.getString(TransferKeys.HEADERS_JSON)
    if (!headersJson.isNullOrBlank()) {
      val headers = JSONObject(headersJson)
      headers.keys().forEach { key ->
        connection.setRequestProperty(key, headers.optString(key))
      }
    }

    return connection
  }

  private fun resolveLocalFile(uriString: String): File {
    val uri = Uri.parse(uriString)
    if (uri.scheme == null) {
      return File(uriString)
    }
    if (uri.scheme == "file") {
      return File(requireNotNull(uri.path) { "Invalid file URI." })
    }

    throw IllegalArgumentException("Only local file URIs are supported for background transfers.")
  }

  companion object {
    private const val CONNECT_TIMEOUT_MS = 30000
    private const val DEFAULT_BUFFER_SIZE = 1024 * 256
    private const val PROGRESS_UPDATE_INTERVAL_MS = 250L
    private const val READ_TIMEOUT_MS = 30000
  }
}
