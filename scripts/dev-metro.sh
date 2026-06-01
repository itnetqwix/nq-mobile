#!/usr/bin/env bash
# Metro bundler for NetQwix dev client (iOS + Android share this instance)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== NetQwix Metro (port 8081) ==="
node scripts/print-expo-lan-url.js | grep -E "exp://|===" || true
echo ""
echo "Android USB: run npm run android:reverse then use exp://127.0.0.1:8081"
echo ""

exec npx expo start --dev-client --port 8081
