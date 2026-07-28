# Synzapp Enterprise AI Interpreter Plan

## Purpose

Synzapp Interpreter is a standalone voice interpretation feature for supervisors, managers, and teams that work across multiple spoken languages. It is intentionally separate from Synzapp Chat. It must not read chat messages, write chat messages, use chat attachments, or reuse chat memory.

The feature is for live workplace conversations such as:

- 1-on-1 meetings between a supervisor and an employee.
- Level 1 team meetings with one speaker and one or more listening languages.
- Level 3 or multi-department meetings where the speaker may change language and the room needs several target languages ready.

The experience should feel like a real interpreter:

- The interpreter listens continuously after the meeting starts.
- It does not speak until the manager taps a target language button.
- It prepares translations while the person speaks so playback is immediate when requested.
- It cleans up unclear speech into simple, natural spoken language without changing the intent.
- It can summarize the meeting so far in one or more configured meeting languages.

## Official OpenAI Direction

The correct OpenAI API surface is the Realtime Translation API, not the Chat Completions API and not Synzapp Chat translation.

Current official guidance supports this direction:

- OpenAI Realtime is intended for low-latency voice and audio sessions.
- OpenAI lists `gpt-realtime-translate` as the purpose-built model for streaming speech-to-speech translation.
- OpenAI recommends `/v1/realtime/translations` for continuous interpreter-style translation sessions.
- Mobile or browser clients should use short-lived client secrets minted by the backend; the normal OpenAI API key must stay server-side only.
- Realtime requests should include a privacy-preserving safety identifier bound on the backend when creating the client secret.

Source references:

- https://developers.openai.com/api/docs/guides/realtime
- https://developers.openai.com/api/docs/guides/realtime-translation
- https://developers.openai.com/api/docs/guides/realtime-webrtc
- https://developers.openai.com/api/docs/models

## Model Choice

Primary live interpreter model:

- `gpt-realtime-translate`

Backend summary model:

- `gpt-4.1-mini` can be used initially because Synzapp already has `OPENAI_MODEL` defaulting to that value.
- The summary model should be configurable so we can move to the latest approved enterprise text model without changing mobile code.

Environment variables:

- Existing required variable: `OPENAI_API_KEY`
- New recommended variables:
  - `OPENAI_INTERPRETER_REALTIME_MODEL=gpt-realtime-translate`
  - `OPENAI_INTERPRETER_SUMMARY_MODEL=gpt-4.1-mini`
  - `INTERPRETER_MAX_TARGET_LANGUAGES=6`
  - `INTERPRETER_RETENTION_DAYS=30`
  - `INTERPRETER_AUDIO_RETENTION=disabled`
  - `INTERPRETER_SUMMARY_ENABLED=true`

No OpenAI key should ever be shipped in the mobile app.

## Privacy Boundary

Interpreter is its own product area.

It must have separate:

- Mobile screens.
- Mobile services.
- Backend routes.
- Firestore collections.
- Audit events.
- Retention rules.
- Access checks.

It must not share:

- Chat local store.
- Chat encryption envelopes.
- Chat media pipeline.
- Chat message reactions.
- Chat translation feature history.
- Chat screen option menus.

This protects user trust and gives administrators a clean privacy policy: Chat remains private chat, Interpreter is a deliberate meeting tool with visible meeting controls.

## Enterprise Architecture

### Mobile Layer

New mobile feature area:

- `src/screens/InterpreterMeetingsScreen.tsx`
- `src/screens/InterpreterCreateMeetingScreen.tsx`
- `src/screens/InterpreterRoomScreen.tsx`
- `src/services/interpreterApi.ts`
- `src/services/interpreterRealtime.ts`
- `src/services/interpreterLocalStore.ts`
- `src/types/interpreter.ts`

The mobile app should add a dedicated `Interpreter` entry in the main app navigation. It should not be placed inside Chat.

### Backend Layer

New backend route:

- `/api/interpreter`

New backend files:

- `src/routes/interpreterRoutes.ts`
- `src/services/interpreterMeetingService.ts`
- `src/services/interpreterRealtimeTokenService.ts`
- `src/services/interpreterSummaryService.ts`
- `src/services/interpreterReminderService.ts`

The backend creates short-lived OpenAI Realtime Translation client secrets. The mobile app receives only the temporary client secret and never receives the root `OPENAI_API_KEY`.

### Realtime Path

For 1-on-1:

- Open one source audio stream.
- Open one active Realtime Translation session for the selected target language.
- Keep the translated audio muted or buffered until the user taps Respond.

For Level 1 and Level 3:

- English is always included by default.
- The user can add multiple target languages during meeting creation.
- Create a controlled session pool, one target language per active translation lane.
- Capture microphone once, fan out source audio to each target lane.
- Cap active target languages using `INTERPRETER_MAX_TARGET_LANGUAGES`.
- If the language count is too high, keep only priority languages hot and warm the others on demand.

Instant response is achieved by preparing translation while listening. The language button should not start translation from scratch. It should play the already-prepared output for that language.

### Meeting Memory

The reliable source of memory should be text transcripts and translation segments, not raw audio.

Default:

- Store source transcript segments.
- Store detected source language.
- Store translated transcript segments per target language.
- Store summary snapshots.
- Store audit metadata.

Raw audio:

- Disabled by default.
- May be enabled only by tenant policy with visible consent, retention limits, and admin approval.

This gives the AI enough meeting memory for summaries without retaining sensitive voice recordings by default.

## Data Model

Firestore tenant path:

- `organizations/{tenantId}/interpreterMeetings/{meetingId}`

### InterpreterMeeting

Fields:

- `id`
- `tenantId`
- `createdByUid`
- `createdByName`
- `meetingType`: `ONE_ON_ONE`, `LEVEL_1`, `LEVEL_3`
- `name`
- `status`: `DRAFT`, `SCHEDULED`, `READY`, `LIVE`, `PAUSED`, `ENDED`, `ARCHIVED`
- `sourceLanguageMode`: `AUTO_DETECT` or specific language code
- `targetLanguages`: language code array, always includes English unless English is the source-only language
- `scheduledFor`
- `reminderEnabled`
- `reminderOffsetMinutes`
- `reminderFrequency`
- `retentionDays`
- `audioRetentionMode`: `DISABLED`, `TENANT_APPROVED`
- `createdAt`
- `updatedAt`
- `endedAt`

### InterpreterSession

Fields:

- `meetingId`
- `startedByUid`
- `status`
- `startedAt`
- `endedAt`
- `activeTargetLanguages`
- `openAiSessionRefs`
- `connectionHealth`
- `latencyMs`

### InterpreterTranscriptSegment

Fields:

- `meetingId`
- `sessionId`
- `segmentIndex`
- `speakerLabel`
- `detectedLanguage`
- `sourceText`
- `confidence`
- `startedAt`
- `endedAt`
- `createdAt`

### InterpreterTranslationSegment

Fields:

- `meetingId`
- `sessionId`
- `sourceSegmentId`
- `targetLanguage`
- `translatedText`
- `audioAvailable`
- `audioPlaybackRef`
- `createdAt`

### InterpreterSummary

Fields:

- `meetingId`
- `requestedByUid`
- `targetLanguages`
- `summaryByLanguage`
- `coveredSegmentRange`
- `createdAt`

### InterpreterAuditEvent

Fields:

- `tenantId`
- `meetingId`
- `uid`
- `actorName`
- `action`
- `metadata`
- `createdAt`
- `requestId`

Audit events should include:

- Meeting created.
- Meeting updated.
- Meeting started.
- Realtime token issued.
- Target language added or removed.
- Interpreter paused or resumed.
- Respond button tapped.
- Summary generated.
- Meeting ended.
- Retention policy changed.

## Security Controls

Required controls:

- Firebase ID token required.
- App Check required.
- Tenant isolation on every route.
- Role authorization:
  - Org Admin, Department Admin, Supervisor, or approved Manager can create meetings.
  - Employees can join only meetings they are invited to.
- No client-side OpenAI key.
- Short-lived Realtime client secrets only.
- OpenAI safety identifier uses a hashed internal user id, not a phone number or name.
- Rate limit token creation and summary creation.
- Meeting access is checked before every session token is issued.
- Transcript retention follows tenant policy.
- Raw audio retention is off by default.
- Summaries are stored as meeting artifacts, not chat messages.

## User Experience

### Entry Point

Main mobile navigation adds:

- Interpreter

The screen opens to:

- Upcoming meetings.
- Live meetings.
- Recent interpreter meetings.
- New meeting button.

### Create Meeting

Fields:

- Meeting name.
- Meeting type:
  - 1-on-1
  - Level 1
  - Level 3
- Schedule for later toggle.
- Date and time.
- Reminder toggle.
- Reminder time frame.
- Reminder frequency.
- Speaker language:
  - Auto detect
  - Specific language
- Target languages:
  - English added by default.
  - Add more languages for Level 1 and Level 3.

### Interpreter Room

The room should feel focused and calm:

- Large listening state at the center.
- Visible privacy label: "Interpreter only. Not connected to Chat."
- Current detected language.
- Live source transcript preview.
- Target language buttons.
- Respond button behavior:
  - If a language button is tapped, play the prepared interpretation in that language.
  - If the selected language has no ready audio yet, show a tiny "finishing interpretation" state and play as soon as available.
- Pause listening.
- End meeting.
- Summary button.

### Live Interpreter Full-Screen Room

The active interpreter experience must run in a dedicated full-screen modal, separate from the setup and meeting administration screen.

The setup screen is for:

- Meeting metadata.
- Microphone readiness.
- Device realtime readiness.
- Participant access.
- Meeting summaries and audit memory.

The live room is for:

- Active listening.
- Responding in selected languages.
- Clear operator control during interpretation.
- Ending or minimizing the live session.

Required live-room behavior:

- Show a professional animated listening state while the AI is actively listening.
- Show the privacy label inside the live room: interpreter only, not connected to Chat.
- Display the target-language response buttons created during meeting setup.
- Tapping a response language pauses microphone listening and opens the interpretation audio gate for that language.
- While the interpreter is speaking, the primary control becomes `Listen`.
- Tapping `Listen` stops the current interpretation audio and returns to live listening.
- If the user cuts an interpretation short, show:
  - `Continue`: resumes the interrupted interpretation.
  - `Current`: discards the interrupted response and plays the latest prepared interpretation.
- The app must never create the OpenAI realtime session after the user taps a language. Sessions should already be prepared when the live room starts.
- Startup failures must expose the exact layer that failed:
  - Backend OpenAI configuration or model/session error.
  - Device microphone permission.
  - Missing native WebRTC runtime.
  - Realtime SDP negotiation failure.

Implementation note:

- Realtime Translation sessions are not voice-agent sessions. The mobile app should not use `response.create` as the interpretation trigger. The operator control is an audio/listening gate: pause microphone input, allow the selected translation lane to play, then resume listening.

### Summary Modal

Flow:

- User taps Summary.
- Native modal opens.
- User selects one or more configured meeting languages.
- Backend creates summaries from transcript segments.
- Summary appears in selected languages.
- Summary can be saved to meeting record.

### Accessibility

Required:

- Large language buttons.
- Clear listening, processing, and ready states.
- Captions visible while audio plays.
- Works in noisy workplaces with headset support.
- Haptic feedback when interpretation is ready.
- No tiny controls for critical actions.

## Latency Strategy

The feature must feel immediate.

Rules:

- Do not wait until the speaker finishes to start translation.
- Do not create the OpenAI session after the user taps a language.
- Do not send audio to backend for normal mobile WebRTC sessions.
- Do not block the UI thread while handling transcripts.
- Keep transcript writes batched and async.
- Use a small in-memory buffer for the latest translated audio per language.
- Use backend persistence as the audit and summary source, not as the live playback path.

## Backend API Draft

### Meetings

- `GET /api/interpreter/meetings`
- `POST /api/interpreter/meetings`
- `GET /api/interpreter/meetings/:meetingId`
- `PATCH /api/interpreter/meetings/:meetingId`
- `POST /api/interpreter/meetings/:meetingId/start`
- `POST /api/interpreter/meetings/:meetingId/end`

### Realtime

- `POST /api/interpreter/meetings/:meetingId/realtime-client-secret`

Body:

```json
{
  "targetLanguage": "es",
  "sourceLanguageMode": "AUTO_DETECT"
}
```

Response:

```json
{
  "clientSecret": "short-lived-secret",
  "targetLanguage": "es",
  "expiresAt": "2026-07-28T18:00:00.000Z"
}
```

### Transcript and Summary

- `POST /api/interpreter/meetings/:meetingId/transcript-segments`
- `POST /api/interpreter/meetings/:meetingId/translation-segments`
- `POST /api/interpreter/meetings/:meetingId/summaries`
- `GET /api/interpreter/meetings/:meetingId/summaries`

## OpenAI Request Shape

Backend token service uses:

```ts
await fetch('https://api.openai.com/v1/realtime/translations/client_secrets', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${env.openAiApiKey}`,
    'Content-Type': 'application/json',
    'OpenAI-Safety-Identifier': hashedUserId
  },
  body: JSON.stringify({
    session: {
      model: env.openAiInterpreterRealtimeModel,
      audio: {
        output: {
          language: targetLanguage
        }
      }
    }
  })
});
```

The mobile app then uses the short-lived value to connect to the Realtime translation call endpoint through WebRTC.

## Implementation Phases

### Phase 1: Plan and Feature Boundary

- Add this plan document.
- Confirm the feature is separate from Chat.
- Confirm meeting type names: 1-on-1, Level 1, and Level 3.
- Confirm tenant audio retention default is disabled.

### Phase 2: Backend Foundation

- Add interpreter env configuration.
- Add interpreter routes and services.
- Add meeting CRUD.
- Add role and tenant authorization.
- Add Realtime client-secret broker.
- Add audit events.
- Add summary endpoint.
- Add backend tests for authorization and route validation.

### Phase 3: Mobile Foundation

- Add Interpreter entry to main navigation.
- Add meeting list screen.
- Add create meeting wizard.
- Add interpreter room screen.
- Add interpreter API service.
- Add local draft cache for scheduled meetings.
- Add native modal error handling consistent with Synzapp.

### Phase 4: Realtime Translation Engine

- Add microphone permission flow.
- Add WebRTC session setup using `react-native-webrtc`.
- Add one-language 1-on-1 interpretation.
- Add multi-language session pool for Level 1 and Level 3.
- Add language buttons with prepared playback.
- Add live transcript display.
- Add connection health and graceful reconnect.

### Phase 5: Summaries and Retention

- Add summary language selector modal.
- Generate summaries from stored transcript segments.
- Store summary snapshots.
- Apply tenant retention policy.
- Add export hooks later only if approved by admin policy.

### Phase 6: Enterprise QA

- Test on physical iOS and Android devices.
- Test headset and speaker modes.
- Test noisy workplace audio.
- Test language switching.
- Test offline and poor network states.
- Test meeting end cleanup.
- Test that Chat data is never accessed.
- Test OpenAI API key never reaches mobile.

## What the User May Need to Provide

Nothing new is needed for the first implementation if `OPENAI_API_KEY` is already present on Render and local backend.

For production hardening, the user may later choose to add:

- Approved OpenAI project id, if the organization wants project-level isolation.
- Spend limits in the OpenAI dashboard.
- Render env variables listed in this plan.
- A tenant decision on whether raw audio retention is allowed. Default should remain disabled.

## Definition of Done

The feature is enterprise ready when:

- A supervisor can create and start a meeting.
- The interpreter listens continuously after Start.
- Tapping a target language plays interpretation without a noticeable wait.
- Level meetings support multiple target languages.
- Summaries can be generated in selected configured languages.
- Every sensitive action is audited.
- The OpenAI API key is never exposed to mobile.
- Chat remains completely untouched.
- The UI clearly communicates listening, processing, ready, speaking, paused, and ended states.
- The backend blocks unauthorized meeting access.
- The feature runs on both iOS and Android physical devices.

## Implementation Status - July 28, 2026

Completed:

- Backend interpreter environment variables are defined.
- Backend interpreter routes are mounted under `/api/interpreter`.
- Meeting create, list, open, start, end, transcript, translation, summary, and realtime-session endpoints are implemented.
- Backend tenant, active-user, and role authorization checks are in place.
- Backend OpenAI root API key stays server-side only.
- Backend now returns only the short-lived Realtime Translation client secret value to mobile, not the raw provider response.
- Backend creates target-language-specific Realtime Translation sessions.
- Backend now validates fixed speaker languages, scheduled meeting dates, and reminder dependencies before creating meetings.
- Backend now exposes the planned `GET /api/interpreter/meetings/:meetingId/summaries` endpoint.
- Backend now exposes a tenant-scoped interpreter participant directory, separate from admin employee management.
- Backend now supports controlled interpreter meeting invitations and validates invited users against active company profiles before access is granted.
- Backend now audits transcript and translation segment writes with privacy-safe metadata only, avoiding duplicated conversation text in audit events.
- Mobile has a dedicated Interpreter tab outside Chat.
- Mobile meeting list, create meeting modal, language selection, scheduling metadata, meeting room, summary display, and secure meeting memory console are implemented.
- Mobile meeting creation and room access controls now allow users to add or remove invited company participants through backend-backed access grants.
- Mobile now includes an isolated `interpreterRealtime` service for microphone capture, WebRTC session setup, event parsing, respond requests, and cleanup.
- Mobile room UI now shows live connection state, Start/Stop interpreter, selected-language response, live transcript preview, and live translation preview.
- Mobile Level 1 and Level 3 rooms now prepare a realtime session pool across all configured interpreter languages, with each language showing its own readiness state.
- Mobile 1-on-1 rooms start only the selected target language session to preserve cost and battery while still keeping response behavior instant for the selected language.
- Mobile now checks microphone readiness, requests microphone access from the interpreter room, and explains the readiness state before listening.
- Mobile now includes a device interpreter readiness check that verifies microphone permission and the installed native WebRTC runtime before real interpreting tests.
- Mobile microphone readiness is now separated from the room title header so it stays readable on smaller devices.
- Interpreter errors now use a Synzapp-styled modal overlay instead of platform alert popups.
- Meeting summaries now use a language selection modal so managers choose exactly which languages to summarize.
- Backend interpreter enterprise control tests are in place for route protection, participant access, validation, summary access, privacy-safe audit events, and short-lived client-secret handling.
- Backend and mobile TypeScript checks pass.

Still required before production release:

- Physical-device validation of OpenAI Realtime audio playback on iOS and Android using the new device readiness check.
- Automated backend route tests and mobile interaction tests.

## Real Device Validation Protocol

Use this sequence when validating on a physical iPhone or Android device:

1. Readiness-only test
   - Open the Interpreter tab.
   - Create or open a test meeting.
   - Tap `Allow` if microphone permission is not granted.
   - Tap `Check` in `Device interpreter check`.
   - Pass condition: Microphone, WebRTC, Media capture, and Peer session all show ready.

2. One-on-one live interpreter test
   - Create a `1-on-1` meeting with English and Spanish.
   - Start the live interpreter.
   - Speak one short sentence in English.
   - Tap Spanish.
   - Tap `Respond`.
   - Pass condition: the app stays responsive, status moves through listening/responding, and audio/text interpretation returns without exposing the OpenAI API key to mobile.

3. Level 1 / Level 3 multi-language test
   - Create a Level 1 or Level 3 meeting with English, Spanish, and one additional language.
   - Start the live interpreter.
   - Pass condition: the room prepares all configured language sessions, language status dots update independently, and the readiness row shows the correct number of ready sessions.

4. Meeting memory and summary test
   - Record one secure test segment.
   - Create a summary in multiple configured languages.
   - Pass condition: summary is returned only to authorized meeting users and audit logs do not store duplicated transcript text.
