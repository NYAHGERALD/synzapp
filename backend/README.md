# Synzapp Backend

Phase 1 backend for secure phone authentication.

## What It Does

- Verifies Firebase ID tokens with Firebase Admin.
- Checks revoked sessions.
- Supports Firebase custom-claim synchronization for existing tenant users.
- Adds OTP preflight before the mobile app sends an SMS.
- Adds IP, phone, and UID rate limits.
- Supports App Check enforcement with `SYNZAPP_REQUIRE_APP_CHECK=true`.
- Writes login, restore, failed login, and OTP preflight audit events to Firestore.

## Run Locally

```bash
cd SYNZAPP/backend
npm install
cp .env.example .env
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Firebase Admin must be configured with one of these:

- `GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json`
- `FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'`

## Security Audit

```bash
npm run audit:security
npm audit --omit=dev --json
```

Current dependency findings and remediation decisions are tracked in `../Synzapp_Dependency_Audit_Report.md`.

## Firebase Rules

The workspace includes tenant-scoped Firebase rule foundations:

- `../firestore.rules`
- `../storage.rules`
- `../firebase.json`

The rules are backend-first: mobile clients get only narrow tenant-scoped reads, while profile/admin/chat writes stay behind the backend API. Run full Firebase Emulator rule tests before enabling direct client access to any new collection or storage path.

```bash
PATH=/opt/homebrew/bin:$PATH npm run emulators:rules
```

Use Node 20.19.4 or newer for Firebase tooling.

## Endpoints

- `GET /health`
- `GET /health/live`
- `GET /health/ready`
- `POST /api/auth/otp/preflight`
- `POST /api/auth/session`
- `POST /api/auth/logout`

## Firestore Collections Used In Phase 1

- `auditLogs/{auditLogId}`
- `identityDirectory/{firebaseUid}`
- `approvedPhoneDirectory/{phoneHash}`
- `organizations/{tenantId}/auditLogs/{auditLogId}`

Phase 2 will create the tenant and user profile records that populate these directories.
