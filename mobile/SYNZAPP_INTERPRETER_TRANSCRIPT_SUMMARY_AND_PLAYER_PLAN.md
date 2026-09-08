# Synzapp Interpreter Saved Transcript Summary And Player Plan

## Purpose

Improve the Saved Transcripts area without changing the working GPT Live interpreter gate. The live room must continue to behave as:

1. `Listen` opens the microphone gate.
2. Synzapp listens only while the gate is open.
3. `Respond` closes the microphone gate and lets GPT Live answer.
4. `Listen` interrupts response audio and starts the next listening turn.

The saved transcript player, saved transcript summaries, summary audio, sharing, deletion, and filters must remain separate from that live control loop.

## Requirements

1. Replace the compact read-aloud dock with a full-screen audio player modal.
2. The player must support:
   - share button on the top-left,
   - play and pause,
   - 10-second back and forward,
   - scrubber / playhead seek,
   - playback speed selection,
   - close,
   - swipe down to minimize.
3. When minimized, the player must appear as a compact top bar inside Saved Transcripts.
4. Only one app-owned audio source may play at a time. Transcript audio, meeting summary audio, segment replay audio, and voice preview audio must pause each other.
5. Keep existing automatic background preparation after a cleaned transcript is saved.
6. Add a `Summary` button in Saved Transcripts.
7. The Summary flow must:
   - summarize all saved cleaned transcripts in chronological order,
   - require the user to select one output language,
   - save the generated summary through the existing authenticated backend summary endpoint,
   - generate spoken summary audio through the existing backend audio service,
   - cache summary audio locally for replay,
   - show previously saved transcript-library summaries by language.
8. Summary creation must not freeze the live room or block transcript list navigation.

## Architecture

- Mobile remains the orchestrator for UI state and local audio playback.
- Backend remains the source of truth for saved summaries and generated summary audio.
- The transcript summary feature calls the existing `createInterpreterSummary` API with a clean transcript snapshot built from saved transcript-library records.
- Transcript-library summaries are marked with `versionId = saved-transcripts` so the screen can show only summaries created for this saved-transcript workflow.
- Transcript read-aloud audio continues to use transcript audio artifacts. No duplicate audio records should be created when a ready artifact already exists.
- Summary audio continues to use summary audio generation. Returned audio is cached locally for playback but remains backed by server-side authorization.

## Implementation Steps

1. Add transcript-library summary/player state in `InterpreterScreen.tsx`.
2. Add helpers for single-audio ownership, transcript summary source text, transcript summary filtering, and summary audio caching.
3. Update saved transcript read-aloud playback to open a full-screen modal and support minimized mode.
4. Add the top minimized player bar.
5. Add a saved transcript summary modal with language selection, create action, saved summary list, and summary audio playback.
6. Wire the transcript modal to the existing authenticated summary APIs.
7. Update styles for the full-screen player, minimized player, and summary modal.
8. Run `npm run typecheck`.

## Guardrails

- Do not change GPT Live session creation, mic-gate behavior, or `Listen` / `Respond` sequencing.
- Do not reintroduce segment-based translation or chunked TTS for live interpretation.
- Do not start summary or transcript audio while another app-owned audio source is playing.
- Do not add backend shortcuts or unauthenticated endpoints.
- Keep all transcript-summary work in the Saved Transcripts surface.
