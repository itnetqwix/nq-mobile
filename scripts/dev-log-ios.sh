#!/usr/bin/env bash
# iPhone device logs via macOS unified logging (paired device)
set -euo pipefail

BUNDLE="com.netqwix.nqmobile"
echo "=== NetQwix iOS logs (log stream) ==="
echo "Bundle: $BUNDLE"
echo "Filter: NetQwix / React Native / Expo"
echo "Press Ctrl+C to stop."
echo ""

exec log stream --style syslog --level debug \
  --predicate "processImagePath CONTAINS[c] 'NetQwix' OR processImagePath CONTAINS[c] 'nqmobile' OR subsystem CONTAINS[c] 'react' OR subsystem CONTAINS[c] 'expo' OR eventMessage CONTAINS[c] 'React' OR eventMessage CONTAINS[c] 'Expo'"
