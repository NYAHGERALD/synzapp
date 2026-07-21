# Synzapp Enterprise Calling Architecture Plan

## Goal

Make Synzapp calling behave like a clean enterprise-grade WhatsApp-style calling system:

- Native system call screen owns background, minimized, locked, or killed-app incoming calls.
- Synzapp custom call UI owns foreground incoming calls and all in-call controls after answer.
- Backend is the source of truth for call lifecycle state.
- Devices never show duplicate native and custom incoming-call screens for the same call.
- Call transitions are observable, idempotent, and secure.

## Enterprise Rules

1. Native incoming presentation is platform-specific.
   - iOS background or minimized: APNs VoIP push + PushKit + CallKit.
   - Android background or minimized: FCM high-priority call notification/full-screen intent.
   - Foreground app: Synzapp custom incoming UI may be shown.

2. Custom UI is not a background-call replacement.
   - The custom Synzapp incoming screen should only show when the app is active.
   - After a native answer, Synzapp opens the custom in-call screen.

3. Backend owns call state.
   - States: `ringing`, `answered`, `declined`, `missed`, `busy`, `ended`, `failed`.
   - Devices request transitions; backend validates and broadcasts them.
   - Duplicate answer/end messages must be safe and idempotent.

4. Push wakes the device; WebSocket synchronizes the session.
   - Push should present the incoming call.
   - WebSocket should synchronize call state and WebRTC signaling once the app is active.

5. Enterprise observability is required.
   - Log call created, incoming event sent, push queued/sent/failed, native display failure, answer, decline, missed timeout, end, and signaling authorization failures.

## Implementation Steps

1. Backend call session authority
   - Replace plain active-call records with call sessions that include status, answeredByUid, endedByUid, endedAt, timestamps, and timeout handling.
   - Enforce participant authorization for answer, end, and signal relay.
   - Add missed-call timeout to end unanswered sessions cleanly.

2. Realtime contract
   - Include `status` and lifecycle metadata in call events.
   - Broadcast authoritative `callAnswered` and `callEnded` events.
   - Avoid duplicate final events after a call is already ended.

3. Mobile foreground/background separation
   - Track app state.
   - Foreground incoming calls may show Synzapp custom incoming UI.
   - Native-presented iOS calls suppress the custom incoming screen until answer.
   - Regular push taps/deep links should not duplicate an existing native-presented call.

4. Native iOS safety
   - Keep PushKit + CallKit as the native background path.
   - Report CallKit presentation errors into JS logs.
   - Ensure APNs entitlement is generated for development and production builds.

5. Operational requirements
   - Backend environments must configure APNs VoIP credentials for iOS minimized calls.
   - Fresh native iOS builds are required after entitlement or Swift changes.
   - Validate scenarios: foreground, minimized, locked screen, declined, missed, busy, ended, and poor network.

