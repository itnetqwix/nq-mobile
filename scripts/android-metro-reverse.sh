#!/usr/bin/env bash
# Forward Mac Metro to the Android device over USB (works when Wi‑Fi/hotspot IPs differ).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=/dev/null
source "$ROOT/scripts/android-dev-env.sh"

PORT="${1:-8081}"
adb reverse "tcp:${PORT}" "tcp:${PORT}"
echo ""
echo "Android can now reach Metro at:  exp://127.0.0.1:${PORT}"
echo "In the NetQwix dev launcher → Enter URL manually → paste the line above."
echo "(Mac Metro must be running on port ${PORT} — default: npm start on 8081)"
