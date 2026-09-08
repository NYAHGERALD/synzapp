# Synzapp Interpreter Push Notifications Plan

## Objective

Add enterprise-grade push notifications for Interpreter lifecycle events without changing or weakening the working controlled GPT Live interpreter room.

## Non-Negotiable Guardrails

- The controlled GPT Live flow remains untouched: Listen opens the mic gate, Respond closes it and lets GPT Live speak, and Listen can interrupt speech for the next turn.
- Push notifications are emitted from backend-owned lifecycle events, not from optimistic mobile UI state.
- Every notification remains tenant scoped and recipient resolved on the backend.
- Notification payloads must be private and concise. They may include routing metadata, but not full transcript text, summary text, or audio content.
- Audio-ready notifications fire only after the backend has completed the durable preparation step.
- Reminder notifications are backend scheduled. The mobile client must not be the source of truth for time-based delivery.
- Notification delivery must never block session creation, live interpretation, session end, transcript readiness, or summary readiness responses.

## Events

1. **Read-aloud transcript ready**
   - Trigger: saved transcript audio artifact reaches `ready`.
   - Recipients: meeting owner and the transcript creator.
   - Payload: meeting id, segment id, artifact id, language code.

2. **Summary audio ready**
   - Trigger: spoken summary audio is created for a selected summary language, or summary creation returns prepared audio.
   - Recipients: meeting owner and the summary creator.
   - Payload: meeting id, summary id, language code.

3. **Interpreter session ended**
   - Trigger: meeting status changes to `ENDED`.
   - Recipients: meeting owner and invited participants.
   - Payload: meeting id and ended timestamp.

4. **Interpreter session scheduled**
   - Trigger: scheduled meeting is created.
   - Recipients: meeting owner and invited participants.
   - Payload: meeting id and scheduled timestamp.

5. **Interpreter session starts soon**
   - Trigger: backend reminder worker reaches the reminder time.
   - Default: scheduled meetings get a 5-minute one-time reminder unless an explicit reminder setting is provided.
   - Recipients: meeting owner and invited participants.
   - Payload: meeting id and scheduled timestamp.

## Backend Implementation

- Reuse `sendInterpreterPushNotification` so all delivery events are stored in tenant `notificationEvents`.
- Use deterministic notification ids for one-time events to prevent duplicate readiness pushes.
- Add small helper functions in `interpreterService.ts` for recipient resolution and notification dispatch.
- Keep notification metadata small and serializable.
- For scheduled meetings, set the backend default reminder to `once` at 5 minutes when the client schedules a meeting but does not provide reminder settings.

## Mobile Implementation

- Add an Interpreter notification channel on Android.
- Add typed interpreter notification payload parsing beside existing chat/call payload parsing.
- Keep notification handling generic and non-invasive; no live room state changes happen from receiving a notification.

## Validation

- Backend typecheck.
- Mobile typecheck.
- Interpreter enterprise control tests updated to assert:
  - Interpreter notification channel/payload support exists on mobile.
  - Scheduled meetings default to a 5-minute backend reminder.
  - Transcript audio, summary audio, session scheduled, and session ended events call backend interpreter push delivery.

## Future Hardening

- Move reminder dispatch from the in-process worker to Cloud Scheduler or Cloud Run Jobs for fully reliable delivery when Cloud Run scales to zero.
- Add user-level notification preferences for interpreter reminders and readiness events once preference management is expanded beyond chat.
