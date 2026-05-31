#!/usr/bin/env bash
# Live-lesson dev workflow — run Metro once, then one terminal per device.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="${1:-help}"

case "$MODE" in
  metro)
    echo "Starting Metro on :8081 (dev client)…"
    exec npx expo start --dev-client -c --port 8081
    ;;
  android)
    echo "USB reverse + Android dev client…"
    npm run android:reverse
    echo ""
    echo "Open NetQwix on Android. If needed, enter URL: exp://127.0.0.1:8081"
    ;;
  ios)
    echo "Building/launching on physical iPhone (Metro must already run)…"
    exec npm run ios:device
    ;;
  *)
    cat <<'EOF'
Live lesson dev — use THREE terminals:

  Terminal 1 (Metro — keep running):
    bash scripts/start-live-lesson-dev.sh metro

  Terminal 2 (Android USB):
    bash scripts/start-live-lesson-dev.sh android
    # Then open NetQwix dev client on the phone

  Terminal 3 (iPhone USB — unlock + trust this Mac first):
    bash scripts/start-live-lesson-dev.sh ios

Notes:
  • One Metro on port 8081 only — do not start a second bundler.
  • iPhone must show as Online in Xcode Devices (not "Devices Offline").
  • Both devices need the native dev build (not Expo Go) for WebRTC live lessons.
  • Test matrix: trainer on one device, trainee on the other; attach clips in booking, then Join.
EOF
    ;;
esac
