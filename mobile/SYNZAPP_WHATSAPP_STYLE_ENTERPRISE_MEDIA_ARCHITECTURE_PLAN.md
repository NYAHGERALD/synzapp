# Synzapp WhatsApp-Style Enterprise Media Architecture Plan

## Decision

Synzapp mobile chat will not use the Offline AI modal/service or on-device AI model path. Chat translation and AI assistant features are removed from the app so messaging and media interactions stay lightweight, predictable, and auditable.

## Media Goal

Media must feel local-first. When a user selects a photo or video, Synzapp should show the message immediately from the device-local asset, then encrypt, upload, sync, and hydrate recipients in the background. Playback should open from local cache when available, and otherwise open instantly with the cached thumbnail while the encrypted playable file downloads.

## Enterprise Flow

1. User selects media from camera or library.
2. App creates a local message immediately with local URI, thumbnail URI, duration, dimensions, file size, content type, and pending status.
3. App generates a local thumbnail or poster frame before upload.
4. App compresses/transcodes only in the background and only when required by policy.
5. App encrypts media locally with a per-message media key.
6. App uploads thumbnail and optimized/playable media through a retryable media outbox.
7. Backend stores encrypted media, metadata, delivery state, and audit metadata only.
8. Recipient receives metadata and thumbnail first, then hydrates playable media in the background.
9. Tapping media opens the viewer immediately. If playable media is cached, it plays instantly; if not, the viewer shows the thumbnail with download progress.
10. Long-press and forward actions must not block on media download, encryption, or server calls.

## Architecture Components

- `mediaOutbox`: persistent SQLite-backed queue for pending upload, retry, cancel, and resend.
- `mediaCache`: encrypted local media manifest with thumbnail, preview, and playable asset states.
- `mediaHydration`: background download/decrypt worker with network policy and backpressure.
- `mediaViewer`: instant viewer/player surface that prefers local playable files and falls back to thumbnail plus progress.
- `mediaForward`: metadata-first forwarding flow that can forward existing encrypted media references without re-uploading when policy allows.

## Security Controls

- Never store plaintext media on the backend.
- Keep plaintext playable files local-only and evictable by tenant policy.
- Store encrypted media keys in secure local storage or backend key envelopes.
- Audit sender, recipient, upload status, forward action, and deletion/unlink events without storing message plaintext.
- Respect tenant retention, offline cache limits, and device revocation.

## Implementation Phases

1. Remove Offline AI, AI modal, and chat translation from the mobile app.
2. Stabilize media selection so video send does not require opening or playing a preview first.
3. Persist local thumbnails and playable media paths in SQLite.
4. Add thumbnail-first receiver hydration and local playable cache lookup.
5. Add WhatsApp-style media viewer controls, forward modal, and long-press media action parity.
6. Add queue metrics, retry instrumentation, and large-media performance tests.

## Acceptance Criteria

- Selecting media creates an immediate visible bubble.
- Video bubbles always show a thumbnail and duration when metadata is available.
- Media viewer opens immediately from local cache or with thumbnail download state.
- App remains responsive during long press, forward, upload, download, and playback.
- No Offline AI or on-device AI model UI, service, or native module remains in the mobile app.
