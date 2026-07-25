# Synzapp Enterprise Media Sharing Pipeline

## Goal

Make Synzapp chat media behave like leading messaging apps: a selected photo or video appears immediately, the chat stays responsive, upload/download progress is visible, and large files are handled as resumable background media jobs instead of one blocking JavaScript operation.

## Architecture Pattern

Synzapp will follow the proven local-first pattern used by enterprise-grade chat systems:

1. Create a local message record immediately.
2. Render the local thumbnail or local video URI immediately.
3. Store the media job in the local queue.
4. Upload media independently from the chat screen.
5. Split large media into encrypted chunks.
6. Upload chunks with progress and retry support.
7. Complete the upload on the backend only after every chunk exists.
8. Compose chunk objects into the final encrypted media object.
9. Send the encrypted chat envelope with media metadata.
10. Keep local decrypted media cached for instant replay.

## What Changes Now

- Do not compress or transcode user-selected chat media.
- Preserve the original file type, dimensions, duration, and size.
- Use chunked encrypted upload for large media.
- Keep small media on the existing single-upload path.
- Store encryption mode and chunk metadata in the message media attachment.
- Backend creates part upload URLs and composes uploaded parts.
- Progress updates stay attached to the outgoing bubble.
- Do not silently fall back to whole-file upload when a large-video chunk session is missing.
- Run large-media work cooperatively with smaller chunks and explicit UI yields so chat navigation, typing, long press, and message sending stay responsive.
- Upload multiple media items sequentially instead of launching parallel encryption/upload work from the chat screen.
- Throttle media progress UI updates so progress feedback stays visible without flooding React rendering.

## Enterprise Rules

- Media content remains encrypted before it reaches storage.
- Backend never receives plaintext media.
- Backend validates device identity, chat authorization, file type, size limits, part counts, and upload ownership.
- The sender sees media immediately from local cache.
- A failed chunk upload can be retried without recreating the whole message.
- The final message is only marked available after backend upload completion.

## Remaining Upgrade After This Phase

This phase gives Synzapp a chunked, non-compressing, local-first media pipeline in JavaScript/Expo with cooperative scheduling. The final WhatsApp/Telegram-grade upgrade is moving chunk encryption/upload/download into a native background worker so very large files can continue across app backgrounding, survive process interruptions, and avoid JavaScript-thread pressure entirely.

## Performance Rules

- The chat UI must never wait for media upload before rendering the outgoing bubble.
- Video encryption must be chunked small enough that the JavaScript thread can return to gestures and navigation between parts.
- Multi-media sends and forwards must use queue pressure, not `Promise.all` bursts.
- Missing backend chunk support is a deployment error, not a reason to use a slower fallback path.
- The local thumbnail/local video URI is the source of truth for immediate sender display.
