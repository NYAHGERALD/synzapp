# Synzapp Interpreter True Realtime Translation Plan

## Goal

Deliver the controlled interpreter flow required for Synzapp:

1. The user taps `Listen`.
2. Synzapp streams microphone audio without interruptions.
3. The AI captures what the speaker actually says.
4. The user taps a response language.
5. Synzapp immediately plays a clean, natural, faithful spoken interpretation.
6. The interpreter does not summarize, invent, answer, or add unrelated wording.
7. Summary remains a separate feature and never changes live interpretation behavior.

## Root Cause Found

The current live room still uses a `controlled_voice` realtime session for the primary language-button path. That session is powered by the general `gpt-realtime-2.1` voice-agent endpoint and then receives a `response.create` request with captured transcript text.

That is the wrong primary architecture for a professional interpreter because:

- It makes a voice agent behave like an interpreter after the fact.
- It can sound like a summary or assistant response when the prompt is not enough.
- It depends on replay/segment audio generation for language playback.
- It does not use the dedicated Realtime Translation endpoint as the source of truth.

The backend already supports the dedicated translation path:

- `OPENAI_INTERPRETER_REALTIME_MODEL=gpt-realtime-translate`
- `/v1/realtime/translations/client_secrets`
- `/v1/realtime/translations/calls`

The mobile live room must use that path for the primary listen/translate experience.

During implementation, a second root cause was found in the mobile realtime parser: translation transcript events were only accepted while a generic `response.create` interpretation response was active. Dedicated realtime translation sessions do not use that response lifecycle, so the app was discarding the translation text needed for faithful replay/history.

## Enterprise Architecture

### Live Translation Sessions

- Start one realtime translation session per selected response language, with a maximum of four active response languages per meeting.
- Use `gpt-realtime-translate` for each session.
- Keep every language session listening to the same microphone stream.
- Keep translated audio muted until the user taps a language.
- When the user taps a language, first play the already-prepared replay audio for the current version when it exists; otherwise unmute that language's realtime audio stream and mute all other language streams.
- Keep the session alive until the user taps `Listen` again for a new version or ends the meeting.

### Replay And History

- Use backend-generated segment audio only for replay, audit, and history.
- Segment audio generation must run asynchronously and must not block the live language tap.
- If translated text already exists from the realtime translation session, the backend should speak that text directly instead of translating again.
- Stored replay should preserve:
  - source transcript
  - translated text
  - target language
  - interpreter voice
  - version id and sequence
  - audit timestamps

### Interpretation Quality Rules

Live interpretation must:

- Preserve meaning, order, names, dates, numbers, risks, actions, decisions, and instructions.
- Correct grammar and unclear speech into natural spoken language.
- Avoid word-for-word robotic translation.
- Avoid summaries, conclusions, advice, or additional context.
- Avoid repeated introductions between segments.
- Never speak prompt text or system wording.

### UX Rules

- `Listen` starts a new version.
- Language buttons are always replayable for the selected version when content exists.
- Active language button shows a clear `Speaking` state.
- The player reflects real audio state, not just text streaming.
- Text transcript is informative, but audio is the primary success path.
- Summary uses the selected version unless the user chooses the whole meeting.

## Implementation Steps

1. Update the mobile realtime service so each session can be started with `translation` mode and per-session remote audio volume control.
2. Update the live room to create a translation session for every selected response language.
3. Replace the active language-button live path so it unmutes the selected translation session instead of issuing `response.create`.
4. Keep backend segment audio as background replay/history generation only.
5. Update backend segment audio creation so provided translated text is spoken directly and not re-translated.
6. Keep summaries separate and version-aware.
7. Run mobile and backend typechecks.

## Build And Deployment Notes

- Backend changes require deploy before testing replay/history behavior.
- Mobile changes require a new app build because native WebRTC/audio behavior is in the installed app.
- No secret values are stored in this plan.
