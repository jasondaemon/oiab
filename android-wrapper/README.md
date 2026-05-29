# IIAB Overland Android Wrapper

Fullscreen Android WebView wrapper for the IIAB Overland web UI on Android head units.

The APK is not self-contained. It loads the Overland UI from the local Pi/server, defaulting to:

```text
https://maps.overland.daemonadventures.net/maps/
```

The GL.iNet/router DNS must resolve that hostname to the Pi LAN IP.

## Behavior

- Single Kotlin `Activity`
- Immersive fullscreen landscape WebView
- JavaScript, DOM storage, database storage, geolocation, and cleartext HTTP enabled
- `mediaPlaybackRequiresUserGesture = false`
- Requests audio focus as media playback
- Keeps screen awake
- Auto-grants geolocation for trusted local/private Overland origins
- Auto-grants WebView audio capture for trusted local/private Overland origins
- Injects a silent WebAudio unlock on page load, resume, and touch
- Hidden diagnostics menu: long-press the top-left corner

## Diagnostics Menu

Long-press the invisible top-left hotspot to show:

- current URL
- Android WebView package/version
- reload
- clear cache/history
- run injected WebAudio beep test
- set/reset wrapper URL
- exit app

## Build

From this directory:

```bash
./scripts/build-debug-apk.sh
```

The debug APK will be at:

```text
app/build/outputs/apk/debug/app-debug.apk
```

## Install

If `adb` is available and the head unit is connected/debuggable:

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Otherwise transfer the APK to the head unit and install it from Android's file manager.

## Notes

This wrapper can bypass browser UI, fullscreen, and some browser-level gesture policy, but it cannot fix a broken Android System WebView audio output path. If WebAudio emulator sound still fails here, the Dasaita firmware/WebView audio route is likely the limiting factor.
