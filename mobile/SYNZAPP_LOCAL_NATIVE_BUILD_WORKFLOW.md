# Synzapp Local Native Build Workflow

## Purpose

Use Xcode and Android Studio for development builds when Expo cloud build credits are unavailable or when native dependencies need immediate testing.

## When Local Native Builds Are Required

- A native dependency was added, removed, or upgraded.
- iOS entitlements, PushKit, CallKit, APNs, or notification extension behavior changed.
- Android permissions, notification channels, foreground service behavior, or native calling behavior changed.
- Media picker, media player, WebRTC, Firebase, SQLite, NetInfo, or compressor behavior changed.

## Daily Development Flow

Run Metro after the app is installed:

```bash
cd /Users/geraldnyah/Documents/MeetingIntelligence/SYNZAPP/mobile
npm run local:start
```

Use this for JavaScript and UI changes after a local native build is already installed.

## iOS Local Build

Simulator:

```bash
cd /Users/geraldnyah/Documents/MeetingIntelligence/SYNZAPP/mobile
npm run local:ios
```

Physical iPhone:

```bash
cd /Users/geraldnyah/Documents/MeetingIntelligence/SYNZAPP/mobile
npm run local:ios:device
```

Use a physical iPhone for PushKit, CallKit, locked-device calls, camera, microphone, and APNs testing.

## Android Local Build

List connected Android devices:

```bash
cd /Users/geraldnyah/Documents/MeetingIntelligence/SYNZAPP/mobile
npm run local:android:devices
```

List installed Android emulators:

```bash
cd /Users/geraldnyah/Documents/MeetingIntelligence/SYNZAPP/mobile
npm run local:android:emulators
```

Build and install on emulator or connected device:

```bash
cd /Users/geraldnyah/Documents/MeetingIntelligence/SYNZAPP/mobile
npm run local:android
```

Build and choose a physical device:

```bash
cd /Users/geraldnyah/Documents/MeetingIntelligence/SYNZAPP/mobile
npm run local:android:device
```

The Android scripts set `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `adb`, and emulator paths from Android Studio's default macOS SDK location.

## Native Project Generation

Expo generates `ios/` and `android/` folders during local native builds. For this project, treat them as generated output unless we intentionally decide to move to a checked-in bare native workflow.

Regenerate native projects from app config:

```bash
cd /Users/geraldnyah/Documents/MeetingIntelligence/SYNZAPP/mobile
npm run local:prebuild
```

Clean regenerate when native config is stale:

```bash
cd /Users/geraldnyah/Documents/MeetingIntelligence/SYNZAPP/mobile
npm run local:prebuild:clean
```

## Verification Before Local Builds

```bash
cd /Users/geraldnyah/Documents/MeetingIntelligence/SYNZAPP/mobile
npm run typecheck
npm run build:preflight
```

## Important Notes

- Local builds do not use Expo cloud build credits.
- Local builds can test native dependency changes.
- Existing installed builds can use Metro for JavaScript-only changes.
- Backend changes still need GitHub push and Render deployment before mobile testing uses the new server behavior.
