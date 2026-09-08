# Synzapp Interpreter Saved Transcript Audio Player Plan

## Purpose

Add a professional read-aloud workflow to the Saved Transcripts screen without changing the working GPT Live interpreter gate.

The live room remains the source of captured and cleaned transcript text. Saved transcript audio is a separate library feature.

## Non-negotiable guardrails

- Do not reintroduce segmented live translation playback.
- Do not change the Listen -> Respond -> Listen GPT Live gate.
- Do not block the UI while read-aloud audio is prepared.
- Keep the existing automatic background preparation that starts after a transcript is saved.
- Reuse already prepared audio for the same transcript, language, and voice.
- A Prepare action must prepare only. It must not start playback.
- A Play action may prepare missing audio first, then play when ready.
- Sharing must use the native share sheet and the already prepared audio file.

## Implementation scope

1. Saved transcript audio preparation
   - Add a `Prepare Audio` button beside the existing language and playback controls.
   - Use the same backend preparation endpoint and artifact cache that automatic preparation already uses.
   - Update the transcript card artifact status in place after preparation.

2. Compact audio player
   - Open a compact dock inside the Saved Transcripts screen when audio is selected.
   - Show the transcript label, selected language, elapsed time, total duration, play/pause, 10-second back/forward, playback speed, scrubber, and native share.
   - Keep the player compact so it does not take over the whole screen.

3. Playback controls
   - Support 0.75x, 1x, 1.25x, 1.5x, and 2x speed.
   - Allow seeking through a progress bar.
   - Preserve pitch correction when changing speed.

4. Native sharing
   - Download the prepared audio URL to the device cache when needed.
   - Reuse cached files for the same transcript, language, and voice.
   - Open the native share sheet for Files, Messages, WhatsApp, email, and other installed apps.

## Acceptance criteria

- Live interpretation still works exactly as before.
- Saved transcripts still auto-start background audio preparation after save.
- Tapping `Prepare Audio` prepares the selected language but does not play.
- Tapping `Play` plays ready audio, or prepares then plays if audio is not ready.
- The compact player can pause, resume, jump 10 seconds, scrub, change speed, and share.
- Already prepared audio is reused and is not prepared again for the same transcript, language, and voice unless the backend artifact has failed or changed.
- `npm run typecheck` passes.
