package com.synzapp.deviceidentityvault

import com.google.android.gms.auth.blockstore.Blockstore
import com.google.android.gms.auth.blockstore.BlockstoreClient
import com.google.android.gms.auth.blockstore.DeleteBytesRequest
import com.google.android.gms.auth.blockstore.RetrieveBytesRequest
import com.google.android.gms.auth.blockstore.StoreBytesData
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Keeps this device's chat identity across an app reinstall.
 *
 * Uninstalling an Android app deletes its files, its preferences **and its
 * keystore entries**. So a reinstall came back as a stranger: a new identity, a
 * new device registration, and every message ever received sealed to a key that
 * no longer exists. The same person, on the same phone, could not read their own
 * conversation. On an iPhone none of this happens, because the keychain outlives
 * the app — which is why this only ever bit on Android.
 *
 * Google's Block Store exists for exactly this: a small secret, encrypted with a
 * key the app does not hold, that survives uninstall and reinstall of the same
 * app on the same device. It is what the platform offers in place of the
 * keychain guarantee iOS gives for free.
 *
 * **It is a best effort and must be treated as one.** Block Store keeps data
 * across a reinstall only where the person has Google backup switched on, and
 * it is absent on a phone with no Play services at all. Every call here answers
 * with null rather than failing, and the escrowed-key restore stays as the
 * fallback for the phones this cannot help.
 */
class SynzappDeviceIdentityVaultModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SynzappDeviceIdentityVault")

    /**
     * The identity kept for this key, or null if there is none to give.
     *
     * Null covers every ordinary reason — nothing stored yet, backup switched
     * off, no Play services — because none of them is an error the app can do
     * anything about, and all of them mean the same thing to the caller.
     */
    AsyncFunction("read") { key: String, promise: Promise ->
      runCatching {
        val request = RetrieveBytesRequest.Builder()
          .setKeys(listOf(key))
          .build()

        client().retrieveBytes(request)
          .addOnSuccessListener { response ->
            val stored = response.blockstoreDataMap[key]?.bytes

            promise.resolve(stored?.let { String(it, Charsets.UTF_8) })
          }
          .addOnFailureListener { promise.resolve(null) }
      }.onFailure { promise.resolve(null) }
    }

    /**
     * Keeps the identity for the next install of this app.
     *
     * `shouldBackupToCloud` is deliberately **false**: this is the key to a
     * person's messages, and it should stay on the handset it belongs to rather
     * than travel to a new phone with a restored backup. Surviving a reinstall
     * is the whole requirement; moving between devices is not, and would widen
     * where the key can end up.
     */
    AsyncFunction("write") { key: String, value: String, promise: Promise ->
      runCatching {
        val data = StoreBytesData.Builder()
          .setBytes(value.toByteArray(Charsets.UTF_8))
          .setKey(key)
          .setShouldBackupToCloud(false)
          .build()

        client().storeBytes(data)
          .addOnSuccessListener { promise.resolve(true) }
          .addOnFailureListener { promise.resolve(false) }
      }.onFailure { promise.resolve(false) }
    }

    /** Forgets it, for when somebody is signed out of the company for good. */
    AsyncFunction("clear") { key: String, promise: Promise ->
      runCatching {
        val request = DeleteBytesRequest.Builder()
          .setKeys(listOf(key))
          .build()

        client().deleteBytes(request)
          .addOnSuccessListener { promise.resolve(true) }
          .addOnFailureListener { promise.resolve(false) }
      }.onFailure { promise.resolve(false) }
    }
  }

  private fun client(): BlockstoreClient = Blockstore.getClient(appContext.reactContext!!)
}
