# Synzapp Interpreter: Multilingual Controlled GPT Live Plan

## Purpose

Add multilingual output to the working controlled GPT Live interpreter without breaking the manual mic gate:

`Listen -> microphone opens and AI only listens -> Respond -> microphone closes and AI speaks -> Listen again`.

The implementation must preserve the current low-friction live session, avoid segmented TTS, avoid duplicated audio, and avoid the dedicated continuous translation endpoint for this controlled mode.

## OpenAI documentation findings

Official OpenAI Realtime guidance separates two architectures:

- Standard Realtime speech-to-speech sessions use `gpt-realtime-2.1`, a conversation and response lifecycle, and can be manually controlled with `response.create`.
- Realtime translation sessions use `gpt-realtime-translate`, stream continuously from incoming audio, and do not use `response.create`.

Source:

- https://developers.openai.com/api/docs/guides/realtime-conversations
- https://developers.openai.com/api/docs/guides/realtime-translation
- https://developers.openai.com/api/docs/guides/realtime-webrtc
- https://developers.openai.com/api/docs/guides/realtime-transcription

## Honest enterprise recommendation

Use the standard controlled GPT Live session for this feature, not the dedicated translation endpoint.

Reason:

- The product requirement is manual control over when the AI listens and when it speaks.
- The dedicated translation endpoint is best for continuous live interpretation, but it cannot be controlled with `response.create`.
- The controlled `gpt-realtime-2.1` path already works in Synzapp and already supports per-response instructions.

## Language support policy

Synzapp should not present every language as equally validated for enterprise spoken output.

Use three practical capability levels:

- `Validated live voice`: languages already known to work well in low-latency live voice testing.
- `GPT Live supported`: languages available in the Synzapp catalog through controlled GPT Live, but still requiring internal QA for pronunciation, latency, and workplace vocabulary.
- `Fallback required`: languages that should remain available for transcript workflows but should not be promised as polished spoken interpretation until verified.

The first implementation will allow all catalog languages through the controlled GPT Live path while visually marking non-validated languages as requiring verification. This gives users access without making a false enterprise guarantee.

## Implementation design

1. Keep the current controlled WebRTC session and `response.create` gate.
2. Add a compact output language selector inside the live interpreter room.
3. Keep input language on the left as `Auto detect`.
4. Put output language on the right as a searchable selector.
5. Disable language switching while the AI is actively speaking.
6. Allow language switching before listening, while idle, and while listening before the user taps `Respond`.
7. Make the selected output language authoritative for the next `Respond` action.
8. Update backend controlled-session instructions so the model does not limit itself to only the meeting's original language list.
9. Keep transcripts and cleaned transcripts saved by the existing transcript persistence flow.

## UX requirements

- Live room remains compact.
- Output selector opens as a modern searchable overlay.
- Input remains auto-detected and displays the detected language when available.
- Output displays the selected language clearly.
- Non-validated languages show a gentle capability note, not a blocking error.
- The `Listen` / `Respond` button behavior must not change.

## Backend requirements

- Continue using `gpt-realtime-2.1` for controlled voice.
- Keep `turn_detection.create_response: false`.
- Keep `turn_detection.interrupt_response: false`.
- Treat per-response target language instructions as authoritative.
- Do not use `/v1/realtime/translations` for controlled mode.

## Verification

- Mobile TypeScript typecheck must pass.
- Backend TypeScript build must pass if backend code changes.
- Manual device validation:
  - Select Spanish, tap Listen, speak English, tap Respond, hear Spanish.
  - Select French, tap Listen again, speak English, tap Respond, hear French.
  - Change output language while AI is not speaking and confirm next response uses the new language.
  - Confirm `Listen` interrupts response and opens the mic gate again.

