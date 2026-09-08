# Synzapp WhatsApp-Class Instant Media Delivery Plan

## Purpose

Sending a video, photo, document, or audio clip in Synzapp chat must feel instant and offline-first, exactly like WhatsApp:

- The bubble appears the moment the user taps send and **never** disappears, duplicates, or flickers.
- A one-minute phone video reaches the recipient in seconds, not minutes.
- The sender keeps chatting, backgrounds the app, or loses signal, and the transfer survives.

This plan documents the measured root causes of the current behaviour, the target architecture, and the implementation.

## Reported Symptoms

1. Video takes a very long time to send.
2. The outgoing video bubble disappears from the thread and reappears, "like a flashing lamp".

Both symptoms are real and both have specific, identified causes in the current code.

## Root Cause Analysis

### RC-1 — Synzapp uploads the original camera bytes. There is no video transcoding anywhere.

`prepareVideoMedia` in [chatAttachmentPicker.ts:239-277](src/services/chatAttachmentPicker.ts#L239-L277) returns the picked asset URI unchanged. It records `sizeBytes`, checks it against a limit, and returns. There is no compression step.

On iOS the native intake path is worse than neutral: `SynzappNativeMediaModule.swift:562` builds its export session with `AVAssetExportPresetPassthrough`, which is explicitly a *copy*, not a transcode.

Photos get compressed (`compress: 0.54`, `quality: 0.68` in the picker). Videos get nothing.

The practical consequence, for the 1:01 video in the reported case:

| | Modern phone camera original | WhatsApp-class target |
|---|---|---|
| 1080p60 / 4K, 1 minute | 90 MB – 400 MB | 6 MB – 15 MB |

Synzapp then **encrypts and uploads every one of those bytes**. The chat media video limit is `250 MB` ([chatMediaApi.ts:24](src/services/chatMediaApi.ts#L24)), so a quarter-gigabyte upload is not only possible, it is permitted and routine. This is a 10×–30× multiplier on encryption time, upload time, and recipient download time. It is the dominant cause of RC-1.

### RC-2 — The same video is copied at full size three or four times before a byte leaves the device.

For a native-picked video the file is written end-to-end:

1. PhotoKit / SAF export into `Caches/SynzappNativeMedia/` (native prepare).
2. `cacheLocalChatMedia` ([chatMediaApi.ts:110-155](src/services/chatMediaApi.ts#L110-L155)) does a full `FileSystem.copyAsync` into `Caches/Synzapp/Media/`.
3. `cacheOriginalMediaUri` may copy the original a third time.
4. Native AEAD encryption writes a fourth full-size file.

Step 2 is pure waste. It exists because `isSynzappMediaCacheUri` ([chatMediaApi.ts:1208-1212](src/services/chatMediaApi.ts#L1208-L1212)) only recognises `Caches/Synzapp/Media/` and `Documents/Synzapp/Media/`. It does not recognise `Caches/SynzappNativeMedia/`, which is exactly where the native picker and the native crypto worker write ([SynzappNativeMediaModule.swift:658, 923](modules/synzapp-native-media/ios/SynzappNativeMediaModule.swift#L658)). Every natively prepared asset therefore fails the "already cached" check and gets copied again.

At 200 MB that is a redundant 200 MB read + 200 MB write on the device's flash before encryption even begins.

### RC-3 — The outgoing bubble has two different identities, and the thread cannot tell they are the same message.

This is the flashing lamp.

An outgoing message exists under one ID while it is local and a **completely different** ID once the server has it:

| Stage | `message.messageId` | Source |
|---|---|---|
| Local, queued / uploading | the outbox `queueId` | pending outbox |
| Server echo over realtime | `envelope.envelopeId` | [chatEncryption.ts:250](src/services/chatEncryption.ts#L250) |

`decryptRealtimeEncryptedEnvelopes` sets `messageId: envelope.envelopeId` and **discards `envelope.clientMessageId`**, even though the backend faithfully returns it (`mapEncryptedGroupEnvelopeForDevice`, [groupChatService.ts:2454](../backend/src/services/groupChatService.ts#L2454)) and the client sent it (`clientMessageId: latestPendingMessage.queueId`, [AdminChatScreen.tsx:7922](src/screens/AdminChatScreen.tsx#L7922)).

`uniqueChatMessages` ([AdminChatScreen.tsx:37089-37101](src/screens/AdminChatScreen.tsx#L37089-L37101)) de-duplicates strictly on `messageId`. Two IDs means no de-duplication. So does `buildMessageThreadItems`, which keys each `FlatList` row as `` `message-${message.messageId}` `` ([AdminChatScreen.tsx:35475](src/screens/AdminChatScreen.tsx#L35475)) — when the ID changes, React unmounts the row and mounts a new one.

### RC-4 — The outbox record is deleted before the sent message is committed, opening a window where the bubble exists nowhere.

In `syncPendingMessagesForChat` ([AdminChatScreen.tsx:7920-7948](src/screens/AdminChatScreen.tsx#L7920-L7948)) the order is:

```
1. await sendChatMessage(...)            // server now has it; realtime starts broadcasting
2. await removePendingChatMessage(...)   // outbox no longer has it
3. void updateSyncedPendingMessage(...)  // NOT awaited — commits to state + cache later
```

Every thread-refresh path rebuilds the visible list as `cached conversation + pending outbox`:

- realtime conversation events — [AdminChatScreen.tsx:4839-4842](src/screens/AdminChatScreen.tsx#L4839-L4842)
- push hydration — [AdminChatScreen.tsx:7519-7522](src/screens/AdminChatScreen.tsx#L7519-L7522)
- pagination — [AdminChatScreen.tsx:7668](src/screens/AdminChatScreen.tsx#L7668)
- trash / segment reads — [AdminChatScreen.tsx:7801](src/screens/AdminChatScreen.tsx#L7801)

And queued messages are deliberately **excluded from the conversation cache** (`persistedSentMessages = nextCachedMessages.filter(m => m.deliveryStatus !== 'queued')`, [AdminChatScreen.tsx:8017](src/screens/AdminChatScreen.tsx#L8017)). The outbox is therefore the *only* home for an in-flight bubble.

Combine that with the un-awaited step 3 and the result is deterministic:

```
t0  send succeeds, server broadcasts envelope
t1  outbox record removed          -> bubble now exists in NEITHER cache NOR outbox
t2  realtime event fires, rebuilds list from cache + outbox
    -> setMessages(...) WITHOUT the video     ***BUBBLE DISAPPEARS***
t3  updateSyncedPendingMessage finally commits the sent message
    -> setMessages(...) WITH the video        ***BUBBLE REAPPEARS***
```

And because of RC-3, whenever the realtime echo lands *before* t1 the opposite happens: the same video renders twice under two IDs, then one vanishes. Disappear, duplicate, reappear — the flashing lamp, from both directions.

### RC-5 — `chatContactUpdated` rebuilds the thread from cache and never re-merges the outbox

Found after the first round of fixes failed to stop the flashing on device.

The four refresh paths listed under RC-4 all merge `cache + outbox`. The `chatContactUpdated` realtime handler does **not** — it never touches the outbox at all, which is why it was not in that list. Both of its branches call `setMessages` with a purely cache-derived list:

```js
// branch 1 - new envelopes delivered
const mergedMessages = uniqueChatMessages([...cachedConversation.messages, ...deliveredMessages]);
setMessages(visibleMergedMessages);                       // no outbox merge

// branch 2 - contact/reaction update only
cachedConversation?.messages || messagesRef.current
setMessages(reactedMessages);                             // no outbox merge
```

Branch 2 is especially damaging: it prefers the cache whenever one exists and only falls back to live state when there is none — so the moment a conversation has ever been cached, an in-flight bubble is dropped.

Because queued messages are excluded from the conversation cache (RC-4), every one of these events erases in-flight sends. `chatContactUpdated` fires on presence changes, read receipts, and the other party's activity — repeatedly, throughout a long upload. Each one blanks the bubble; the next progress tick or `conversationMessages` event (which *does* merge the outbox) restores it. That is the flashing lamp, and it is independent of RC-3 and RC-4.

### RC-6 — The iOS transcoder deadlocked on its own dispatch queue

A defect in the Phase B implementation, not in the pre-existing code.

`transcode()` dispatches `run()` onto a single serial queue. `encode()` then scheduled the `AVAssetWriterInput` callbacks onto **that same serial queue** and immediately called `group.wait()` on it:

```swift
videoInput.requestMediaDataWhenReady(on: queue) { ... }   // same serial queue
group.wait()                                              // blocks that queue
```

A blocked serial queue can never service the callbacks scheduled onto it, so no sample was ever written and the group never completed. Every iOS transcode hung forever, the promise never resolved, and the send stalled behind it — making sends *slower*, not faster.

### Summary

| # | Root cause | Symptom |
|---|---|---|
| RC-1 | No video transcoding; original 90–400 MB bytes are encrypted and uploaded | Slow send |
| RC-2 | Redundant full-size cache copy of every natively prepared asset | Slow send, disk churn |
| RC-3 | Local `queueId` and server `envelopeId` are different identities; `clientMessageId` is discarded on decrypt | Duplicate bubble, row remount |
| RC-4 | Outbox record deleted before the sent message is committed to cache | Bubble disappears then returns |
| RC-5 | `chatContactUpdated` rebuilds the thread from cache with no outbox merge | Bubble disappears then returns, repeatedly |
| RC-6 | iOS transcoder deadlocked on its own serial dispatch queue | Send stalls indefinitely |

RC-3, RC-4, and RC-5 are the flashing lamp. RC-1, RC-2, and RC-6 are the slowness.

### Lesson: the outbox merge must be structural

RC-4 and RC-5 are the same mistake in two places, and fixing RC-4 call-site by call-site is what let RC-5 survive. Any code path that rebuilds the visible thread from the conversation cache **must** re-merge the outbox, because the cache deliberately excludes in-flight messages. That is now funnelled through one helper, `withPendingOutboxMessages`, rather than being remembered independently at each call site.

## Target Architecture

### Principle 1 — One message, one identity, for its whole life

A message gets a client-generated identity at creation and keeps it forever. The server's `envelopeId` is a *transport* identifier used for server operations; it is never the thread's notion of "which message is this".

- `ChatMessage` carries `clientMessageId`.
- Decrypted envelopes restore `clientMessageId` from the envelope.
- `getChatMessageIdentityKey(message) = clientMessageId || messageId` is the single de-duplication and React-key authority.
- The pending outbox stamps `clientMessageId = queueId`.

The pending bubble and its server echo now collapse into one row, and the row's React key never changes. No duplicate, no remount.

### Principle 2 — Never delete the outbox record until the message is committed somewhere else

`updateSyncedPendingMessage` is awaited *before* `removePendingChatMessage`. The bubble is always readable from at least one of {conversation cache, pending outbox}. The gap in RC-4 closes.

Deletion is unconditional even if the commit throws, so a commit failure can never strand a message in the outbox and resend it forever.

### Principle 3 — Send a WhatsApp-sized video, not a camera-sized one

A native transcoder converts the picked video before encryption:

| Quality mode | Long edge | Video bitrate | Audio | ~1 min result |
|---|---|---|---|---|
| `data_saver` | 480 px | 0.6 Mbps | 64 kbps AAC mono | ~5 MB |
| `standard` (default) | 848 px | 2.0 Mbps | 96 kbps AAC | ~15 MB |
| `hd` | 1280 px | 4.5 Mbps | 128 kbps AAC | ~35 MB |

Rules:

- Transcode is skipped when it would not help — the source is already smaller than the target's projected size, or already below the "small video" floor.
- Transcode never blocks the bubble. It runs in the preparation queue, behind an already-visible `preparing` bubble, and reports progress.
- **Transcode failure is never a send failure.** Any error, unsupported codec, or missing native module falls back to the original file and the current behaviour.
- Output is H.264 + AAC in MP4 — the maximally compatible envelope, same as WhatsApp.
- Encryption, chunking, upload, and receiver hydration are untouched. The transcoder only changes *how many bytes* enter that pipeline.

### Principle 4 — Copy the file zero extra times

`isSynzappMediaCacheUri` recognises the native media cache directory, so a natively prepared or natively transcoded file goes straight into encryption with no intermediate copy.

## Security Boundary

Unchanged. This plan does not touch the encryption contract:

- Transcoding happens **before** encryption, on plaintext that is already on the device, in app-private cache.
- `native-chacha20poly1305-chunked-v1`, `chunked-secretbox-v1`, and `secretbox-v1` semantics are untouched.
- The backend still receives only ciphertext.
- `clientMessageId` was already transmitted and already stored by the backend. Restoring it on the client reveals nothing new; it is inside the authenticated envelope metadata.
- Transcoded plaintext lands in the existing governed media cache and is covered by the existing tenant wipe and cache-budget paths.

## Implementation

### Phase A — Stable outgoing message identity (fixes the flashing lamp)

- [x] A1. Add `clientMessageId?: string` to `ChatMessage`.
- [x] A2. Restore `clientMessageId` from the envelope in `decryptRealtimeEncryptedEnvelopes`.
- [x] A3. Add `getChatMessageIdentityKey` and route `uniqueChatMessages` through it.
- [x] A4. Key `FlatList` thread rows on the identity key so the row never remounts on the queued→sent transition.
- [x] A5. Stamp `clientMessageId = queueId` on locally created outgoing messages.
- [x] A6. Preserve `clientMessageId` through the local-state merge and the local store round-trip.
- [x] A7. Await the synced-message commit before removing the outbox record; remove unconditionally on failure.
- [x] A8. Reconcile `updateSyncedPendingMessage` on the identity key rather than the raw `messageId`.
- [x] A9. Route the `chatContactUpdated` handler's two cache-derived `setMessages` calls through `withPendingOutboxMessages` (RC-5).
- [x] A10. Collapse messages that agree on *either* identifier, so history cached before `clientMessageId` existed does not duplicate against a freshly fetched copy that carries it.

### Phase B — Native video transcoding (fixes the slow send)

- [x] B1. `transcodeVideo` / `cancelVideoTranscode` contract on `synzapp-native-media`.
- [x] B2. iOS transcoder — `AVAssetReader`/`AVAssetWriter` H.264 + AAC with explicit bitrate control, aspect-preserving downscale, progress events, cancellation.
- [x] B3. Android transcoder — `MediaCodec` decode→encode through an EGL surface bridge with `MediaMuxer` output, progress events, cancellation.
- [x] B4. `nativeVideoTranscoder` TypeScript wrapper with capability detection and a total fail-safe fallback.
- [x] B5. Quality-mode bitrate ladder shared by both platforms.
- [x] B6. Wire the transcoder into the media preparation queue so it runs behind an already-visible bubble.
- [x] B8. Run the iOS writer-input callbacks on dedicated queues so `group.wait()` cannot deadlock them (RC-6), and finish each side exactly once so a repeated ready-for-data callback cannot trap on a double `group.leave()`.
- [x] B9. Log every transcode outcome — skipped, declined, failed, completed with before/after byte counts. A swallowed failure is indistinguishable from "no compression exists", which is how RC-6 stayed invisible through a device test.
- [ ] B7. Physical-device validation on iPhone and Android with 1080p60, 4K, HDR, slow-motion, and portrait video.

### Phase C — Remove redundant full-size copies

- [x] C1. Teach `isSynzappMediaCacheUri` about the native media cache directory.
- [x] C2. Include the native media cache in cache-size accounting and pruning so skipping the copy does not leak storage.

## Acceptance Criteria

**Bubble stability**

- Sending a video shows exactly one bubble, immediately.
- The bubble never disappears, never duplicates, and never flashes between queued and sent.
- Backgrounding and reopening mid-upload shows the same single bubble with live progress.

**Speed**

- A 1-minute 1080p60 phone video sends in the tens of seconds on a normal connection, not minutes.
- The transcoded payload for a 1-minute clip is on the order of 15 MB in `standard` mode.
- The chat input stays responsive throughout preparation, transcoding, encryption, and upload.

**Safety**

- A video that cannot be transcoded still sends, using the original file.
- Existing media in existing conversations still opens and plays.

## Validation

Passing:

- `npm run typecheck`
- `npm run build:preflight`
- `npx vitest run src/services/chatOfflineMetrics.test.ts src/services/chatOfflineSettings.test.ts src/services/companyDataGovernance.test.ts src/services/companyDataManifest.test.ts` — 11 tests
- `xcodebuild -workspace ios/Synzapp.xcworkspace -scheme SynzappNativeMedia -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' build` (after `pod install`, which is required to pull the new `SynzappNativeVideoTranscoder.swift` into the target)
- `./gradlew :synzapp-native-media:compileDebugKotlin`

Outstanding:

- Phase B7 physical-device validation. The transcoders compile on both platforms but have not been run against real video on real hardware. Until they have, the transcoder should be treated as unvalidated — which is safe, because every failure path falls back to the original file and the current send behaviour.

## Implementation Notes

**Files changed**

| File | Change |
|---|---|
| [chatApi.ts](src/services/chatApi.ts) | `ChatMessage.clientMessageId`; `getChatMessageIdentityKey`; carry the client id onto the accepted message |
| [chatEncryption.ts](src/services/chatEncryption.ts) | Restore `clientMessageId` from the envelope on decrypt |
| [AdminChatScreen.tsx](src/screens/AdminChatScreen.tsx) | Identity-keyed `uniqueChatMessages`, thread-row keys, and pending reconciliation; commit-before-remove in both send paths |
| [localChatStore.ts](src/services/localChatStore.ts) | Stamp `clientMessageId = queueId` on queued messages |
| [chatMediaApi.ts](src/services/chatMediaApi.ts) | Native cache directory recognised for copy-skip, wipe, sizing, pruning; `compressChatVideoForUpload` safety net |
| [chatMediaPreparationQueue.ts](src/services/chatMediaPreparationQueue.ts) | Transcode step with bubble progress and cancellation |
| [nativeVideoTranscoder.ts](src/services/nativeVideoTranscoder.ts) | New — quality ladder, capability detection, fail-safe wrapper |
| [SynzappNativeVideoTranscoder.swift](modules/synzapp-native-media/ios/SynzappNativeVideoTranscoder.swift) | New — AVAssetReader/AVAssetWriter H.264 + AAC transcoder |
| [SynzappNativeVideoTranscoder.kt](modules/synzapp-native-media/android/src/main/java/com/synzapp/nativemedia/SynzappNativeVideoTranscoder.kt) | New — MediaCodec transcoder with MediaMuxer output |
| [TranscodeSurfaces.kt](modules/synzapp-native-media/android/src/main/java/com/synzapp/nativemedia/TranscodeSurfaces.kt) | New — EGL input/output surface bridge |

**Android muxer ordering**

`MediaMuxer` silently discards samples written before `start()`, and `start()` cannot be called until every track has registered its format. An encoder that produces payload while the other track is still registering would therefore lose its opening keyframe and yield an unplayable file. Both stages hold the buffer *and its index* back and flush it once the muxer starts; a bounded retry count starts the muxer with whatever tracks exist rather than deadlocking if the audio encoder never publishes a format.

**Android rotation**

Rotation is applied in the GL pass rather than through the container's orientation hint, so the encoded stream is upright for every player and thumbnailer. The muxer's orientation hint is explicitly reset to zero to avoid double-rotation.
