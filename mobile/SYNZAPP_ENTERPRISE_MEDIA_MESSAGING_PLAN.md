# Synzapp Enterprise Media Messaging Plan

## Goal

Make Synzapp media messaging feel close to WhatsApp and Microsoft Teams while preserving Synzapp's enterprise security model: encrypted media, tenant authorization, local-first chat behavior, and reliable playback on mobile devices.

## Current Gaps

- Image receivers often wait for the full encrypted file before seeing useful visual context.
- Video messages show as generic attachments instead of visual video previews.
- Tapping video does not open a first-class in-app video player experience.
- Full media downloads can compete with normal chat responsiveness.
- Message payloads do not carry a small secure preview that can render immediately after decryption.

## Target Architecture

### 1. Encrypted Preview-First Messages

Every photo and video message carries a small encrypted preview inside the chat message payload.

- Photos generate a compressed JPEG thumbnail before send.
- Videos generate a poster-frame JPEG thumbnail before send.
- Thumbnail metadata is encrypted with the message body, not stored readable on the backend.
- Full media continues using the encrypted upload and signed download-session pipeline.

### 2. Sender Experience

- Sender sees the selected media preview immediately in the chat bubble.
- Upload progress overlays the preview.
- Offline or retry states still show the local preview.
- The sender does not wait for a backend round trip before the chat feels alive.

### 3. Receiver Experience

- Receiver sees a preview immediately after message decryption.
- Full-resolution media downloads only when smart prefetch allows or when opened.
- Videos display a poster frame, play badge, and duration.
- Tapping a video opens a full-screen native player after the encrypted file is downloaded and decrypted.

### 4. Scale Controls

- Keep previews small enough for encrypted message payloads.
- Auto-download images and small files where useful.
- Avoid aggressive full video auto-download unless the user opens the video.
- Cache decrypted full media locally after authorized download.
- Keep chat UI responsive while media transfer continues.

### 5. Security Controls

- Previews are encrypted end to end with the message payload.
- Backend only stores encrypted full media bytes and unreadable encrypted message envelopes.
- Signed upload/download sessions remain tenant-scoped and device-authenticated.
- Full media decryption only happens on approved client devices.

## Implementation Steps

1. Add thumbnail metadata to media attachment types.
2. Generate photo thumbnails during image preparation.
3. Generate video poster thumbnails during video preparation.
4. Preserve thumbnail metadata through local cache, upload, encrypted message payloads, and local SQLite chat cache.
5. Render preview thumbnails for image and video bubbles before full media download.
6. Display video play badges and duration on single media and albums.
7. Add a full-screen native video player for tap-to-play video behavior.
8. Make full video download on-demand, while keeping small image/file prefetch behavior.
9. Run typecheck and native build preflight.

## Build Note

This feature uses native media modules already listed in the app dependencies. Any installed build that does not include these native modules must be rebuilt with EAS before the feature can run on physical iOS or Android devices.

## Expected Result

Synzapp media messages render fast, videos look and play like real videos, and full media stays secure, encrypted, cacheable, and scalable.
