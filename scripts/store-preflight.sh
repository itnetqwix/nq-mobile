#!/usr/bin/env bash
# Pre-flight checks before TestFlight / Play Store builds.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }

echo "NetQwix store release preflight"
echo "================================"

command -v node >/dev/null || fail "node not found"
command -v npm >/dev/null || fail "npm not found"

if command -v eas >/dev/null; then
  ok "eas-cli installed ($(eas --version 2>/dev/null || echo 'unknown'))"
else
  warn "eas-cli not found — run: npm install -g eas-cli"
fi

[[ -f app.json ]] || fail "app.json missing"
[[ -f eas.json ]] || fail "eas.json missing"
[[ -f assets/app-icon.png ]] || fail "assets/app-icon.png missing (1024x1024 store icon)"
[[ -f assets/adaptive-icon.png ]] || warn "assets/adaptive-icon.png missing (Android adaptive icon)"
if command -v sips >/dev/null; then
  ICON_W=$(sips -g pixelWidth assets/app-icon.png 2>/dev/null | awk '/pixelWidth/{print $2}')
  ICON_H=$(sips -g pixelHeight assets/app-icon.png 2>/dev/null | awk '/pixelHeight/{print $2}')
  if [[ "$ICON_W" != "1024" || "$ICON_H" != "1024" ]]; then
    warn "assets/app-icon.png should be 1024x1024 (got ${ICON_W}x${ICON_H})"
  else
    ok "app-icon.png is 1024x1024"
  fi
fi

IOS_BUNDLE=$(node -pe "JSON.parse(require('fs').readFileSync('app.json','utf8')).expo.ios.bundleIdentifier")
ANDROID_PKG=$(node -pe "JSON.parse(require('fs').readFileSync('app.json','utf8')).expo.android.package")
VERSION=$(node -pe "JSON.parse(require('fs').readFileSync('app.json','utf8')).expo.version")

ok "iOS bundle: $IOS_BUNDLE"
ok "Android package: $ANDROID_PKG"
ok "Marketing version: $VERSION"

if grep -q "REPLACE_WITH_APPLE_TEAM_ID" eas.json 2>/dev/null; then
  warn "eas.json still has REPLACE_WITH_APPLE_TEAM_ID — set appleTeamId + ascAppId before eas submit (or use interactive prompts)"
fi

if [[ ! -f credentials/play-store-service-account.json ]]; then
  warn "credentials/play-store-service-account.json missing — required for eas submit android (see credentials/README.md)"
else
  ok "Play service account JSON present"
fi

PLAY_KEY_COUNT=$(find credentials -maxdepth 1 -name 'AuthKey_*.p8' 2>/dev/null | wc -l | tr -d ' ')
if [[ "$PLAY_KEY_COUNT" -eq 0 ]]; then
  warn "No App Store Connect API key (.p8) in credentials/ — eas submit ios will prompt for Apple ID instead"
else
  ok "App Store Connect API key found in credentials/"
fi

echo ""
echo "Next steps:"
echo "  TestFlight:  npm run deploy:testflight"
echo "  Play internal: npm run deploy:play-internal"
echo "  Full guide:    docs/STORE_RELEASE.md"
