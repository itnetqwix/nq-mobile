#!/usr/bin/env bash
# Motorola / Android device logs (React Native + Expo + crashes)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=/dev/null
source "$ROOT/scripts/android-dev-env.sh"

echo "=== NetQwix Android logs (adb logcat) ==="
echo "Device: $(adb get-serialno 2>/dev/null || echo 'none')"
echo "Press Ctrl+C to stop."
echo ""

adb logcat -c 2>/dev/null || true
exec adb logcat -v time \
  ReactNativeJS:V \
  ReactNative:V \
  ExpoModulesCore:V \
  Expo:V \
  AndroidRuntime:E \
  System.err:W \
  "*:S"
