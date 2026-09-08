# Synzapp Interpreter Manual Response Gate Plan

## Objective

Update the mobile Interpreter room so the user controls when Synzapp listens and when Synzapp speaks. The live Realtime session remains responsible for low-latency listening and transcript capture. The audible **Response** uses the production interpretation-audio backend path and Expo audio playback so iPhone output is reliable and does not depend on a silent WebRTC remote-audio route.

## Implementation Status

Implemented in the mobile app:

- The live Interpreter room now starts the main realtime session in `controlled_voice` mode.
- The primary action is now a manual state machine: **Listen** opens the mic, **Response** commits captured speech and prepares the spoken response, and **Responding** is disabled until audio drains.
- Captured speech is tracked per live version so repeated **Response** taps only send speech captured since the previous response.
- The Realtime room stays alive for the next listening turn, but model speech is no longer routed through the Realtime remote audio track on iPhone.
- The screen now generates response audio through the hosted interpretation-audio endpoint and plays it with the existing native audio player.
- The live room now requires an explicit output language before **Listen** becomes active.
- The output language picker uses the backend language catalog and includes search before a session starts.
- After a spoken response finishes, the next **Listen** opens a fresh controlled capture session inside the same live room so installed iPhone builds do not reuse a stale microphone track.
- The live room now displays an honest audio-state badge: preparing audio is shown separately from AI speaking.
- Source language display is best-effort auto detection from realtime transcription events and stays in an auto-detecting state until a detected language is available.
- The live room now uses a compact control area and a bottom live translation workspace so captured speech and translated response text are visible during the controlled session.
- The backend interpretation request now satisfies the Responses API JSON-mode requirement by including the word `json` in the actual input message, not only in instructions.
- Backend deployment completed: Cloud Run revision `synzapp-backend-00079-mxk` is serving 100% of traffic.

## Device Install Command

Use this command when installing the native iPhone build for real-device testing. This is the no-Metro Release install path and points to the deployed Synzapp backend by default.

```bash
cd /Users/geraldnyah/Documents/MeetingIntelligence/SYNZAPP/mobile
SYNZAPP_IOS_DEVICE="iPhone (2)" npm run local:ios:release:device
```

Expected install output includes:

```text
Building Synzapp Release for iPhone (2)
Backend: https://synzapp-backend-291906951893.us-central1.run.app
Synzapp Release was installed on iPhone (2).
Open Synzapp from the iPhone home screen. Metro is not used for this install.
```

If the terminal shows `Waiting on http://localhost:8081`, that is the old Metro development path and should not be used for this workflow.

## Current Implementation Audit

The Interpreter mobile code now separates capture from playback, which is the reliable production path for installed iPhone builds.

- `SYNZAPP/mobile/src/screens/InterpreterScreen.tsx`
  - `startLiveInterpreter()` opens a `controlled_voice` Realtime session for listening and transcript capture.
  - `toggleLiveMicrophoneGate()` controls the manual listening state.
  - `getLivePrimaryActionLabel()` shows **Response** while the microphone gate is open.
  - `respondInSelectedLanguage()` commits the latest microphone buffer, waits for transcript text, calls the hosted interpretation-audio endpoint, and plays the returned audio with native playback.

- `SYNZAPP/mobile/src/services/interpreterRealtime.ts`
  - The main Interpreter room uses `controlled_voice`, so automatic voice-agent response gating is not active.
  - `commitLatestAudio()` lets the screen finalize the current spoken turn without triggering Realtime speech.
  - Direct `response.create` speech remains available for other Realtime flows, but the iPhone controlled Interpreter response uses backend-generated audio playback.

- `SYNZAPP/backend/src/services/interpreterService.ts`
  - `requestOpenAiInterpreterControlledVoiceSession()` and `requestOpenAiInterpreterVoiceAgentSession()` both set:
    - `turn_detection.create_response: false`
    - `turn_detection.interrupt_response: false`
  - This matches the requested control model: the server may detect/commit speech turns, but it should not automatically speak.
  - `requestOpenAiInterpreterSegmentTranslation()` includes a lower-case `json` output instruction in the input message because OpenAI rejects `text.format: json_object` requests when the input message does not contain that word.

## OpenAI Realtime Guidance Used

OpenAI's Realtime documentation supports this design:

- Realtime sessions keep a live connection where the client sends audio, receives events, and updates session state. Voice-agent sessions are the correct session type when the model should respond to users and manage conversation state.  
  Source: https://developers.openai.com/api/docs/guides/realtime

- When using VAD but wanting manual response control, set `turn_detection.create_response` and `turn_detection.interrupt_response` to `false`. The client can then trigger speech manually with `response.create`.  
  Source: https://developers.openai.com/api/docs/guides/realtime-conversations

- WebRTC clients send control events like `response.create` through the data channel while the media session stays alive.  
  Source: https://developers.openai.com/api/docs/guides/realtime-conversations

- OpenAI's Realtime overview separates live low-latency sessions from request-based generated speech. Realtime is the correct layer for microphone capture; Text-to-speech is the correct layer for generated spoken audio that can be played through native app media playback.  
  Sources: https://developers.openai.com/api/docs/guides/realtime and https://developers.openai.com/api/docs/guides/text-to-speech

## Production Model Selection

Use this current OpenAI model split for the controlled Interpreter:

- Live voice-agent diagnostics: `gpt-realtime-2.1`.
- Live interpreter sessions: `gpt-realtime-translate` through the dedicated Realtime Translation endpoint.
- Live transcript deltas: `gpt-live-transcribe`.
- Text fallback for audit/replay only: `gpt-5.6-terra`.
- Spoken fallback rendering for replay only: `gpt-4o-mini-tts` with a supported voice such as `cedar` or `coral`.

The production interpreter path must not depend on stitched translation chunks as the primary user experience. Chunked text/TTS exists only as a fallback for replay, audit history, and cases where a realtime translation session is unavailable.

## Current Production Fix

The user-facing error `Interpreter segment translation could not be prepared.` came from the backend's Responses API call, not from iPhone playback. Cloud Run showed OpenAI rejecting the request with HTTP 400 because JSON output mode was enabled but the input message did not include the word `json`. The fix was applied in `SYNZAPP/backend/src/services/interpreterService.ts` and deployed to Cloud Run.

## Target User Experience

1. User opens the Interpreter room.
2. Primary button shows **Listen**.
3. User taps **Listen**.
4. The microphone gate opens and the button changes to **Response**.
5. While the mic is open:
   - Synzapp captures/transcribes the conversation.
   - The AI does not speak automatically.
   - Transcript continues to update in real time.
6. User taps **Response**.
7. Synzapp commits the microphone buffer, waits briefly for finalized transcript text, and freezes the captured speech since the last response.
8. Synzapp requests one spoken interpretation from the hosted backend.
9. Audio plays through the app's normal native playback path.
10. After the response completes:
    - The session remains open.
    - The microphone remains closed.
    - The button returns to **Listen** so the next listening turn is user-controlled.

## Architecture Decision

Use a **manual response gate** on top of the existing Realtime listening session, with a separate production audio playback path for spoken responses.

The earlier direct Realtime remote-audio response path is not dependable enough on installed iPhone builds because the remote track can exist while producing no audible output. The enterprise-safe implementation keeps Realtime for capture and uses the backend interpretation-audio endpoint for the audible response.

The production behavior should be:

- Realtime session: stays alive.
- Server VAD: remains enabled for speech boundary detection.
- Automatic responses: disabled.
- Client response trigger: explicit **Response** tap only.
- Transcript finalization: commit the latest input audio buffer before generating the response.
- Audio route: native media playback using the same interpretation audio path used elsewhere in the Interpreter.

## Implementation Plan

### 1. Introduce an Explicit Manual Voice Mode

In `interpreterRealtime.ts`:

- Add an internal flag for manual response sessions.
- Disable `scheduleVoiceAgentResponseGate()` and `authorizeVoiceAgentResponse()` for the main Interpreter live room.
- Keep transcript collection active.
- Add `commitLatestAudio()` so the UI can finalize speech before generated playback.
- Keep Realtime `response.create` available for future direct Realtime speech flows, but do not depend on it for this iPhone-controlled response path.

Recommended session mode for this screen:

- Use `controlled_voice` for the Listen -> Response flow.
- Keep `voice_agent` only if a future screen needs automatic voice-agent behavior.

### 2. Make the Primary Button a State Machine, Not a Mic Toggle

In `InterpreterScreen.tsx`:

- Change the primary action labels:
  - `idle` / `ready`: **Listen**
  - `connecting`: **Preparing**
  - `listening`: **Response**
  - `responding`: **Responding**
- Change the icon:
  - Listen: microphone
  - Response: send / spark / chat voice icon
  - Responding: activity indicator or volume icon
- Tapping **Listen** starts/resumes microphone capture.
- Tapping **Response** calls the manual response handler with the captured transcript.
- Tapping during **Responding** should either be disabled or explicitly cancel response, depending on final UX choice.

### 3. Track "Captured Since Last Response"

Add a response boundary model:

- `lastResponseTranscriptFingerprint`
- `pendingResponseTranscript`
- `activeResponseId`
- `responseStartedAtIso`

When transcript events arrive:

- Update the live transcript.
- Update the active live version.
- Compute the text that has not yet been responded to.
- Enable **Response** only when there is meaningful captured speech.

When **Response** is tapped:

- Freeze the pending transcript snapshot.
- Mark the live version as responding.
- Commit the latest audio buffer and wait briefly if transcription is behind the speaker.
- Request one interpretation-audio response from the hosted backend using the frozen text snapshot.
- Do not let later transcript deltas mutate the in-flight response input.

### 4. Protect Audio Playback Reliability

The audio reliability rule is: use native media playback for the audible answer.

Implementation guardrails:

- Do not close or recreate `RTCPeerConnection` when moving from listening to responding.
- Disable the microphone while generated response audio plays, then keep it disabled until the user taps **Listen** again.
- Mute direct Realtime remote audio during generated playback so there is no competing route.
- Switch Expo audio into speaker playback mode only for the generated response.
- Return to ready / **Listen** mode after the generated audio finishes.

To avoid the AI hearing itself:

- During response, ignore input transcript events for the in-flight generation.
- Keep `turn_detection.interrupt_response: false`.
- After response completion, clear or advance the local capture boundary so response audio does not become part of the next user request.
- After interpretation response completion, return to **Listen** / ready mode. Do not reopen the microphone automatically.
- Clear the Realtime input audio buffer when the user starts a new **Listen** turn so stale audio from a prior turn cannot be interpreted.
- If testing shows echo enters the input buffer, add a safe `input_audio_buffer.clear` event after response completion, without stopping the WebRTC track.

### 5. Keep the Conversation Continuous

Manual response should not feel like a disconnected TTS playback.

- Keep the Realtime session alive for the next listening turn.
- Use captured speech as explicit backend input so the response request is atomic and not dependent on a prior conversation item being indexed first.
- Keep meeting context, selected language, selected voice, and live version metadata in the backend audio request.
- Continue storing transcript, translation, and response history in the existing `liveVersions` model.

### 6. Backend Alignment

Backend changes should be small and explicit:

- Keep `turn_detection.create_response: false`.
- Keep `turn_detection.interrupt_response: false`.
- Prefer `controlled_voice` for this manual room flow.
- Keep `OpenAI-Safety-Identifier` on client secret creation.
- Add audit metadata indicating manual response mode if needed:
  - `sessionMode: controlled_voice`
  - `responseGate: manual`
  - `autoResponse: false`

Deploy backend only if backend code changes are required. UI-only changes do not need Cloud Run deployment.

### 7. UX Copy

Use clear, simple labels:

- Idle hint: "Tap Listen to start."
- Listening hint: "Listening. Tap Response when you want Synzapp to answer."
- No speech captured: "Speak first, then tap Response."
- Responding hint: "Synzapp is responding. Tap Listen again when you want it to listen."

Avoid technical terms such as VAD, realtime, session, or data channel in user-facing copy.

### 8. Verification Plan

Manual testing:

- Tap Listen, speak, confirm button changes to Response.
- Confirm no AI audio plays before tapping Response.
- Tap Response, confirm audio plays without leaving the live room.
- Speak multiple sentences before tapping Response, confirm the response uses the full captured speech.
- After response finishes, confirm the microphone stays closed and the button returns to Listen.
- Tap Listen again, speak again, and tap Response again without restarting the session.
- Confirm iOS speaker/Bluetooth route still plays after several Listen -> Response cycles.
- Confirm background noise does not trigger a response.
- Confirm End closes tracks and clears the audio route.

Code verification:

- Run mobile TypeScript checks/build command available in the project.
- Run backend build only if backend files change.
- If backend changes are made, deploy Cloud Run and verify `/health` and `/health/ready`.

## Risk Controls

- Keep existing translation and buffered playback flows isolated.
- Do not change chat media, meeting summary, or non-interpreter audio players.
- Do not remove the existing `translation` realtime session mode.
- Do not break the current route controls for speaker, Bluetooth, or system output.
- Add implementation behind the current Interpreter screen only.

## Success Criteria

The implementation is complete when:

- The button changes from **Listen** to **Response** while the mic is open.
- The AI never speaks before **Response** is tapped.
- The response includes all meaningful speech captured since listening began or since the previous response.
- Audio reliably plays in the same live conversation after listening.
- After a response completes, the microphone stays closed and the button returns to **Listen**. The next listening turn starts only when the user taps **Listen** again.
- The session can complete repeated Listen -> Response cycles without restarting.
- The UI remains simple and professional for operators in a real meeting.
- Device verification uses a Release/native bundle. A Debug install that says `Waiting on http://localhost:8081` is a Metro-driven development install, not the standalone installed-app flow.

## Production Fix Notes

- August 2026: Backend revision `synzapp-backend-00077-7j4` fixed the OpenAI Responses JSON-mode request by adding an explicit `json` output requirement inside the user input message.
- August 2026: The mobile controlled-response flow now waits for the committed Realtime transcription to settle before preparing speech. This prevents long listening turns from being interpreted from only the first or last short transcript segment.
- The Interpreter screen now merges transcript candidates append-only with overlap protection, instead of choosing the first non-empty transcript snapshot. This is required for 60-120 second listening windows where Realtime transcription arrives in multiple finalized chunks.
- August 2026: Backend revision `synzapp-backend-00079-mxk` expanded the interpreter language catalog and allows controlled voice responses to use any supported output language selected by the user.
- August 2026: The mobile live room now separates **Preparing audio** from **AI speaking** so the badge only says speaking when native audio playback is active.
- August 2026: The next Listen turn after generated audio now starts a fresh controlled Realtime capture connection while keeping the live room open. This avoids stale microphone capture on iPhone after native audio playback.
