#!/usr/bin/env bash
# Source this before any Android CLI:  source scripts/android-dev-env.sh
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:/opt/homebrew/bin:$PATH"
