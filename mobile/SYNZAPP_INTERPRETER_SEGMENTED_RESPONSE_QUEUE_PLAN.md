# Synzapp Interpreter Segmented Response Queue Plan

## Objective

Reduce perceived interpreter response latency without sacrificing translation quality. Synzapp may prepare audio while the speaker is talking, but the audible response must remain a coherent ordered interpretation of the captured turn, not a stitched sequence of tiny independent clips.

## Enterprise UX Principle

The user remains in control:

- **Listen** opens the microphone and captures speech only.
- Synzapp may prepare private response audio in the background, but it must not speak.
- **Response** closes listening and starts playback from the first prepared interpretation unit for the captured turn.
- If the final tail was not prepared before **Response**, Synzapp prepares that tail while already-prepared audio is playing.
- Status labels must be truthful: preparing, ready, speaking, and listening must reflect actual state.

## Architecture

The implementation uses a two-layer pipeline:

1. **Realtime capture layer**
   - Keeps the controlled realtime session open for microphone capture and transcript updates.
   - Does not allow the model to speak automatically.
   - Commits listening checkpoints while the speaker is talking so transcription and segment preparation can start before **Response** is tapped.

2. **Ordered preparation layer**
   - Watches stable transcript growth while listening.
   - Locks natural thought blocks using minimum, target, and maximum text sizes.
   - Prefers sentence boundaries, then phrase boundaries, then word boundaries.
   - Prepares each unit once for the selected target language and voice.
   - Caches returned audio files locally in the same order as the source speech.
   - Uses source-text cursors so translated text never determines what source speech has already been prepared.

3. **Manual response playback layer**
   - On **Response**, pauses listening and commits the latest input audio.
   - Starts with the first prepared unit when available.
   - Drains the remaining unprepared tail in the background.
   - Advances playback strictly by queue index so units cannot repeat or play out of order.
   - Waits briefly for the next ordered unit only when the tail is still being prepared.
   - Marks the response boundary only after audio has actually played so unplayed tail speech is not discarded.

## Guardrails

- No automatic AI speech while the microphone is open.
- No duplicate audio requests for the same transcript cursor, language, voice, and live version.
- No duplicate queued audio for the same translation id or normalized source segment.
- Prepared audio must include source cursor metadata and may only enter the playback queue when it starts exactly where the current queue ends.
- Playback must filter the queue against the exact final captured transcript so stale or overlapping background units cannot be replayed.
- Native audio completion events must be handled once per active audio key.
- Native audio progress must be watched directly so a stale playback state cannot leave the UI stuck on **AI speaking**.
- The app must never play prepared audio while the microphone is open.
- The app must never reorder prepared units to chase speed.
- Translation quality and listener comprehension take priority over shaving a few seconds from preparation.
- If background preparation fails, the app must still attempt to prepare the missing ordered tail after **Response**.
- Short speech should not create many tiny segments.
- Long speech should not wait for the entire transcript before the first audio starts.
- The backend remains the authority for translation and speech generation.
- Mobile local cache stores prepared audio only for playback reliability; it is not the source of record.

## Implementation Steps

### 1. Source of Truth

- Add this plan document and keep it aligned with the controlled interpreter plan.

### 2. Mobile Preparation Scheduler

- Add a debounced preparation scheduler that runs when `liveTranscript` changes during listening.
- Call the existing `prepareBufferedInterpretationAudio()` for the active version and selected output language.
- Do not prewarm when the user has not selected an output language, the mic is closed, or response playback is active.
- Store prepared audio as an append-only ordered queue for each version/language.
- Deduplicate prepared audio by source-text fingerprint, language, voice, and live version.

### 3. Response Playback

- On **Response**, prefer the ordered prepared audio queue for the current live version.
- If the first unit is not ready yet, wait only for the first unit rather than the entire monologue.
- Start playback as soon as the first unit is available.
- Drain the remaining final source text while playback is already running.
- Mark the response boundary after playback completes for the units that actually played.
- Use a playback progress watchdog in addition to native completion events so segment transitions continue when the native player reports a stale `playing` state.

### 4. UI Status

- Use existing accurate status badge:
  - **Listening only** while capturing.
  - **Preparing audio** while a segment is being generated.
  - **AI speaking** while native audio is playing.
- The Live Translation panel should show the current captured speech and the latest translated segment.

### 5. Verification

- Run TypeScript checks.
- Install the Release build on device and test:
  - short speech fallback
  - long speech coherent-turn playback
  - repeated Listen -> Response turns
  - output language selected before listening
  - no automatic speech while listening
  - no duplicate playback after one response
  - long speech starts speaking from the first prepared unit instead of waiting for the full monologue

## Implementation Status

- Added a debounced mobile prewarm scheduler that starts response preparation from realtime transcript updates while the microphone is open.
- Corrected controlled-voice preparation so the hosted audio endpoint receives natural thought blocks, not tiny independent fragments.
- Updated **Response** to start from the first prepared ordered unit and continue draining the unprepared tail.
- Restored ordered tail playback with source-cursor guardrails so separate prepared clips cannot repeat, drift, or play out of order.
- Updated the status badge path so background preparation during listening is visible without implying that Synzapp is speaking.
- Added microphone-level gated listening checkpoints so long speech is committed into private transcript segments while the mic stays open.
- Hardened playback queue deduplication and native playback completion guards so one prepared segment cannot replay multiple times.
- Kept segment cursors source-speech based so translated text never becomes the marker for which source speech has been prepared.
- Added an audio-progress watchdog so finished or stalled segment playback advances to the next queued/tail segment instead of leaving **AI speaking** visible forever.
- Changed the **AI speaking** signal to require actual playback, while **Preparing audio** is shown when the app is waiting for the next segment.
- Moved the manual response source boundary update to playback completion so long speech is not marked handled before the audible translation finishes.
- Added natural source-unit selection with minimum, target, and maximum text thresholds.
- Added strict index-based playback so units play in capture order.
- Added final-tail drain support so long speeches can start playing before the last tail unit is prepared.
- Removed derived prepared-audio source chunks from the live transcript collector so output audio can never become new input text.
- Added cursor start/end metadata to each prepared unit and reject late units that no longer match the queue cursor.
- Added final transcript queue filtering so repeated phrases are only accepted when they occur at the correct source position.
- Removed obsolete full-turn helper functions that encouraged late, single-job playback.
- TypeScript verification: `npm run typecheck` from `SYNZAPP/mobile`.

## OpenAI Realtime Notes

OpenAI Realtime supports low-latency audio sessions and explicit client-side event control. For this controlled interpreter flow, Synzapp keeps automatic model speech disabled and uses transcript events plus hosted response-audio generation for reliable iPhone playback.

References:

- https://developers.openai.com/api/docs/guides/realtime
- https://developers.openai.com/api/docs/guides/realtime-conversations
- https://developers.openai.com/api/docs/guides/text-to-speech
