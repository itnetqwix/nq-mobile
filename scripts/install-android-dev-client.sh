#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=/dev/null
source "$ROOT/scripts/android-dev-env.sh"

APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"

if [[ ! -f "$APK" ]]; then
  echo "Debug APK not found. Building first (may take ~20–30 min on first run)..."
  (cd "$ROOT/android" && ./gradlew app:assembleDebug)
fi

echo "Checking connected devices..."
adb devices -l

DEVICE_STATE="$(adb devices | awk 'NR>1 && $1 != "" { print $2; exit }')"
if [[ "$DEVICE_STATE" == "unauthorized" ]]; then
  echo ""
  echo "Your phone is connected but NOT authorized for USB debugging."
  echo "On the Android phone:"
  echo "  1. Settings → Developer options → USB debugging ON"
  echo "  2. Unplug USB, plug back in"
  echo "  3. Tap Allow on the Allow USB debugging? prompt (check Always allow)"
  echo "  4. Re-run: bash scripts/install-android-dev-client.sh"
  exit 1
fi

if [[ -z "$DEVICE_STATE" || "$DEVICE_STATE" == "offline" ]]; then
  echo "No authorized Android device found. Connect phone via USB and enable USB debugging."
  exit 1
fi

echo "Installing NetQwix development build (NOT Expo Go)..."
adb install -r "$APK"
echo ""
echo "Done. Open the NetQwix app on your phone (your app icon, not Expo Go)."
echo ""
echo "After a fresh native rebuild, enable Android CallKeep in JS:"
echo "  src/features/instant-lesson/instantLessonCallKeep.ts → ANDROID_CALLKEEP_ENABLED = true"
echo "Then reload Metro (press r) for lock-screen incoming calls on Android."
echo ""
echo "If Metro is already running from iPhone (npm start / expo run:ios), the dev client will connect automatically."
echo "Otherwise run: cd $ROOT && npm start"
