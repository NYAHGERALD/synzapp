#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE="$PROJECT_ROOT/ios/Synzapp.xcworkspace"
SCHEME="Synzapp"
CONFIGURATION="Release"
DERIVED_DATA_PATH="${SYNZAPP_IOS_DERIVED_DATA_PATH:-$PROJECT_ROOT/ios/build/ReleaseDerivedData}"
HOSTED_API_URL="https://synzapp-backend-291906951893.us-central1.run.app"

export EXPO_PUBLIC_SYNZAPP_API_URL="${EXPO_PUBLIC_SYNZAPP_API_URL:-$HOSTED_API_URL}"
export NODE_BINARY="${NODE_BINARY:-$(command -v node)}"

if [[ ! -d "$WORKSPACE" ]]; then
  echo "Synzapp iOS workspace was not found at $WORKSPACE" >&2
  exit 1
fi

cd "$PROJECT_ROOT"

# CocoaPods, before anything is built.
#
# Android's Gradle autolinks native modules on every build. CocoaPods does not:
# it only knows what was there the last time `pod install` ran. Adding a native
# dependency and building without this produces an app whose JavaScript calls
# native code that is not in the binary, so it launches and dies on the spot.
# That has happened once, with react-native-reanimated.
#
# Skip with SYNZAPP_SKIP_POD_INSTALL=1 only when the pods are known current.
if [[ "${SYNZAPP_SKIP_POD_INSTALL:-0}" != "1" ]]; then
  echo "Making sure the iOS pods match package.json"
  npx pod-install ios
fi

DESTINATIONS="$(
  xcodebuild \
    -workspace "$WORKSPACE" \
    -scheme "$SCHEME" \
    -showdestinations 2>/dev/null || true
)"

PHYSICAL_IOS_DESTINATIONS="$(
  printf '%s\n' "$DESTINATIONS" |
    grep 'platform:iOS,' |
    grep -v 'placeholder' || true
)"

REQUESTED_DEVICE="${SYNZAPP_IOS_DEVICE:-${IOS_DEVICE:-}}"
REQUESTED_DEVICES="${SYNZAPP_IOS_DEVICES:-}"

if [[ -z "$REQUESTED_DEVICES" && -n "$REQUESTED_DEVICE" ]]; then
  REQUESTED_DEVICES="$REQUESTED_DEVICE"
fi

if [[ -n "$REQUESTED_DEVICES" ]]; then
  DEVICE_LINES=""
  IFS=',' read -r -a REQUESTED_DEVICE_NAMES <<< "$REQUESTED_DEVICES"

  for REQUESTED_DEVICE_NAME in "${REQUESTED_DEVICE_NAMES[@]}"; do
    REQUESTED_DEVICE_NAME="$(printf '%s' "$REQUESTED_DEVICE_NAME" | xargs)"

    if [[ -z "$REQUESTED_DEVICE_NAME" ]]; then
      continue
    fi

    DEVICE_LINE="$(
      printf '%s\n' "$PHYSICAL_IOS_DESTINATIONS" |
        grep -F "name:$REQUESTED_DEVICE_NAME" |
        head -n 1 || true
    )"

    if [[ -z "$DEVICE_LINE" ]]; then
      echo "Could not find requested iOS device: $REQUESTED_DEVICE_NAME" >&2
      echo "Available physical iOS destinations:" >&2
      printf '%s\n' "$PHYSICAL_IOS_DESTINATIONS" >&2
      exit 1
    fi

    DEVICE_LINES="${DEVICE_LINES}${DEVICE_LINE}"$'\n'
  done
else
  DEVICE_COUNT="$(printf '%s\n' "$PHYSICAL_IOS_DESTINATIONS" | sed '/^[[:space:]]*$/d' | wc -l | tr -d ' ')"

  if [[ "$DEVICE_COUNT" != "1" ]]; then
    echo "Choose the iPhone to install to by setting SYNZAPP_IOS_DEVICE or SYNZAPP_IOS_DEVICES." >&2
    echo "Available physical iOS destinations:" >&2
    printf '%s\n' "$PHYSICAL_IOS_DESTINATIONS" >&2
    echo "" >&2
    echo "Example:" >&2
    echo "  SYNZAPP_IOS_DEVICE=\"iPhone (2)\" npm run local:ios:release:device" >&2
    echo "  SYNZAPP_IOS_DEVICES=\"iPhone (2),Gerald iPhone\" npm run local:ios:release:device" >&2
    exit 1
  fi

  DEVICE_LINES="$(printf '%s\n' "$PHYSICAL_IOS_DESTINATIONS" | sed '/^[[:space:]]*$/d' | head -n 1)"
fi

DEVICE_LINES="$(printf '%s\n' "$DEVICE_LINES" | sed '/^[[:space:]]*$/d')"
BUILD_DEVICE_LINE="$(printf '%s\n' "$DEVICE_LINES" | head -n 1)"

if [[ -z "$BUILD_DEVICE_LINE" ]]; then
  echo "Could not find any requested iOS devices." >&2
  echo "Available physical iOS destinations:" >&2
  printf '%s\n' "$PHYSICAL_IOS_DESTINATIONS" >&2
  exit 1
fi

DEVICE_ID="$(printf '%s\n' "$BUILD_DEVICE_LINE" | sed -n 's/.*id:\([^,}]*\).*/\1/p' | xargs)"
DEVICE_NAME="$(printf '%s\n' "$BUILD_DEVICE_LINE" | sed -n 's/.*name:\([^}]*\).*/\1/p' | xargs)"

if [[ -z "$DEVICE_ID" || -z "$DEVICE_NAME" ]]; then
  echo "Could not parse the selected iOS destination:" >&2
  echo "$BUILD_DEVICE_LINE" >&2
  exit 1
fi

echo "Building Synzapp Release for $DEVICE_NAME ($DEVICE_ID)"
echo "Backend: $EXPO_PUBLIC_SYNZAPP_API_URL"

xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION" \
  -destination "id=$DEVICE_ID" \
  -derivedDataPath "$DERIVED_DATA_PATH" \
  -allowProvisioningUpdates \
  build

APP_PATH="$DERIVED_DATA_PATH/Build/Products/Release-iphoneos/Synzapp.app"

if [[ ! -d "$APP_PATH" ]]; then
  APP_PATH="$(find "$DERIVED_DATA_PATH/Build/Products" -path '*/Release-iphoneos/Synzapp.app' -type d | head -n 1)"
fi

if [[ -z "$APP_PATH" || ! -d "$APP_PATH" ]]; then
  echo "The Release app bundle was not found under $DERIVED_DATA_PATH." >&2
  exit 1
fi

while IFS= read -r DEVICE_LINE; do
  DEVICE_ID="$(printf '%s\n' "$DEVICE_LINE" | sed -n 's/.*id:\([^,}]*\).*/\1/p' | xargs)"
  DEVICE_NAME="$(printf '%s\n' "$DEVICE_LINE" | sed -n 's/.*name:\([^}]*\).*/\1/p' | xargs)"

  if [[ -z "$DEVICE_ID" || -z "$DEVICE_NAME" ]]; then
    echo "Could not parse the selected iOS destination:" >&2
    echo "$DEVICE_LINE" >&2
    exit 1
  fi

  echo "Installing Release app on $DEVICE_NAME ($DEVICE_ID)"
  xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH"
  echo "Synzapp Release was installed on $DEVICE_NAME."
done <<< "$DEVICE_LINES"

echo "Open Synzapp from the iPhone home screen. Metro is not used for this install."
