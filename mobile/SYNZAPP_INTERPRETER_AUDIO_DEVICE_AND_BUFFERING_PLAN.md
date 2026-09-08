# Synzapp Interpreter Audio Device and Continuous Buffering Plan

## Objective

Make the AI Interpreter behave like a serious enterprise interpretation room: continuous live segment preparation, immediate replay when a response language is selected, loudspeaker-first playback, external microphone awareness, screen-awake protection, and summary generation from the complete captured meeting context.

## Current Findings

- The live prepared-audio queue is capped at 4 chunks in `InterpreterScreen.tsx`. That is the root cause of long conversations only having a few prepared segments.
- The valid enterprise limit is 4 response languages per meeting, not 4 interpreted segments.
- Prepared segment audio is currently kept as base64 in React state after being cached to disk. That creates memory pressure during longer meetings.
- Playback uses `expo-audio` with `shouldRouteThroughEarpiece: false`, but native routing is not actively reinforced. The app already includes `react-native-incall-manager`, which can force speakerphone and prefer external audio routes on native builds.
- `expo-audio` does not expose a full output-device picker. WebRTC can expose microphone input devices through `mediaDevices.enumerateDevices()` when the native runtime supports it.
- Summary creation uses saved transcript records plus a live snapshot. The live snapshot should include all buffered segment source text, not just the visible latest transcript.
- Spoken segment audio currently includes an intro per segment, which breaks the natural continuous listening experience.

## Enterprise Design

### Continuous Segment Buffer

- Keep the 4-language limit for simultaneous response languages.
- Remove the 4-segment processing limit.
- Prepare new interpretation audio chunks continuously while the AI is listening.
- Cache every prepared chunk to a local file immediately.
- Store only metadata and the local file URI in active React state, not large base64 payloads.
- Reset the queue only when the interpreter session ends or a new listening session starts.

### Human Interpreter Speech Flow

- The backend remains responsible for natural, human-style interpretation text.
- Each segment must preserve meaning, sequence, tone, names, numbers, dates, risks, decisions, and operational details.
- The first prepared spoken segment may include a short dynamic intro.
- Later prepared segments must continue naturally without repeating an intro.
- Summary speech should be comprehensive and natural, built from the full captured context.

### Audio Route

- Playback is loudspeaker-first.
- The app forces speakerphone routing when entering speaker playback.
- If a Bluetooth or wired output route is active at the OS level, the app should respect that route and avoid routing to the earpiece.
- The current stack can expose microphone input devices through WebRTC where supported.
- Output device enumeration is not fully exposed by Expo today; the settings UI should show the selected output policy clearly and apply what the native runtime supports.

### Input Device Selection

- The interpreter settings surface shows available microphone inputs from the native WebRTC runtime when provided by the device.
- Users can select automatic microphone routing or a specific input device.
- Output policy and speaker routing take effect immediately after Save.
- Microphone input selection takes effect the next time the user taps Listen.

### Screen Awake

- While the interpreter room is open, Synzapp keeps the screen awake.
- When the room is closed, the app releases that keep-awake hold.

### Summary

- The summary engine receives saved transcripts, live transcripts, and buffered segment source text.
- Summary text and spoken summaries should be detailed, practical, and simple enough for employees to understand.
- Summary audio should avoid repetitive robotic intros and speak as a real workplace interpreter.

## Implementation Steps

1. Remove the segment cap and keep response-language cap separate.
2. Cache prepared segment audio to file before adding it to state, then strip base64 from queued state.
3. Add backend `includeIntro` support for spoken segment generation.
4. Include buffered source segments in the summary snapshot and stop truncating active session history to only 80 items.
5. Add native audio route helpers for speakerphone-first playback and keep-screen-awake behavior.
6. Add WebRTC microphone device discovery and selected input-device constraints.
7. Extend the interpreter settings UI with Audio output and Microphone input sections.
8. Run mobile and backend type checks.

## Validation

- Start a meeting with 4 response languages and speak for more than 4 segments.
- Confirm every later segment continues preparing and can replay in the selected language.
- Confirm speaker audio does not route to the earpiece.
- Confirm Bluetooth speaker route is respected when connected.
- Confirm selected microphone input is used on the next Listen cycle when supported by the runtime.
- Confirm the screen stays awake while the interpreter room is open.
- Confirm summaries include older and newer captured segments.
