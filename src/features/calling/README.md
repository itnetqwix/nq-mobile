# Mobile portrait-calling

This folder mirrors the web's `app/components/portrait-calling` ecosystem and is the foundation
for a fully-native RN call experience.

## What ships today

The active call path is still the `WebView` embedded inside `MeetingScreen.tsx` (the website's
`/meeting?lessonId=…` page handles the real WebRTC). The native chrome on top of it — peer
avatar, live countdown, leave button — is provided by `components/PortraitCallOverlay.tsx`.

This delivers immediate UX parity with the web portrait-calling visuals (`time-remaining` and
`action-buttons`) without requiring a native build.

## Files

| File | Purpose |
|------|---------|
| `types.ts` | Shared TypeScript contracts for the call state machine. |
| `callEvents.ts` | Backend socket event names (matches `nq-backend src/config/constance.ts → EVENTS.VIDEO_CALL`). |
| `iceServers.ts` | Same ICE config builder as web `callEngine.js → buildIceConfig`. |
| `useCallSignaling.ts` | Re-usable hook that wires socket.io listeners + emitters for the call lifecycle. |
| `useLessonCountdown.ts` | RN port of `useLessonTimer` (display only, no pause/extend). |
| `components/PortraitCallOverlay.tsx` | Active **top overlay** on the WebView. |
| `components/PortraitCallChrome.tsx` | Full chrome (top + bottom action bar) for the future native transport. |

## Migrating to native `react-native-webrtc`

When the team is ready to remove the WebView dependency:

1. **Install** the native peer + media stack and pre-build the dev client:

   ```bash
   npx expo install react-native-webrtc
   npx expo prebuild --clean   # required: react-native-webrtc has native iOS/Android modules
   ```

   For Expo / EAS builds, add the relevant config plugin entry; see
   <https://github.com/react-native-webrtc/react-native-webrtc>.

2. **Implement a `NativeCallEngine`** that mirrors the web `CallEngine`:
   - Use `RTCPeerConnection`, `mediaDevices.getUserMedia({ video: true, audio: true })`,
     and the `MediaStream` from `react-native-webrtc`.
   - Pass the local stream to `<RTCView streamURL={localStream.toURL()} />`.
   - For signaling, consume `useCallSignaling` and emit / handle `offer` / `answer` /
     `ice-candidate` exactly like the web (the socket events here intentionally match).
   - Re-use `buildIceConfig` from `iceServers.ts` against the `iceServers` array the
     backend returns in `bookings.startMeeting`.

3. **Swap the WebView for `RTCView`** in `MeetingScreen.tsx` and replace `PortraitCallOverlay`
   with the full `PortraitCallChrome` (which already exposes `onToggleMic`, `onToggleCamera`,
   `onSwitchCamera`).

4. **Permissions**: declare `NSCameraUsageDescription`, `NSMicrophoneUsageDescription` (iOS)
   and `android.permission.CAMERA`, `android.permission.RECORD_AUDIO`, and
   `android.permission.MODIFY_AUDIO_SETTINGS` (Android).

## Why not ship native today?

`react-native-webrtc` requires a custom dev client (it is NOT supported in Expo Go), and the
full feature set of the web `portrait-calling/index.jsx` (3.9k LOC: drawing overlay, clip
modes, screen recording, ratings) is multi-week work. The WebView path provides the FULL
feature set on day 1; the native chrome makes the experience feel native; the foundation
files in this folder give the team a clear, audited path to remove the WebView later.
