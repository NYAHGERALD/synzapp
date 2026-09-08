# Synzapp Enterprise Native Media Pipeline Plan

## Purpose

Synzapp chat media must feel immediate, offline-first, and enterprise-grade for large photos, videos, documents, audio, and mixed media albums. A user should be able to select an 80 MB, 200 MB, or policy-approved larger video and keep chatting while Synzapp prepares, encrypts, uploads, syncs, and hydrates the receiving device in the background.

The product target is WhatsApp-class responsiveness with enterprise controls, tenant isolation, end-to-end encryption, auditability, revocation, and offline cache governance.

## Current Problem

The old mobile path kept too much media work in JavaScript and too close to the foreground interaction:

- The Expo image picker must return an exported file before Synzapp can show the media review screen.
- Video thumbnail generation is done during picker preparation, before the user can send.
- If iOS cannot export a Photos/iCloud video quickly, the user sees a failure instead of a controlled native preparation flow.
- Large media preparation can make the chat feel slow because CPU, file copy, thumbnail generation, encryption, and upload are too close to the foreground interaction.
- Large media encryption used `tweetnacl` in JavaScript and base64 file reads/writes, which is not a WhatsApp/Teams-class architecture for 40 MB+ videos.

## Enterprise UX Principles

- The selected media appears immediately in a review surface or local outgoing bubble.
- Chat input remains usable while media prepares and uploads.
- Large media work is resumable, cancellable, and visible through compact status states.
- No custom error card should replace native alerts where Synzapp already uses native alert prompts.
- The sender sees local preview/playback from the device when possible.
- The receiver gets metadata and thumbnail first, then background hydration makes playback feel offline.
- Tenant policy controls maximum file size, Wi-Fi-only prefetch, cache retention, and mobile-data behavior.
- Revoked users lose local tenant media and metadata through the existing company-data wipe path.

## Target Architecture

### 1. Native Asset Intake

Use platform-native asset handles instead of forcing a complete foreground export before Synzapp can continue.

On iOS:

- Present `PHPickerViewController` or a native Photos picker bridge.
- Capture selected asset identifiers and lightweight metadata immediately.
- Use PhotoKit `PHImageManager`/`PHAssetResourceManager` for background export/download.
- Track iCloud download progress with native progress events.
- Export to the Synzapp media cache directory with cancellation support.
- Generate poster frames with AVFoundation only after the review UI is already visible.

On Android:

- Use the Android Photo Picker or Storage Access Framework URI.
- Persist URI permissions when available.
- Stream/copy into Synzapp cache through WorkManager.
- Generate thumbnails with a background worker.

### 2. Local Outgoing Message First

After the user taps send:

- Create a local pending message immediately.
- Store local asset/cache references, dimensions, duration, size, and transfer status.
- Show the message bubble as `queued` or `preparing`.
- Continue export, thumbnail, encryption, and upload outside the main interaction path.

### 3. Media Outbox Worker

The outbox owns the lifecycle:

- `selected` -> `preparing` -> `encrypting` -> `uploading` -> `available`
- `failed` with retry, cancel, and resend support
- Persistent native transfer IDs for upload/download
- Chunked encryption and upload for large files
- Backpressure to avoid multiple large videos freezing the app

### 3.1 Versioned Native Media Crypto

Synzapp must not keep large-media encryption in the JavaScript foreground path. New large media should use a versioned native AEAD media format:

- Existing media remains readable through `secretbox-v1` and `chunked-secretbox-v1`.
- New large media uses `native-chacha20poly1305-chunked-v1`.
- iOS uses CryptoKit `ChaChaPoly` chunk sealing.
- Android uses platform `ChaCha20-Poly1305/NoPadding` chunk sealing.
- Each chunk has an independent random nonce and authentication tag.
- The backend stores only encrypted bytes and does not receive plaintext.
- Media keys and chunk nonces remain inside the existing encrypted chat message envelope.
- The receiver decrypts natively into the local media cache so large downloads do not require JS/base64 reconstruction.
- If native AEAD is unavailable, the app falls back to the legacy Secretbox path without changing old message semantics.

### 4. Thumbnail And Poster Strategy

- Do not block send on a poster frame.
- Show a professional video placeholder when no poster is ready.
- Generate poster frames in the background and update the local message row.
- Send thumbnail metadata first when available.
- Never duplicate loading spinners on the same media tile.

### 5. Receiver Offline Feel

- Realtime delivers encrypted message metadata immediately.
- Receiver shows thumbnail or placeholder immediately.
- Wi-Fi/unmetered policy hydrates media automatically.
- Mobile data follows tenant/user policy.
- Viewer opens instantly and either plays cached media or shows download progress.

### 6. Security And Compliance

- Plain media stays local-only and cache-governed.
- Backend stores encrypted media only.
- Media keys remain per item and are delivered through encrypted message envelopes.
- Transfer queue metadata must not contain message plaintext.
- Tenant wipe clears local media, queue state, thumbnails, and cached decrypted files.

## Implementation Phases

## Phase Status

- [x] Phase 1: Foreground Responsiveness Foundation
- [ ] Phase 2: Native Asset Intake Module
  - [x] Native package registered in the mobile workspace.
  - [x] Shared TypeScript contract added for native selected-asset metadata.
  - [x] iOS PHPicker bridge foundation added for immediate lightweight asset metadata.
  - [x] iOS PhotoKit export/download foundation added with native progress events and cache output.
  - [x] Native cancellation bridge added for active iOS preparation requests.
  - [x] Shared TypeScript preparation wrapper added for queue integration.
  - [x] Android module registration added with a safe unavailable stub.
  - [x] Android SAF picker foundation added with persisted URI permissions.
  - [x] Android cache-copy preparation foundation added with progress and cancellation.
  - [x] iOS CocoaPods integration completed for `SynzappNativeMedia`.
  - [x] iOS native module target compile verified on simulator.
  - [x] Android native module Kotlin compile verified.
  - [x] Chat library review/send flow wired to use native selected assets without foreground blocking.
  - [ ] Physical-device validation with local and iCloud-backed large videos.
- [ ] Phase 3: Persistent Preparation Queue
  - [x] Local SQLite media preparation table added with tenant/owner scoping and encrypted payloads.
  - [x] Native asset preparation routed through a persistent queue before encrypted upload.
  - [x] Preparation progress is reflected on the existing outgoing message bubble as `preparing`.
  - [x] Service-level cancel, retry, and resume primitives added.
  - [x] Interrupted preparation can be retried from pending messages after app restart.
  - [x] Pre-upload native-file validation now happens before encrypted upload conversion.
  - [x] Background poster-frame generation worker.
  - [x] Successful upload and deleted pending-message cleanup removes stale preparation queue records.
  - [ ] Physical-device validation with large local and iCloud-backed media after app restart.
- [x] Phase 4: Native Background Encryption/Upload Worker
  - [x] Adaptive large-media chunk size added to reduce JS encryption stalls on big videos/files.
  - [x] Chunk nonce metadata is persisted incrementally instead of only at final completion.
  - [x] Uploaded part indexes are tracked in upload recovery state.
  - [x] Backend completion retry path avoids replaying completed native uploads after offline completion failures.
  - [x] Recovery guard only marks chunked uploads available when encrypted metadata is complete.
  - [x] Large-media upload worker lane added to prevent multiple huge encryption loops from competing in foreground JS.
  - [x] Pending-message deletion cancels native background media transfers and clears transfer queue records.
  - [x] Bounded native multipart part-upload orchestration added for encrypted chunks.
  - [x] App start/active recovery reconciles native uploads before retrying pending message sync.
  - [x] Recovered uploaded media is written back into the pending outbox before resend.
  - [x] Native media pipeline capability contract added for killed-app Secretbox readiness.
  - [x] Native-owned resumable chunk batch orchestration added for encrypted chunk uploads through background transfer workers.
  - [x] Stale encrypted upload working-file cleanup added for interrupted/killed-app recovery.
  - [x] Versioned native AEAD media encryption mode added for new large media.
  - [x] iOS native chunked ChaCha20-Poly1305 encryption/decryption worker added.
  - [x] Android native chunked ChaCha20-Poly1305 encryption/decryption worker added.
  - [x] Sender upload path prefers native AEAD for large videos/photos/files and falls back to Secretbox when unavailable.
  - [x] Receiver download path decrypts native AEAD media natively into the local cache.
  - [x] Chat and encrypted-message normalizers preserve the new native media encryption mode.
  - [ ] Physical-device validation with killed app during native encryption/upload.
- [x] Phase 5: Receiver Hydration
  - [x] Receiver auto-hydration prioritizes thumbnails/small images before heavier media.
  - [x] Videos and documents hydrate according to offline/network policy instead of blindly downloading.
  - [x] File/document rows use the shared compact media transfer overlay instead of a separate spinner.
  - [x] Download progress continues to persist through the local transfer queue and native background transfer status.
  - [ ] Physical-device validation with mixed large media history on sender and receiver devices.
- [x] Phase 6: Enterprise Controls And Observability
  - [x] Tenant media limits by type are stored in backend offline chat policy.
  - [x] Mobile sender enforcement uses active tenant media limits.
  - [x] Wi-Fi-only policies and cache budgets remain wired to backend policy and local enforcement.
  - [x] Admin usage metrics include transfer counts, failures, total bytes, large media counts, cache size, and queue depth.
  - [ ] Physical-device validation tests with large mixed histories.

### Phase 1: Foreground Responsiveness Foundation

- Use native alerts for media preparation failures.
- Stop blocking video intake on poster generation.
- Do not render video file URIs through image components when no poster exists.
- Keep selected media order stable with bounded preparation concurrency.
- Preserve current encrypted upload and pending-message behavior.

Status: Completed and verified.

Implementation notes:

- Media preparation failures now use native `Alert.alert` prompts.
- Video selection no longer blocks on poster-frame extraction in `chatAttachmentPicker`.
- Video preview URI resolution no longer falls back to raw video file URIs for image components.
- Multiple selected media items are prepared with bounded concurrency so the UI avoids both sequential delay and unbounded CPU pressure.
- Verified with `npm run typecheck`.
- Verified with `npm run build:preflight`.

### Phase 2: Native Asset Intake Module

- Add `SynzappNativeMediaPicker` Expo module.
- iOS: PHPicker + PhotoKit asset export with iCloud progress events.
- Android: Android Photo Picker/SAF bridge with persisted URI permissions.
- Return lightweight selected assets immediately, then emit preparation progress.

Status: Code-complete for the currently approved dependency set. Physical-device validation is still required.

Implementation notes:

- Added local Expo module package `synzapp-native-media`.
- Added iOS `SynzappNativeMediaModule` with `PHPickerViewController` asset selection, selected asset identifiers, dimensions, duration, content type, file name, and fast thumbnail metadata when available locally.
- Added iOS native `prepareMediaAsset` foundation that uses PhotoKit asset resources, allows iCloud/network access, writes media into the Synzapp native media cache, and emits preparation progress events.
- Hardened iOS video preparation with a `PHImageManager.requestAVAsset` fallback so iCloud-backed videos can be downloaded/exported by Photos when direct `PHAssetResourceManager` streaming fails.
- Added iOS native cancellation for active PhotoKit preparation requests using the cancellable `PHAssetResourceManager.requestData` request ID.
- Added Android `SynzappNativeMediaModule` SAF picker support with persisted URI permissions, lightweight metadata extraction, cache-copy preparation, progress events, and cancellation.
- Added `nativeMediaPicker` TypeScript service wrapper for capability checks, normalized selected-asset results, native preparation calls, and cancellation.
- Wired chat library selection to prefer native asset handles, display the review surface immediately using native metadata/thumbnails, then prepare the real local cache file in the queued send worker before encrypted upload.
- Removed the unsafe iOS library fallback to Expo ImagePicker, because that path forces foreground local-copy export and can reject cloud-backed videos before the native pipeline can handle them.
- Preserved the existing camera and document paths so current working flows remain unchanged while Photos/library media moves onto the native intake foundation.
- Registered the package through the mobile workspace dependency graph.
- Integrated `SynzappNativeMedia` into the iOS CocoaPods workspace.
- Verified with `npm run typecheck`.
- Verified with `npm run build:preflight`.
- Verified with `xcodebuild -workspace ios/Synzapp.xcworkspace -scheme SynzappNativeMedia -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' build`.
- Verified Android module Kotlin compilation with `./gradlew :synzapp-native-media:compileDebugKotlin` using the local Android SDK and corrected `JAVA_HOME`.

Remaining before Phase 2 completion:

- Validate on physical iPhone and Android with local Photos, iCloud-backed videos, 80 MB+ videos, mixed media, app backgrounding, and cancellation/retry.

### Phase 3: Persistent Preparation Queue

- Add local SQLite media preparation table.
- Move file copy, poster creation, and pre-upload validation into queue workers.
- Add cancel/retry/resume actions.
- Recover interrupted preparation after app restart.

Status: Code-complete for the currently approved dependency set. Physical-device validation is still required.

Implementation notes:

- Added `local_chat_media_preparation_queue` to the encrypted local chat SQLite store.
- Added preparation queue APIs for listing, upserting, and removing tenant-scoped preparation records.
- Added `chatMediaPreparationQueue` service to persist selected native asset preparation, retry failed/in-progress preparation, cancel native preparation requests, and reuse ready prepared media when available.
- Added `preparing` as a first-class chat media transfer status so outgoing bubbles do not disappear or flicker while Photos/iCloud/SAF preparation is running.
- Routed native library media through the persistent preparation queue before `toLocalChatMediaInput` and encrypted upload.
- Added a non-blocking video poster worker that generates poster thumbnails after the native media file is prepared and updates the local outgoing bubble/message row when ready.
- Added cleanup so successful uploads and deleted pending messages remove stale preparation queue records and request native preparation cancellation when needed.
- Kept existing camera, file, encrypted upload, pending message, and background transfer paths intact.
- Verified with `npm run typecheck`.
- Verified with `npm run build:preflight`.

Remaining before Phase 3 completion:

- Validate on physical iPhone and Android with 80 MB+ local videos, iCloud-backed videos, mixed media, cancellation, app force-close, reopen, retry, and send.

### Phase 4: Native Background Encryption/Upload Worker

- Move large-file chunk encryption out of the JS foreground loop where possible.
- Preserve end-to-end encryption semantics.
- Persist upload session metadata before starting native background work.
- Complete backend upload sessions without replaying finished encrypted chunks.

Status: Code-complete for the currently approved dependency set. Physical-device validation is still required.

Implementation notes:

- Added adaptive chunk sizing so large videos/files use smaller interactive chunks, reducing foreground JS stalls during secretbox encryption.
- Preserved existing end-to-end encryption: per-media keys, per-part nonces, local-only plaintext, and encrypted backend uploads are unchanged.
- Persisted partial chunk nonce metadata in upload recovery state as each part is encrypted.
- Added uploaded part index tracking to the encrypted local media transfer queue payload.
- Hardened native transfer reconciliation so a completed native upload only becomes `available` when the stored encrypted metadata is complete.
- If native background upload completes but the backend completion call fails due to network loss, Synzapp keeps the recovery item retryable and later completes the backend session without replaying the encrypted upload.
- Added a large-media upload worker lane so only one oversized encrypted chunk pipeline runs at a time, reducing UI freezes when multiple large videos/files are queued.
- Exposed native background-transfer cancellation to TypeScript and wired pending-message deletion to cancel active native transfer IDs and clear local transfer records.
- Added bounded native multipart orchestration so encrypted chunk files upload through native background transfers with limited parallelism instead of strictly waiting for each part before preparing the next batch.
- Sequenced app start/active recovery so native transfer reconciliation runs before pending-message sync, preventing completed native uploads from being replayed.
- Recovered uploaded media is now patched into the pending outbox message before retrying `sendChatMessage`, so the final chat send uses the restored encrypted metadata.
- Added native media pipeline capability reporting on iOS, Android, and TypeScript. The contract explicitly reports that native killed-app Secretbox encryption is unavailable with the current platform crypto APIs, because Synzapp must preserve `nacl-secretbox-xsalsa20-poly1305`/`chunked-secretbox-v1` compatibility rather than silently switching algorithms.
- Added stale encrypted upload working-file cleanup so interrupted native upload recovery does not leave old `upload_*.bin` and `upload_part_*.bin` files in cache indefinitely.
- Verified with `npm run typecheck`.
- Verified with `npm run build:preflight`.

Important security boundary:

- The app does not reinterpret old `secretbox-v1` or `chunked-secretbox-v1` media. Those remain legacy-compatible.
- New large media uses an explicitly versioned native AEAD format: `native-chacha20poly1305-chunked-v1`.
- Physical iPhone/Android validation must still force-close the app during large media encryption, native upload, and backend completion before calling the whole native media pipeline production-validated.

WhatsApp/Teams-class acceptance bar:

- A common 40 MB video should create an outgoing bubble immediately.
- Chat input must remain responsive while encryption and upload continue.
- No static video review screen should block video sending unless the user is editing/captioning media.
- Native encryption must not base64 round-trip large media through JavaScript.
- Receiver hydration must download and decrypt in the background and open from local cache when available.

### Phase 5: Receiver Hydration

- Prioritize thumbnails and small images.
- Hydrate videos/documents according to network policy.
- Add compact per-item download state and one consistent progress overlay.

Status: Code-complete for the current receiver hydration pass. Physical-device validation is still required.

Implementation notes:

- Replaced first-come automatic receiver downloads with ranked hydration candidates. Synzapp now hydrates small images first, then lightweight media, while keeping videos and documents behind the existing network/offline policy.
- Kept sender/receiver encryption unchanged: hydration still downloads encrypted media through the existing backend session, native background transfer, and local decryption path.
- Preserved the local transfer queue so native download progress, failure, and recovery can be reconciled after app restart.
- Removed the separate document-row spinner and routed document/file transfer state through the shared compact media progress overlay used by photo/video albums.
- Verified with `npm run typecheck`.
- Verified with `npm run build:preflight`.

### Phase 6: Enterprise Controls And Observability

- Tenant media limits by type.
- Wi-Fi-only policies and cache budgets.
- Admin usage metrics for large media transfer volume and failures.
- Device validation tests with large mixed histories.

Status: Code-complete for enterprise controls and local observability. Backend deployment and physical-device validation are still required.

Implementation notes:

- Extended tenant chat offline policy with per-type media limits for audio, documents/files, photos, and videos.
- Wired mobile policy loading/saving so the active tenant media limits drive sender-side size enforcement and receiver auto-hydration policy.
- Preserved existing Wi-Fi-only prefetch, cache budget, retention, and purge controls.
- Added Org Admin controls in Offline Chat settings with native switches and explicit native value pickers for enterprise-safe media limits by type.
- Retuned encrypted chunk upload for ordinary large media so a 40 MB video no longer becomes roughly 40 tiny 1 MB encrypt/write/upload parts. Standard large media now uses larger encrypted chunks and higher native part-upload concurrency while preserving `chunked-secretbox-v1` compatibility.
- Changed video-only media selection to skip the static review screen and queue directly into the chat bubble, because native-picked videos may only have a lightweight thumbnail before preparation and should not pretend to be playable in a pre-send photo-style preview.
- Extended local offline chat metrics with upload/download byte volume and large-media transfer counts, alongside existing success/failure counters, queue depth, cache size, and timing samples.
- Verified with `npm run typecheck`.
- Verified with `npm run build:preflight`.
- Verified mobile policy/metrics tests with `npx vitest run src/services/chatOfflineMetrics.test.ts src/services/chatOfflineSettings.test.ts`.
- Verified backend policy schema changes with `npm run typecheck`.

## Phase 1 Acceptance Criteria

- Large video selection no longer waits on poster-frame generation.
- A video without a generated poster shows a clean placeholder instead of flickering.
- Media preparation failures use native alert prompts.
- Multiple selected items are prepared with bounded concurrency.
- Typecheck passes.

## Approval Boundary

Phase 1 has been completed.

Phase 2 has started after approval. It is not marked complete until Android intake, cancellation, chat-flow integration, and physical-device validation are complete.

Phase 3 has started after approval and is implemented through the persistent preparation queue foundation. It is not marked complete until physical-device recovery validation is done.

Phases 4 through 6 still require explicit approval before implementation because they change encrypted transfer orchestration, receiver hydration behavior, and enterprise policy surfaces.
