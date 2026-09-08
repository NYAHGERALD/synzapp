# Synzapp Interpreter: Controlled Live Guardrails And Saved Transcript Audio Plan

## Status

The controlled multilingual GPT Live Interpreter flow is working and must be treated as protected architecture.

This file is the source of truth for future work touching the Interpreter live room. New features must be added beside the live flow, not inside the working response gate, unless a future change is explicitly designed, reviewed, and tested against this document.

## Protected Working Flow

The current live Interpreter behavior is:

1. The user taps `Listen`.
2. Synzapp opens the microphone gate.
3. GPT Live listens and transcribes, but does not speak automatically.
4. The user taps `Respond`.
5. Synzapp closes the microphone gate.
6. Synzapp sends one controlled response request with the selected output language.
7. GPT Live speaks the response.
8. The user taps `Listen` again to start the next listening turn.

This flow must not be broken.

## Non-Negotiable Guardrails

- Keep the controlled room on the standard GPT Live session path, currently `controlled_voice`.
- Keep manual response control. Do not re-enable automatic voice responses for this room.
- Do not replace this room with segmented text translation plus separate TTS playback.
- Do not move saved-transcript playback work into the live Realtime session.
- Do not let a saved transcript, saved audio job, summary job, replay job, or library screen pause, close, reset, or recreate the live WebRTC session.
- Do not change the meaning of `Listen` and `Respond`.
- Do not use the dedicated continuous realtime translation endpoint for this manual controlled room.
- Preserve the selected output language as the authoritative language for the next `Respond`.
- Preserve the live transcript and cleaned transcript persistence behavior.
- Any future refactor must pass manual device testing for: listen, respond, language switch, listen again, end meeting, and replay history.

## OpenAI Documentation Findings

Official OpenAI documentation separates live low-latency sessions from request-based generated speech:

- Realtime sessions are best for live, low-latency audio experiences.
- Request-based audio APIs are best for files, bounded requests, or generated speech that does not need a live session.
- Controlled Realtime rooms can keep VAD while disabling automatic responses by setting `turn_detection.create_response` and `turn_detection.interrupt_response` to `false`; clients then trigger responses manually with `response.create`.
- The speech endpoint can generate spoken audio from text and supports multiple languages, but its input has a bounded request size, so long transcripts must be chunked safely.
- Background-mode OpenAI requests help long-running model work, but audio file generation and artifact persistence still need Synzapp-owned backend job tracking.

Sources:

- https://developers.openai.com/api/docs/guides/realtime
- https://developers.openai.com/api/docs/guides/realtime-conversations
- https://developers.openai.com/api/reference/resources/realtime/client-events
- https://developers.openai.com/api/docs/guides/text-to-speech
- https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create
- https://developers.openai.com/api/docs/guides/background

## Honest Recommendation

The saved cleaned-transcript audio feature is achievable and compatible with the working GPT Live room, but only if it is implemented as a separate transcript library and backend audio-artifact workflow.

It should not be implemented as another live Realtime session, and it should not reuse the live GPT Live connection for read-aloud playback.

The safest enterprise architecture is:

- Live room: controlled GPT Live, WebRTC, manual Listen/Respond gate.
- Transcript library: normal mobile screen reading persisted transcript records from the backend.
- Transcript audio: backend-generated audio artifacts keyed by transcript, language, and voice.
- Playback: normal mobile audio player, not the Realtime remote audio sink.

## Implemented Architecture

The saved transcript library is now implemented as a separate feature beside the live room:

- Mobile live room: `src/screens/InterpreterScreen.tsx`
  - Keeps the protected manual `Listen` to `Respond` GPT Live flow.
  - Adds a top transcript-library icon that opens a separate saved transcript modal.
  - Uses a dedicated saved-transcript audio player, not the GPT Live remote audio sink.

- Mobile API client: `src/services/interpreterApi.ts`
  - Sends the selected output language when saving cleaned transcripts.
  - Lists saved transcripts and their audio artifacts.
  - Requests read-aloud audio artifacts for a selected transcript language.

- Backend routes under `/api/interpreter`
  - `POST /meetings/:meetingId/transcripts`
  - `GET /meetings/:meetingId/transcript-library`
  - `POST /meetings/:meetingId/transcripts/:segmentId/audio-artifacts`

- Backend service: `src/services/interpreterService.ts`
  - Saves cleaned transcript records.
  - Creates deterministic audio artifact records by transcript, text fingerprint, language, and voice.
  - Generates read-aloud audio outside the live GPT session.
  - Stores MP3 artifacts in Firebase Storage at:
    `organizations/{tenantId}/interpreterMeetings/{meetingId}/transcriptAudio/{segmentId}/{artifactId}.mp3`
  - Returns signed audio URLs for ready artifacts.

This architecture is intentionally separated from the live GPT room. Future transcript library, audio history, replay, or export work must continue using backend artifacts and normal mobile playback so the manual live Interpreter gate remains stable.

## Saved Transcript Audio Feature Requirements

### User Experience

- Add a top header icon in the Interpreter room for saved cleaned transcripts.
- Open a separate screen or modal dedicated to saved cleaned transcripts.
- Show saved cleaned transcripts grouped by live turn/version and creation time.
- Each transcript row should show:
  - Cleaned transcript text.
  - Detected input language when available.
  - Created time.
  - Audio generation status.
  - Read-aloud language selector.
  - Play/pause control.
- The live room must continue working while this screen is opened or closed.

### Background Processing

When a cleaned transcript is saved:

1. The backend stores the transcript record.
2. The backend creates or reuses an audio job for the default read-aloud language.
3. The backend generates speech in the background.
4. The backend stores the audio artifact in controlled storage.
5. The mobile app refreshes the transcript library and can request preparation again when the user taps play.

Important: React Native should not be responsible for "another thread" for this job. The enterprise approach is backend-owned processing so the app remains responsive and duplicate audio generation can be avoided. If a background job has not finished by the time the user opens the library, the play action asks the backend for the same deterministic artifact and either receives a ready signed URL or prepares it safely.

### Audio Generation Rules

- Use request-based speech generation, not GPT Live, for saved transcript read-aloud.
- Use a configurable TTS model, with `gpt-4o-mini-tts` or the backend's current approved TTS model as the default.
- Respect the speech endpoint input limit by splitting long cleaned transcripts on sentence or paragraph boundaries.
- Store multi-part audio with deterministic ordering.
- Do not replay segments out of order.
- Do not duplicate audio files for the same transcript/language/voice unless the transcript text changes.

### Translation Rules

- If the selected read-aloud language matches the transcript language, generate speech from the cleaned transcript directly.
- If the selected language is different, first create a stored translated text artifact, then generate speech from that translated artifact.
- Translation and TTS artifacts should be versioned by transcript text fingerprint, target language, and voice.

### Backend Data Model

Recommended collections or fields:

- `transcripts/{segmentId}`
  - `text`
  - `cleanedText`
  - `detectedLanguageCode`
  - `versionId`
  - `createdAtIso`
  - `updatedAtIso`
  - `textFingerprint`

- `transcripts/{segmentId}/audioArtifacts/{artifactId}`
  - `languageCode`
  - `voiceId`
  - `status`: `queued | processing | ready | failed`
  - `textFingerprint`
  - `translatedText`
  - `audioStoragePath`
  - `contentType`
  - `durationMs`
  - `partCount`
  - `errorMessage`
  - `createdAtIso`
  - `updatedAtIso`

### API Surface

Implemented endpoints:

- `POST /api/interpreter/meetings/:meetingId/transcripts`
  - Saves one cleaned transcript segment.
  - Queues or reuses the default read-aloud audio artifact for the selected output language.

- `GET /api/interpreter/meetings/:meetingId/transcript-library`
  - Returns saved cleaned transcripts and available audio artifacts.

- `POST /api/interpreter/meetings/:meetingId/transcripts/:segmentId/audio-artifacts`
  - Creates or returns an audio artifact for a selected language and voice.
  - Returns signed audio metadata when the artifact is ready.

### Safety And Compliance

- Enforce tenant authorization on every transcript and audio request.
- Log audit events for audio generation and playback access.
- Avoid returning raw storage paths directly to clients.
- Respect interpreter retention settings.
- Do not store OpenAI response data unless Synzapp explicitly owns the artifact.

## Implementation Sequence

1. Add this guardrail and in-code protection comments.
2. Add backend transcript listing API using existing persisted transcript data.
3. Add backend audio artifact data model and deterministic artifact keys.
4. Add backend job creation endpoint that returns existing ready/processing artifacts when possible.
5. Add backend worker/service function for translate-if-needed plus TTS generation.
6. Add mobile saved transcript screen with read-only transcript list.
7. Add audio status polling and player controls.
8. Add language selector per transcript.
9. Add top live-room icon to open the transcript screen.
10. Run full regression on the protected live room.

## Manual Regression Checklist

Before and after the saved transcript audio feature:

- Start a meeting.
- Select an output language.
- Tap `Listen`.
- Speak for at least 20 seconds.
- Confirm live transcript and cleaned transcript update.
- Tap `Respond`.
- Confirm GPT Live speaks in the selected output language.
- Tap `Listen` again.
- Confirm the mic gate opens and the next turn works.
- Open saved transcript screen.
- Play saved transcript audio.
- Confirm live room can still listen/respond after closing the screen.
