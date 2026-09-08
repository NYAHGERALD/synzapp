#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$PROJECT_ROOT"

echo "Synzapp offline-first chat physical-device validation"
echo ""
echo "1. Connected iOS physical destinations:"
xcodebuild -workspace "$PROJECT_ROOT/ios/Synzapp.xcworkspace" -scheme Synzapp -showdestinations 2>/dev/null \
  | grep 'platform:iOS,' \
  | grep -v placeholder || true
echo ""
echo "2. Connected Android devices:"
ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}" \
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}" \
PATH="$HOME/Library/Android/sdk/platform-tools:$PATH" \
adb devices || true
echo ""

if [[ -n "${SYNZAPP_IOS_DEVICES:-}" ]]; then
  echo "Installing iOS Release build on: $SYNZAPP_IOS_DEVICES"
  npm run local:ios:release:device
else
  echo "Skipping iOS install. Set SYNZAPP_IOS_DEVICES=\"iPhone A,iPhone B\" to install on two iPhones."
fi

echo ""
cat <<'CHECKLIST'
Manual validation checklist for each physical device:

- Sign in with an active employee account.
- Open Chats and confirm the chat list appears immediately with cached names and profile photos.
- Turn off Wi-Fi/cellular, force quit, reopen Synzapp, and confirm the chat list still appears.
- Open a large direct chat and a large group chat offline; confirm text, photos, audio, video, and documents render from local cache.
- Send text and media while offline; force quit and reopen; confirm pending items and previews survive restart.
- Reconnect; confirm queued sends complete in order and media upload/download indicators recover.
- In Settings > Organization Security > Offline chat, verify cache size, queue depth, timing samples, and transfer counters update.
- Change Offline media cache, Wi-Fi-only prefetch, cache budget, retention days, and purge-on-signout from one device; confirm the second device receives the tenant policy after app refresh/sign-in.
- Revoke one test device from Organization Security; confirm the revoked device blocks cached company data and local chat/media/call/profile-photo data is cleared.
- Sign out with purge-on-signout enabled; confirm local company data is cleared. Repeat with it disabled; confirm sign-in re-entry keeps local cache unless revocation occurs.
CHECKLIST
