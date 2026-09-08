# Synzapp Interpreter Native Streaming Audio Plan

## Purpose

Move the Synzapp AI Interpreter from a replay-file workflow to a ChatGPT-style realtime voice workflow.

The live interpreter must speak from the active OpenAI Realtime session first. Backend-created audio files are retained only for saved replay, history, and audit.

## Root Cause Fixed In Phase 1

- The mobile realtime service now enables the remote audio track when a response language is tapped.
- The language buttons no longer wait for the backend segment-audio endpoint during an active live session.
- Segment audio is still cached as files for replay, but it runs in the background after live speech is triggered.
- JavaScript does not capture WebRTC remote audio frames into a native replay queue yet, so that remains Phase 2 work for prebuffered replay across multiple languages.

## Enterprise Target

1. A meeting opens one controlled realtime audio room.
2. The user taps Listen.
3. Microphone audio streams continuously to the realtime model.
4. The model captures transcript and translation context while listening.
5. Tapping a response language sends a realtime response command over the active data channel.
6. The model speaks through the native media output immediately.
7. The session remains alive after speaking so the user can tap Listen again for the next version.
8. Transcripts, translations, and replay audio are saved asynchronously after live playback for audit, history, and summary.
9. Backend replay audio stays available for history, but it must not block live interpretation.

## Audio Routing

- Live interpretation playback must use the same media output route as music and videos.
- Bluetooth speakers, wired outputs, and system media routes should be respected.
- Earpiece routing is not acceptable for interpreter speech.
- Native audio session setup must separate listening mode from speaking mode.

## Multi-Language Design

The session can offer the full language catalog, but a single live meeting can actively prepare up to four response languages.

For true instant replay of multiple languages from the beginning, Synzapp needs a native audio queue capable of receiving model audio chunks while the AI is listening. The correct enterprise implementation is:

- Use the realtime audio stream for immediate selected-language playback.
- Add a native streaming audio queue for future multi-language prebuffered playback.
- Persist replay assets after live response, not before live response.

## Implementation Phases

### Phase 1: Correct Live Path

- Status: Implemented in the mobile/backend live path.
- Backend now issues a separate `controlled_voice` standard realtime session for ChatGPT-style response commands.
- Mobile now opens one controlled realtime voice session per listening version instead of one translation session per language.
- Language taps during an active live session send a realtime `response.create` command and enable the remote audio track.
- Backend segment-audio is warmed asynchronously for history/replay and is only used as fallback when no live session exists.
- Active live language buttons and the response-language picker no longer expose replay-preparation state as the main user action.

### Phase 2: Native Queue

- Add native audio sink/player support for streamed PCM or provider audio deltas.
- Buffer generated speech chunks while listening.
- Allow tapping any prepared language to replay from the beginning instantly.
- Keep a bounded memory queue and spill longer history to encrypted local files.

### Phase 3: Audit Persistence

- Save transcript and interpreted text records asynchronously.
- Save replay audio asynchronously after the live response.
- Keep summary generation based on saved transcript/version records.

## Validation

- Tapping a language during an active live session produces audible speech without waiting for `/interpretation-audio`.
- Realtime audio uses media output, not earpiece.
- The Listen button can start a new version after speaking.
- History and Summary still work from persisted records.
- Backend replay failure does not block live spoken response.
