# Synzapp Mobile Security Review

Date: 2026-06-08

## Scope

Reviewed the current mobile security posture for:

- Firebase phone authentication and backend session verification
- Device registration and active-device enforcement
- Role-aware UI hiding for unauthorized settings
- Local encrypted chat storage
- Pending outbound message queue
- E2EE message envelope handling
- Encrypted chat backup and restore
- Profile photo handling
- Dependency audit posture
- iOS and Android real-device release risks

## Findings

### Completed Controls

- Phone authentication is verified by Firebase and then checked by the backend before app access.
- Backend session restore blocks deactivated, suspended, archived, and deleted users.
- Protected backend calls include Firebase bearer tokens.
- Protected profile/admin/chat calls require active registered device identity.
- Employee UI hides admin-only tabs/settings instead of showing permission errors for inaccessible settings.
- Local chat cache and pending outbound queue are encrypted before storage.
- Chat messages use encrypted envelopes; backend stores ciphertext and metadata, not plaintext message bodies.
- Encrypted chat backup stores ciphertext only and requires a recovery key for restore.
- Profile photos are compressed before upload and cached locally after authenticated fetch.
- The app avoids exposing unauthorized admin settings to employees in the UI.

### Risks Still Requiring Remediation

- App Check is implemented in backend middleware but production enforcement must still be enabled in Firebase and deployment configuration.
- Dependency audit found unresolved backend Firebase Admin / Google Cloud transitive findings and mobile Expo / reCAPTCHA findings.
- Mobile phone-auth reCAPTCHA dependency should be replaced or upgraded through a tested Expo-compatible path.
- Full real-device restore rehearsal must be run after every backup/restore change.
- Rooted or jailbroken device detection is not implemented yet.
- Enterprise MDM policy support is not implemented yet.
- Push notification security has not been implemented yet; default must remain private when added.
- Files/media upload security has not been implemented yet; storage writes are intentionally blocked from clients.

## Required Before Enterprise Launch

- Enable App Check enforcement after Firebase console setup and real-device verification.
- Resolve mobile Expo / reCAPTCHA audit findings through planned platform upgrade or dependency replacement.
- Run iOS and Android login, restore, chat send/receive, offline queue, and backup restore regression tests.
- Review rooted and jailbroken device policy before regulated-enterprise rollout.
- Add production crash reporting and security event monitoring.
- Add release checklist requiring dependency audit, emulator rules tests, backend tests, and mobile typecheck.

## Decision

Mobile security review is complete for the current codebase. The app can continue controlled feature development, but enterprise launch remains blocked until the listed remediation items are completed and verified on real devices.
