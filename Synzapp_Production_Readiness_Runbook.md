# Synzapp Production Readiness Runbook

Date: 2026-06-08

## Purpose

This runbook closes the current enterprise-readiness foundation before broad chat feature expansion. It defines the local gates Synzapp must pass, the Firebase Console steps that must be done before public release, and the operational checks that must exist in production.

## Local Verification Gates

Run these from the project root before moving into new chat features:

```bash
cd backend
npm test
npm run build
PATH=/opt/homebrew/bin:$PATH npm run emulators:rules
cd ../mobile
npx tsc --noEmit
```

Use Node 20.19.4 or newer. The current local shell may use Node 18 unless `/opt/homebrew/bin` is placed first in `PATH`.

## Firebase Emulator Rule Tests

Required coverage:

- Active tenant users can read allowed tenant records.
- Cross-tenant reads fail.
- Inactive users fail even with matching tenant claims.
- Direct-chat participants can read chat metadata and their encrypted envelopes.
- Non-participants cannot read direct-chat metadata or envelopes.
- Tenant company logo reads are tenant-scoped.
- Encrypted chat backup reads are owner-scoped.
- Client writes to backend-owned Firestore records and Storage paths are denied.

Command:

```bash
cd backend
PATH=/opt/homebrew/bin:$PATH npm run emulators:rules
```

## API Authorization Tests

Required coverage:

- Protected admin routes require Firebase bearer tokens.
- Protected profile routes require Firebase bearer tokens.
- Auth session verification requires Firebase bearer tokens.
- Route guard coverage verifies App Check middleware, Firebase session verification, and active-device requirements.
- Resource authorization policy verifies tenant ownership, active status, direct-chat participant membership, and encrypted-envelope sender or recipient access.

Command:

```bash
cd backend
npm test
```

## App Check Rollout

The backend App Check hook is implemented and tested. Do not enable production enforcement until real iOS and Android devices can complete login and backend calls with valid App Check tokens.

Rollout steps:

1. Configure App Check for the iOS and Android Firebase apps.
2. Verify debug providers only in development builds.
3. Confirm real devices send `X-Firebase-AppCheck` to the backend.
4. Deploy the backend with `SYNZAPP_REQUIRE_APP_CHECK=false`.
5. Confirm valid devices continue to pass login, session restore, profile, admin, chat, backup, and media calls.
6. Enable Firebase Console App Check enforcement for Firebase products after device verification.
7. Deploy the backend with `SYNZAPP_REQUIRE_APP_CHECK=true`.
8. Verify missing or invalid App Check tokens receive `401`.
9. Monitor App Check failures for false positives before expanding release.

## Dependency Remediation Plan

Current audit results are documented in `Synzapp_Dependency_Audit_Report.md`.

Do not run forced audit fixes on the current app. The proposed npm paths include backend major-version downgrade risk and mobile Expo/auth major-version risk.

Required remediation tracks:

- Backend: track Firebase Admin and Google Cloud transitive dependency advisories. Test any targeted override or Firebase Admin upgrade in a dedicated branch before merging.
- Backend dev tooling: monitor `firebase-tools` advisories separately because emulator tooling is not production runtime code.
- Mobile: replace or upgrade the phone-auth reCAPTCHA dependency through a tested Expo-compatible path.
- Mobile: perform a dedicated Expo platform upgrade only with iOS and Android real-device regression.

## Mobile Security Review

The current review is documented in `Synzapp_Mobile_Security_Review.md`.

Minimum before enterprise pilot:

- Real-device phone auth and session restore test on iOS and Android.
- Device registration and revocation test.
- Encrypted local chat store test across app restart.
- Offline queued-message test across network loss and recovery.
- Encrypted backup upload and restore test.
- Deactivated-user restore denial test.
- Profile photo upload, local cache, and fallback avatar test.

## Restore Procedure Test

Automated backend coverage validates that restore accepts only encrypted v1 backup payloads and rejects plaintext-like, incomplete, or unsupported backup payloads.

Manual real-device rehearsal:

1. Sign in as an active tenant member on Device A.
2. Send and receive messages until local encrypted chat history exists.
3. Enable tenant encrypted backup policy.
4. Upload encrypted chat backup.
5. Delete the app or clear local app storage.
6. Reinstall or relaunch the app.
7. Complete phone auth.
8. Register the active device.
9. Restore with the approved enterprise recovery path.
10. Confirm messages reappear from decrypted local storage.
11. Deactivate the user from the Org Admin account.
12. Repeat restore and confirm the user receives a generic access-denied native alert.

## Monitoring And Alerting

Backend health endpoints:

- `GET /health`
- `GET /health/live`
- `GET /health/ready`

Production alerts to configure:

- `/health/ready` returns `503` for more than 2 minutes.
- Backend 5xx rate exceeds the normal baseline.
- Auth/session-denied events spike.
- OTP preflight rate-limit events spike.
- App Check failures spike after enforcement.
- Active-device verification failures spike.
- Backup upload or restore failures spike.
- Realtime chat disconnects spike.
- Queue retry failures or stuck queued messages spike.
- Dependency audit introduces high or critical findings.
- Firebase Auth SMS usage exceeds the budget threshold.
- Firestore read/write or Storage bandwidth spend exceeds the budget threshold.

Required dashboards:

- Auth success, denial, restore, and logout counts.
- OTP preflight attempts and rate-limit blocks.
- App Check accepted and rejected calls.
- Active-device registration and revocation counts.
- Chat send, delivery, read, queued, retry, and failure counts.
- Backup upload, restore, denied restore, and policy-change counts.
- Backend latency and error rate.
- Firebase cost and SMS usage.

## Release Decision

Synzapp can continue controlled feature development after the local gates pass. Public enterprise launch must wait until App Check is enforced, dependency remediation is completed or formally risk-accepted, real-device restore rehearsal passes, and production alerting is connected to the chosen monitoring provider.
