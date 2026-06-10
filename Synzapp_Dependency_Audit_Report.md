# Synzapp Dependency Audit Report

Date: 2026-06-08

## Scope

Dependency scanning was run for:

- `backend`
- `mobile`

Commands:

```bash
npm audit --json
npm audit --omit=dev --json
npm run audit:security
```

## Backend Result

Current production dependency result:

- 8 moderate vulnerabilities
- 0 high vulnerabilities
- 0 critical vulnerabilities

Current full dependency result, including emulator dev tooling:

- 10 moderate vulnerabilities
- 0 high vulnerabilities
- 0 critical vulnerabilities

Affected path:

- `firebase-admin`
- `@google-cloud/firestore`
- `@google-cloud/storage`
- `google-gax`
- `retry-request`
- `teeny-request`
- `gaxios`
- `uuid`
- `firebase-tools` in the dev-only emulator tooling tree

Assessment:

- The backend is already on `firebase-admin@13.10.0` through the existing lockfile.
- npm currently proposes `firebase-admin@10.3.0` as the fix path, which is a major downgrade.
- A forced downgrade is not acceptable for the enterprise backend without a compatibility review.
- The added Firebase emulator tooling is a development dependency. Its advisories must be tracked, but they are not production runtime code.

Decision:

- Do not run `npm audit fix --force`.
- Track this as a Firebase Admin / Google Cloud transitive dependency remediation item.
- Re-run the audit after Firebase Admin publishes a compatible dependency resolution, or test a targeted override in a dedicated branch.
- Keep emulator tooling available for security rule tests, and monitor `firebase-tools` advisories separately from production runtime dependencies.

## Mobile Result

Current result:

- 11 moderate vulnerabilities
- 6 high vulnerabilities
- 0 critical vulnerabilities

Affected path:

- `expo`
- `expo-constants`
- `expo-firebase-recaptcha`
- `expo-firebase-core`
- `@expo/config`
- `@expo/config-plugins`
- `@expo/metro-config`
- `@expo/plist`
- `@xmldom/xmldom`
- `postcss`
- `semver`
- `uuid`
- `xcode`
- `xml2js`

Assessment:

- The active app is on Expo SDK 54.
- npm proposes Expo SDK 56 and an `expo-firebase-recaptcha` major-version path as remediation.
- This affects authentication, native modules, Expo runtime compatibility, Android/iOS behavior, and QR/device testing.
- A forced major Expo upgrade is not acceptable without a dedicated upgrade and real-device regression pass.

Decision:

- Do not run `npm audit fix --force`.
- Treat the Expo / recaptcha path as a planned mobile platform upgrade.
- Before broad chat feature expansion, replace or upgrade the phone-auth reCAPTCHA dependency through a tested Expo-compatible path.

## Required Follow-Up

- Create a dedicated Firebase Admin transitive-dependency remediation task.
- Create a dedicated Firebase emulator tooling remediation task if a compatible `firebase-tools` update is released.
- Create a dedicated Expo authentication dependency remediation task.
- Run backend tests, mobile typecheck, and real-device login verification after any dependency changes.
- Re-run dependency scanning after each remediation.
