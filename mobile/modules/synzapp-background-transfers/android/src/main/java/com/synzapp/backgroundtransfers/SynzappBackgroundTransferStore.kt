package com.synzapp.backgroundtransfers

import android.content.Context
import org.json.JSONObject

internal const val TRANSFER_EVENT_NAME = "onSynzappBackgroundTransferEvent"

internal object TransferKeys {
  const val BYTES_EXPECTED = "bytesExpected"
  const val BYTES_TRANSFERRED = "bytesTransferred"
  const val DESTINATION_URI = "destinationUri"
  const val ERROR_MESSAGE = "errorMessage"
  const val FILE_URI = "fileUri"
  const val HEADERS_JSON = "headersJson"
  const val METHOD = "method"
  const val PROGRESS = "progress"
  const val STATUS = "status"
  const val TRANSFER_ID = "transferId"
  const val TRANSFER_TYPE = "transferType"
  const val URL = "url"
}

internal object SynzappBackgroundTransferStore {
  private const val PREFS_NAME = "synzapp_background_transfers_v1"

  fun running(
    context: Context,
    transferId: String,
    transferType: String,
    bytesTransferred: Long = 0,
    bytesExpected: Long = 0,
    destinationUri: String? = null
  ) {
    save(
      context,
      mutableMapOf<String, Any?>(
        TransferKeys.TRANSFER_ID to transferId,
        TransferKeys.TRANSFER_TYPE to transferType,
        TransferKeys.STATUS to "running",
        TransferKeys.PROGRESS to progress(bytesTransferred, bytesExpected),
        TransferKeys.BYTES_TRANSFERRED to bytesTransferred.toDouble(),
        TransferKeys.BYTES_EXPECTED to bytesExpected.toDouble(),
        TransferKeys.DESTINATION_URI to destinationUri
      )
    )
  }

  fun completed(
    context: Context,
    transferId: String,
    transferType: String,
    bytesTransferred: Long,
    bytesExpected: Long,
    destinationUri: String? = null
  ) {
    save(
      context,
      mutableMapOf<String, Any?>(
        TransferKeys.TRANSFER_ID to transferId,
        TransferKeys.TRANSFER_TYPE to transferType,
        TransferKeys.STATUS to "completed",
        TransferKeys.PROGRESS to 1.0,
        TransferKeys.BYTES_TRANSFERRED to bytesTransferred.toDouble(),
        TransferKeys.BYTES_EXPECTED to maxOf(bytesExpected, bytesTransferred).toDouble(),
        TransferKeys.DESTINATION_URI to destinationUri
      )
    )
  }

  fun failed(
    context: Context,
    transferId: String,
    transferType: String,
    errorMessage: String,
    destinationUri: String? = null
  ) {
    save(
      context,
      mutableMapOf<String, Any?>(
        TransferKeys.TRANSFER_ID to transferId,
        TransferKeys.TRANSFER_TYPE to transferType,
        TransferKeys.STATUS to "failed",
        TransferKeys.PROGRESS to 0.0,
        TransferKeys.BYTES_TRANSFERRED to 0.0,
        TransferKeys.BYTES_EXPECTED to 0.0,
        TransferKeys.DESTINATION_URI to destinationUri,
        TransferKeys.ERROR_MESSAGE to errorMessage
      )
    )
  }

  fun notFound(transferId: String): Map<String, Any?> = mapOf(
    TransferKeys.TRANSFER_ID to transferId,
    TransferKeys.TRANSFER_TYPE to "download",
    TransferKeys.STATUS to "not_found",
    TransferKeys.PROGRESS to 0.0,
    TransferKeys.BYTES_TRANSFERRED to 0.0,
    TransferKeys.BYTES_EXPECTED to 0.0
  )

  fun get(context: Context, transferId: String): Map<String, Any?>? {
    val json = prefs(context).getString(transferId, null) ?: return null
    val snapshot = JSONObject(json)
    return snapshot.keys().asSequence().associateWith { key ->
      when (val value = snapshot.opt(key)) {
        JSONObject.NULL -> null
        else -> value
      }
    }
  }

  private fun save(context: Context, snapshot: Map<String, Any?>) {
    val transferId = snapshot[TransferKeys.TRANSFER_ID] as? String ?: return
    val json = JSONObject()
    snapshot.forEach { (key, value) ->
      json.put(key, value ?: JSONObject.NULL)
    }
    prefs(context).edit().putString(transferId, json.toString()).apply()
  }

  private fun progress(bytesTransferred: Long, bytesExpected: Long): Double {
    if (bytesExpected <= 0) {
      return 0.0
    }

    return (bytesTransferred.toDouble() / bytesExpected.toDouble()).coerceIn(0.0, 1.0)
  }

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
}
