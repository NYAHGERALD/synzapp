#!/usr/bin/env bash
set -euo pipefail

# Builds a Release APK and installs it on connected Android devices, so the app
# runs standalone with no Metro server — the Android counterpart to
# install-ios-release-device.sh, and tested the same way.

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$PROJECT_ROOT/android"
HOSTED_API_URL="https://synzapp-backend-291906951893.us-central1.run.app"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
# A release build bakes this in. Without it the app points at localhost and
# cannot reach the backend from a phone.
export EXPO_PUBLIC_SYNZAPP_API_URL="${EXPO_PUBLIC_SYNZAPP_API_URL:-$HOSTED_API_URL}"

# Gradle needs a JDK, and JAVA_HOME is frequently wrong or unset: a stale path in
# a shell profile, or a machine that only ever built from Android Studio. Prefer
# a JAVA_HOME that actually exists, then Android Studio's own bundled runtime —
# which is what the IDE builds this project with — then whatever macOS reports.
resolve_java_home() {
  if [[ -n "${JAVA_HOME:-}" && -x "$JAVA_HOME/bin/java" ]]; then
    printf '%s' "$JAVA_HOME"
    return
  fi

  local candidate
  for candidate in \
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
    "/Applications/Android Studio.app/Contents/jre/Contents/Home"; do
    if [[ -x "$candidate/bin/java" ]]; then
      printf '%s' "$candidate"
      return
    fi
  done

  if [[ -x /usr/libexec/java_home ]]; then
    /usr/libexec/java_home 2>/dev/null || true
  fi
}

RESOLVED_JAVA_HOME="$(resolve_java_home)"

if [[ -z "$RESOLVED_JAVA_HOME" || ! -x "$RESOLVED_JAVA_HOME/bin/java" ]]; then
  echo "No usable Java installation was found." >&2
  echo "Install a JDK, or open Android Studio once so its bundled runtime is available." >&2
  exit 1
fi

if [[ "${JAVA_HOME:-}" != "$RESOLVED_JAVA_HOME" ]]; then
  echo "Using JDK: $RESOLVED_JAVA_HOME"
  if [[ -n "${JAVA_HOME:-}" ]]; then
    echo "  (JAVA_HOME was set to '$JAVA_HOME', which does not exist)"
  fi
fi

export JAVA_HOME="$RESOLVED_JAVA_HOME"
export PATH="$JAVA_HOME/bin:$PATH"

if [[ ! -d "$ANDROID_DIR" ]]; then
  echo "The Synzapp Android project was not found at $ANDROID_DIR." >&2
  echo "Run 'npm run local:prebuild' first." >&2
  exit 1
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "adb was not found. Install the Android SDK platform tools, or set ANDROID_HOME." >&2
  exit 1
fi

adb start-server >/dev/null 2>&1 || true

# Only devices that are fully authorised. A phone showing "unauthorized" has not
# had the USB debugging prompt accepted yet, and naming it here is more useful
# than a failure deep inside adb install.
ATTACHED="$(adb devices | awk 'NR>1 && NF>=2 {print $1"\t"$2}')"
UNAUTHORIZED="$(printf '%s\n' "$ATTACHED" | awk -F'\t' '$2=="unauthorized" {print $1}')"
AVAILABLE="$(printf '%s\n' "$ATTACHED" | awk -F'\t' '$2=="device" {print $1}')"

if [[ -n "$UNAUTHORIZED" ]]; then
  echo "These devices are connected but not authorised for debugging:" >&2
  printf '  %s\n' $UNAUTHORIZED >&2
  echo "Unlock the phone and accept the 'Allow USB debugging' prompt." >&2
fi

if [[ -z "$AVAILABLE" ]]; then
  echo "No authorised Android device is connected." >&2
  echo "Connect the phone by USB, enable Developer options and USB debugging, then accept the prompt." >&2
  exit 1
fi

# One handset can appear twice: once over USB and once over Wi-Fi (ip:port).
# Installing to both flashes the same phone twice, and the Wi-Fi entry is the
# one that goes stale and fails mid-install. Group by the hardware serial and
# keep the USB entry.
dedupe_by_hardware() {
  local seen_serials=""
  local kept=""

  # USB entries first, so they win over their Wi-Fi twin.
  local ordered
  ordered="$(printf '%s\n' "$1" | grep -v ':' || true)"$'\n'"$(printf '%s\n' "$1" | grep ':' || true)"

  while IFS= read -r CANDIDATE; do
    CANDIDATE="$(printf '%s' "$CANDIDATE" | xargs)"
    [[ -z "$CANDIDATE" ]] && continue

    local HARDWARE
    HARDWARE="$(adb -s "$CANDIDATE" shell getprop ro.serialno </dev/null 2>/dev/null | tr -d '\r' | xargs || true)"

    # A device that will not answer is offline, whatever `adb devices` says.
    if [[ -z "$HARDWARE" ]]; then
      echo "Skipping $CANDIDATE: it is listed but not responding." >&2
      continue
    fi

    if printf '%s\n' "$seen_serials" | grep -Fxq "$HARDWARE"; then
      echo "Skipping $CANDIDATE: same phone as one already selected." >&2
      continue
    fi

    seen_serials="$seen_serials$HARDWARE"$'\n'
    kept="$kept$CANDIDATE"$'\n'
  done <<< "$ordered"

  printf '%s' "$kept"
}

AVAILABLE="$(dedupe_by_hardware "$AVAILABLE")"

if [[ -z "$(printf '%s' "$AVAILABLE" | xargs)" ]]; then
  echo "Every listed device failed to respond. Unplug and reconnect the phone." >&2
  exit 1
fi

REQUESTED="${SYNZAPP_ANDROID_DEVICES:-${SYNZAPP_ANDROID_DEVICE:-}}"
TARGETS=""

if [[ -n "$REQUESTED" ]]; then
  while IFS= read -r WANTED; do
    WANTED="$(printf '%s' "$WANTED" | xargs)"
    [[ -z "$WANTED" ]] && continue

    if printf '%s\n' "$AVAILABLE" | grep -Fxq "$WANTED"; then
      TARGETS="$TARGETS$WANTED"$'\n'
    else
      echo "Requested device '$WANTED' is not connected or not authorised." >&2
      exit 1
    fi
  done <<< "$(printf '%s\n' "$REQUESTED" | tr ',' '\n')"
else
  TARGETS="$AVAILABLE"
fi

echo "Backend: $EXPO_PUBLIC_SYNZAPP_API_URL"
echo "Building Synzapp Release APK"

cd "$ANDROID_DIR"
./gradlew assembleRelease
cd "$PROJECT_ROOT"

APK_PATH="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"

if [[ ! -f "$APK_PATH" ]]; then
  APK_PATH="$(find "$ANDROID_DIR/app/build/outputs/apk/release" -name '*.apk' -type f 2>/dev/null | head -n 1)"
fi

if [[ -z "$APK_PATH" || ! -f "$APK_PATH" ]]; then
  echo "The Release APK was not found under $ANDROID_DIR/app/build/outputs/apk/release." >&2
  exit 1
fi

while IFS= read -r SERIAL; do
  SERIAL="$(printf '%s' "$SERIAL" | xargs)"
  [[ -z "$SERIAL" ]] && continue

  # stdin is redirected because adb reads it, and this loop is being fed device
  # serials on stdin — without this, adb swallows the rest of the list and only
  # the first device is ever installed to.
  MODEL="$(adb -s "$SERIAL" shell getprop ro.product.model </dev/null 2>/dev/null | tr -d '\r' | xargs || true)"
  LABEL="${MODEL:-$SERIAL}"

  echo "Installing Release app on $LABEL ($SERIAL)"

  # -r reinstalls over the existing copy and keeps its data. -d allows going back
  # to an older version, which happens whenever a build is reinstalled after a
  # newer one. A signature clash means a differently signed copy is installed,
  # and only uninstalling first can resolve it.
  if ! adb -s "$SERIAL" install -r -d "$APK_PATH" </dev/null; then
    echo "Install failed on $LABEL. If this is a signature mismatch, remove the existing app first:" >&2
    echo "  adb -s $SERIAL uninstall com.synzapp.mobile" >&2
    exit 1
  fi

  echo "Synzapp Release was installed on $LABEL."
done <<< "$TARGETS"

echo "Open Synzapp from the Android app drawer. Metro is not used for this install."
