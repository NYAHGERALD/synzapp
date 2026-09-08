# Synzapp Interpreter Controlled GPT Live Gate Plan

## Objective

Implement the Interpreter as a controlled GPT Live session where Synzapp owns when the microphone listens and when the AI speaks.

The experience must be:

1. User taps `Listen`.
2. Synzapp opens the microphone gate.
3. GPT Live listens and transcribes only.
4. User taps `Respond`.
5. Synzapp closes the microphone gate and sends a single `response.create`.
6. GPT Live speaks through the same WebRTC session.
7. When the response ends, the microphone remains closed.
8. User taps `Listen` again to start the next listening turn.
9. If the user taps `Listen` while GPT Live is speaking, Synzapp cancels output audio and immediately opens the microphone gate for the next turn.

## OpenAI Realtime Architecture

Use the OpenAI Realtime WebRTC session with manual response control.

The backend session must use:

- `turn_detection.type: "server_vad"`
- `turn_detection.create_response: false`
- `turn_detection.interrupt_response: false`
- `input.transcription.model: gpt-live-transcribe`
- realtime voice model from `OPENAI_INTERPRETER_AGENT_REALTIME_MODEL`
- audio output enabled

This keeps VAD and transcription active while preventing automatic AI speech. The app triggers speech only with `response.create`.

Do not use the Realtime translation endpoint for this controlled mode, because that endpoint is designed for continuous translated output and does not match the required Listen/Respond gate.

Do not use segmented TTS or chunk translation for the live room. It causes duplicated speech, ordering problems, and bad audio continuity.

## Mobile State Machine

`idle`
: No live session is active.

`connecting`
: WebRTC and OpenAI Realtime session are being prepared.

`listening`
: Local microphone track is enabled. GPT Live may transcribe, but must not speak.

`choosing`
: Session is alive, microphone is muted, and Synzapp is waiting for the next `Listen`.

`responding`
: Local microphone track is disabled. GPT Live is speaking.

## Button Behavior

Primary button:

- `idle` or `choosing`: label `Listen`; action opens or resumes the microphone gate.
- `listening`: label `Respond`; action closes the microphone gate and sends `response.create`.
- `responding`: label `Listen`; action cancels the response, clears output audio, clears stale input audio, and opens the microphone gate.
- `connecting`: label `Preparing`; disabled.

## Audio Control Rules

- Never allow GPT Live to auto-respond while the microphone gate is open.
- Disable the local microphone track before creating a response.
- Keep the remote audio track mounted for the life of the session.
- Do not reopen the microphone automatically after GPT Live finishes speaking.
- When interrupting a response, send `response.cancel` and `output_audio_buffer.clear`, then reopen the microphone.
- When opening a new listening turn, send `input_audio_buffer.clear` to avoid stale buffered audio.

## Transcript Rules

- Keep live transcription visible during listening.
- Save raw transcript and cleaned transcript when the room closes or the active live version stops.
- Normalize punctuation spacing so words are not concatenated.
- Do not generate synthetic transcript text from the audio response.

## Acceptance Criteria

- Tapping `Listen` starts a live session or resumes the existing one.
- GPT Live does not speak during listening.
- Tapping `Respond` makes GPT Live speak once for the captured speech.
- After GPT Live finishes, the UI shows `Listen`, not `Responding`.
- The microphone remains closed after GPT Live finishes.
- Tapping `Listen` while GPT Live is speaking interrupts the response and starts listening.
- The Realtime session is not torn down between normal Listen/Respond turns.
- Live transcript and cleaned transcript are preserved and saved.
- Backend changes are deployed after implementation.
