# Synzapp WhatsApp-Style Enterprise Media Parity Plan

## Purpose

Synzapp messaging must feel local-first and immediate while keeping enterprise security, encrypted transport, and predictable behavior at scale. The goal is not to copy WhatsApp's private internals. The goal is to implement the product behaviors users expect from modern messaging: instant selected-media preview, visible thumbnails in chat, controlled upload/download work, clear video playback, and network-aware media handling.

## Verified Product Behaviors To Match

- Users see selected photos and video poster thumbnails before sending.
- Sending media should not require opening or playing the video first.
- Chat bubbles appear immediately on the sender's device with local previews.
- Receivers should see encrypted preview thumbnails quickly, then download full media only when needed.
- Users should have a Standard/HD quality choice for media where that matters.
- Media auto-download must be controlled so large videos do not slow the whole app.
- Media remains end-to-end encrypted; backend storage should not need plaintext media.

References:
- WhatsApp Help Center: HD photos and videos: https://faq.whatsapp.com/759301289012856
- WhatsApp Help Center: media auto-download controls: https://faq.whatsapp.com/366146522333492
- WhatsApp Help Center: end-to-end encryption: https://faq.whatsapp.com/820124435853543

## Current Synzapp State

- Text messages are already local-first with a queued pending message.
- Media messages already carry encrypted thumbnail metadata.
- Video bubbles can show poster thumbnails and open a video viewer.
- Videos are no longer automatically downloaded in the background.
- Small selected videos can now use the original URI so preview is faster and does not wait for compression.

## Enterprise Gaps To Close

### Phase 1: Sender Experience

- Keep an optimized media file for Standard send quality.
- Preserve original media metadata when available so HD can use the original safely.
- Show a Standard/HD control in the review screen.
- Keep video review as a poster thumbnail with duration and size, not a blocking video player.
- Close the review screen immediately after Send, then let the chat bubble show queued/sending progress.

### Phase 2: Receiver Experience

- Keep receiver thumbnails encrypted in message payload so chat renders instantly.
- Do not auto-download full videos.
- Auto-download images and small files only when the network policy allows it.
- On video tap, show a controlled loading state while downloading and decrypting, then play in the native Synzapp viewer.

### Phase 3: Network-Aware Media

- Detect network class with NetInfo.
- On cellular or expensive connections, avoid automatic large-media downloads.
- On Wi-Fi, allow small non-video media to download opportunistically.
- Never block chat navigation or typing while media transport is running.

### Phase 4: Backend Transport Scale

This phase requires backend endpoint contracts and should be built after Phase 1-3 are stable:

- Chunked encrypted upload sessions for large videos.
- Resumable encrypted downloads.
- Upload queue records with idempotent retry keys.
- Server-side media session expiry and audit telemetry.
- Per-tenant media policy: max sizes, HD availability, and auto-download defaults.

## Implementation This Pass

- Add Standard/HD quality metadata to local and encrypted media payloads.
- Preserve original media references for HD when the file is inside the enterprise limit.
- Add a media quality selector to the pre-send review screen.
- Make the review UI display video poster thumbnails instead of opening the player before send.
- Add network-aware auto-download policy using NetInfo.
- Improve video open behavior with an explicit preparation state.
- Generate video poster thumbnails from multiple time offsets so clips with dark or delayed first frames still get a visible chat preview.
- Prefer the stable encrypted video poster thumbnail in chat bubbles so upload/download URI changes do not make previews disappear.
- Use the current iOS Photos asset representation first to avoid unnecessary Photos transcoding/export failures on longer videos.
- Replace raw iOS `PHPhotosErrorDomain` export errors with a clear Synzapp explanation and recovery path for iCloud-backed or oversized videos.
- Support long-press on photo, video, audio, and file media previews using the same message action menu as text bubbles.
- Upgrade the video viewer with a WhatsApp-style playback shell: back navigation, message timestamp, scrubber, remaining time, speed toggle, center play/pause, thumbnail rail, share, forward, reply, star, and delete actions.
- Show the loaded chat message count beside the conversation back control.
- Split composer actions so the camera icon opens the camera directly and the plus control opens the photo/video library.
- Keep selected video review non-blocking by avoiding pre-review cache copies and picker-time compression.
- Treat unknown iOS video size as non-fatal during review so unstable Photos metadata does not block the user before send.
- Raise encrypted video allowance to 250 MB across mobile and backend so normal multi-minute phone videos are not rejected by the old 64 MB cap.
- Keep all media encrypted and continue using existing authenticated backend upload/download sessions.

## Acceptance Criteria

- Selecting a video opens the review screen with a poster thumbnail, not a blank player.
- Sending closes the review screen immediately and creates the outgoing bubble immediately.
- The sender sees thumbnail/poster plus queued/sending state before backend completion.
- Receiver can see thumbnail/poster before the full video downloads.
- Tapping a video downloads/decrypts only when needed and opens the viewer afterward.
- Standard/HD choice is visible in review and is carried into the encrypted message metadata.
- Auto-download behavior changes based on network without blocking chat.
- Mobile typecheck and preflight pass.
