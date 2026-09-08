package com.synzapp.backgroundtransfers

import android.content.Context
import androidx.work.Constraints
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import java.util.UUID

class SynzappBackgroundTransfersModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SynzappBackgroundTransfers")
    Events(TRANSFER_EVENT_NAME)

    AsyncFunction("isAvailable") { promise: Promise ->
      promise.resolve(true)
    }

    AsyncFunction("startUploadFile") { input: Map<String, Any?>, promise: Promise ->
      val transferId = enqueueTransfer(
        transferType = "upload",
        url = input.requiredString(TransferKeys.URL),
        fileUri = input.requiredString(TransferKeys.FILE_URI),
        method = input.optionalString(TransferKeys.METHOD) ?: "PUT",
        headers = input.headersJson()
      )
      promise.resolve(mapOf(TransferKeys.TRANSFER_ID to transferId))
    }

    AsyncFunction("startDownloadFile") { input: Map<String, Any?>, promise: Promise ->
      val transferId = enqueueTransfer(
        transferType = "download",
        url = input.requiredString(TransferKeys.URL),
        destinationUri = input.requiredString(TransferKeys.DESTINATION_URI),
        headers = input.headersJson()
      )
      promise.resolve(mapOf(TransferKeys.TRANSFER_ID to transferId))
    }

    AsyncFunction("getTransferStatus") { transferId: String, promise: Promise ->
      promise.resolve(
        SynzappBackgroundTransferStore.get(context, transferId)
          ?: SynzappBackgroundTransferStore.notFound(transferId)
      )
    }

    AsyncFunction("cancelTransfer") { transferId: String, promise: Promise ->
      val existingTransferType = SynzappBackgroundTransferStore.get(context, transferId)
        ?.get(TransferKeys.TRANSFER_TYPE) as? String
      workManager.cancelUniqueWork(transferId)
      SynzappBackgroundTransferStore.failed(
        context,
        transferId,
        existingTransferType ?: "download",
        "Background transfer was cancelled."
      )
      promise.resolve(null)
    }
  }

  private val context: Context
    get() = requireNotNull(appContext.reactContext) {
      "React Application Context is null"
    }.applicationContext

  private val workManager: WorkManager
    get() = WorkManager.getInstance(context)

  private fun enqueueTransfer(
    transferType: String,
    url: String,
    fileUri: String? = null,
    destinationUri: String? = null,
    method: String? = null,
    headers: String? = null
  ): String {
    val transferId = UUID.randomUUID().toString()
    val data = Data.Builder()
      .putString(TransferKeys.TRANSFER_ID, transferId)
      .putString(TransferKeys.TRANSFER_TYPE, transferType)
      .putString(TransferKeys.URL, url)
      .putString(TransferKeys.FILE_URI, fileUri)
      .putString(TransferKeys.DESTINATION_URI, destinationUri)
      .putString(TransferKeys.METHOD, method)
      .putString(TransferKeys.HEADERS_JSON, headers)
      .build()

    SynzappBackgroundTransferStore.running(
      context,
      transferId,
      transferType,
      destinationUri = destinationUri
    )

    val request = OneTimeWorkRequestBuilder<SynzappBackgroundTransferWorker>()
      .setConstraints(
        Constraints.Builder()
          .setRequiredNetworkType(NetworkType.CONNECTED)
          .build()
      )
      .setInputData(data)
      .build()

    workManager.enqueueUniqueWork(transferId, ExistingWorkPolicy.REPLACE, request)
    return transferId
  }

  private fun Map<String, Any?>.requiredString(key: String): String =
    optionalString(key) ?: throw IllegalArgumentException("$key is required.")

  private fun Map<String, Any?>.optionalString(key: String): String? =
    this[key] as? String

  @Suppress("UNCHECKED_CAST")
  private fun Map<String, Any?>.headersJson(): String {
    val headers = this["headers"] as? Map<String, Any?> ?: return "{}"
    val json = JSONObject()
    headers.forEach { (key, value) ->
      json.put(key, value?.toString() ?: "")
    }
    return json.toString()
  }
}
