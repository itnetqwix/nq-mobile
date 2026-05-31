# Native meeting — PiP & composited video

Requires **dev client** (`expo run:ios` / `expo run:android` or EAS development build). Not available in Expo Go.

## Phase 1 — Done

- `netqwix-meeting-native` local Expo module
- Android PiP via `PictureInPictureParams`
- Stage frame sampler (view-shot every 12s during recording)

## Phase 2 — iOS PiP — Done

- **`MeetingIosPipHost`** — dedicated off-screen `RTCView` with `iosPIP` from react-native-webrtc 124+
- Auto-starts system PiP when the app backgrounds during a live lesson (remote stream)
- `useNativeMeetingPip` only drives Android PiP; iOS relies on `iosPIP`
- Requires iOS 15+ and `picture-in-picture` background mode (`app.json` already configured)

## Phase 3 — MP4 upload — Done

- Native **`composeLessonRecording`** (iOS + Android) muxes stage PNG/JPEG frames + optional M4A audio → H.264 MP4
- `useInstantLessonRecording` uploads via `addSessionRecording` with `format: "mp4"` when ≥2 frames captured
- Backend accepts `format: "mp4"` → `video/mp4` presign
- Fallback: audio-only M4A when mux fails or &lt;2 frames
- Locker / game plans: `isLikelyAudio` + `LockerViewerModal` `audio` mode for m4a; MP4 opens as video

### Rebuild after native changes

```bash
cd nq-mobile && npm install
npx expo prebuild --clean
npx expo run:ios    # or run:android
```

## Future (optional)

- Android audio mux edge cases (verify AAC in all record profiles)
- Higher-FPS stage capture when on Wi‑Fi
- iOS PiP multi-tile fallback view (coach + trainee) like Jitsi
