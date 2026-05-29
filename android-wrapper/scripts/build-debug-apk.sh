#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

if [[ ! -x "$ROOT_DIR/gradlew" ]]; then
  echo "Gradle wrapper not found. Generate it with: gradle wrapper --gradle-version 8.10.2 --distribution-type bin" >&2
  exit 1
fi

if [[ -z "${ANDROID_HOME:-}" && -z "${ANDROID_SDK_ROOT:-}" ]]; then
  for candidate in "$HOME/Library/Android/sdk" "/opt/homebrew/share/android-commandlinetools"; do
    if [[ -d "$candidate" ]]; then
      export ANDROID_HOME="$candidate"
      export ANDROID_SDK_ROOT="$candidate"
      break
    fi
  done
fi

if [[ -z "${ANDROID_HOME:-}" && -z "${ANDROID_SDK_ROOT:-}" ]]; then
  echo "ANDROID_HOME/ANDROID_SDK_ROOT not set and no Android SDK found." >&2
  echo "Install command line tools with: brew install --cask android-commandlinetools" >&2
  exit 1
fi

"$ROOT_DIR/gradlew" --no-daemon assembleDebug

printf "APK: %s\n" "$ROOT_DIR/app/build/outputs/apk/debug/app-debug.apk"
