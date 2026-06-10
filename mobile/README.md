# Synzapp Mobile

Phase 1 starts with real Firebase phone authentication for the Org Admin flow.

## Firebase Setup

1. Create or open the Synzapp Firebase project.
2. Add a Web app in Firebase project settings.
3. Copy the Firebase web config into `SYNZAPP/mobile/.env.local` using `.env.example`.
4. In Firebase Authentication, enable the Phone provider.
5. In Authentication settings, allow the SMS region for your phone number.
6. Start the Synzapp backend so OTP preflight and session verification can run.

## Backend Setup

The mobile app calls the backend before sending SMS and again after Firebase verifies the code.

```bash
cd SYNZAPP/backend
npm install
cp .env.example .env
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Configure Firebase Admin credentials with either `GOOGLE_APPLICATION_CREDENTIALS` or `FIREBASE_SERVICE_ACCOUNT_JSON`.
For Expo development, the mobile app derives the backend URL from the Expo host and uses port `4100` unless `EXPO_PUBLIC_SYNZAPP_API_URL` is set.

## Run On Your Phone

Expo Go is still useful for quick UI checks, but Android remote push notifications are not supported in Expo Go on current Expo SDKs. Use a development build when testing chat push notifications.

```bash
cd SYNZAPP/mobile
npm install
PATH=/opt/homebrew/bin:$PATH npm run start:dev
```

Open the installed Synzapp development build on the device and connect it to the dev server.

## Development Builds For Push Testing

The project is linked to EAS as `@geraldnyah/synzapp-mobile`.

Build Android and iOS development clients:

```bash
cd SYNZAPP/mobile
npm run build:dev:android
npm run build:dev:ios
```

For Android, EAS produces an installable APK link.

Native development builds use React Native Firebase for phone authentication and Firebase Cloud Messaging for push notifications. Add both Firebase mobile app config files before running EAS builds:

1. In Firebase Console, add an Android app with package `com.synzapp.mobile`.
2. Download `google-services.json` into `SYNZAPP/mobile/google-services.json`.
3. In Firebase Console, add an iOS app with bundle ID `com.synzapp.mobile`.
4. Download `GoogleService-Info.plist` into `SYNZAPP/mobile/GoogleService-Info.plist`.
5. In Firebase Console > Project settings > Service accounts, generate a private key.
6. Upload that service account key to EAS with `npx eas-cli@20.1.0 credentials`, then select Android and FCM V1 push credentials.

The Firebase mobile config files are intentionally ignored by Git. They are not ignored by `.easignore`, so EAS can upload them from your local machine during a cloud build.

For iOS real devices, register every tester device before the first iOS build:

```bash
cd SYNZAPP/mobile
npx eas-cli@20.1.0 device:create
```

Use the Apple Developer account when EAS asks for iOS signing credentials, and answer yes when prompted to set up push notifications / APNs.

The first screen requests backend approval, sends a real Firebase SMS OTP, verifies the code, and then asks the backend to verify the Firebase session before opening the Org Admin onboarding screen.

## Security Audit

```bash
npm run audit:security
```

Current dependency findings and remediation decisions are tracked in `../Synzapp_Dependency_Audit_Report.md`.
