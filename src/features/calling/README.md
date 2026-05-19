# Mobile portrait-calling

Native instant/scheduled lessons run in `NativeMeetingScreen` (WebRTC + socket
clip sync). `MeetingRouter` blocks Expo Go unless QA enables web fallback.

## Clip sync (web parity)

`useClipSync` handles **both** payload shapes:

| Emitter | `ON_VIDEO_SELECT` shape |
|---------|-------------------------|
| Web trainer | `type: "clips"`, `videos: Clip[]` |
| Mobile trainer | same (preferred) + legacy `type: "clip"`, `id`, `playbackUrl` |

On join, booking clips from `session.trainee_clips` / `trainee_clip` preload for
the trainer (same as web `VideoCallUI`).

Trainer-only: play/pause, timeline scrub (`ClipPlaybackControls`), lock mode,
fullscreen clip, drawing, screenshot → game plan.

Trainee: follows socket for clip playback and hide/show; no transport controls.

## Cross-platform QA matrix

| Trainer | Trainee | Clip sync | Live video |
|---------|---------|-----------|------------|
| Web | Mobile | Web `clips[]` → mobile plays | Web uses `socketNativeWebRtc.js` when mobile sends `signalingMode: socket-webrtc` |
| Mobile | Web | Mobile emits `clips[]` | Mobile emits `ON_OFFER` / `ON_ANSWER` on socket (not PeerJS) |
| Mobile | Mobile | Full native | Native WebRTC |
| Web | Web | Web only | PeerJS |

### Manual checks

1. Trainee selects clips on web → trainer on mobile sees clip in main pane.
2. Trainer picks clip on mobile → trainee on web enters clip mode.
3. Instant lesson with pre-attached clips → trainer sees video without re-opening picker.
4. Trainer play/pause + scrub → trainee video follows (no controls on trainee).
5. PIPs drag above bottom bar; both sides can park tiles on left/right walls.
6. Trainer screenshot button → upload succeeds → appears in session report.

## Key files

| File | Purpose |
|------|---------|
| `useClipSync.ts` | Clip select / play / seek / hide / lock / fullscreen |
| `clipSyncUtils.ts` | Booking clip extraction + URL resolution |
| `useDrawingSync.ts` | `EMIT_DRAWING_CORDS` stroke broadcast |
| `useMeetingScreenshot.ts` | Capture frame → `/report/add-image` |
| `ClipPlaybackControls.tsx` | Play/pause + timeline (trainer only) |
| `MeetingClipToolbar.tsx` | Fullscreen, lock, draw, clear |
| `DraggableVideoPip.tsx` | Draggable PIPs with safe-zone clamping |
| `useMeetingChromeInsets.ts` | `pipSafeBottom` reserves space above controls |

## Dev build and video QA

```bash
npx expo run:ios
# or
npx expo run:android
```

- **Expo Go** cannot run native WebRTC — use an EAS dev build or `expo run:*`.
- **iOS Simulator** has no real camera; use it for permissions/UI only. Test **two physical devices** for live video and TURN.
- `NativeMeetingScreen` loads the session via `fetchMeetingSession` and passes `iceServers` into `CallProvider` (TURN from the booking row — not STUN-only).
- Instant lessons: trainer **Accept** then **Join now** within 2 minutes (same as trainee); both sides must tap Join before the meeting opens.

## Trainer tools (native)

- Bottom bar: mic, camera, flip, clips, draw (1:1), lock/layout/exit (clip mode), screenshot, end.
- Annotation toolbar when draw is on (freehand, line, rect, circle, arrow).
- Instant lessons show `RecordingBar` when both users are in the call (UI parity; full mux capture is a follow-up).
- Post-call: trainer gets **Session game plan** modal (screenshots + save), then ratings.

## Meeting UI (light theme)

- White chrome via `meetingTheme.ts`; timer pill top-right; compact bottom bar.
- Live video only in draggable PIPs (main stage = clips or waiting card).
- Drag PIPs off-screen edge → chevron tab restores them.

## Timer rules (backend-authoritative)

| Type | When timer starts |
|------|-------------------|
| Instant | Both in call → auto `TIMER_STARTED` |
| Scheduled | Coach taps **Start** when both connected |
| Scheduled late trainee | Trainee joins **>2 min** after coach → auto start |

## QA checklist (two physical devices)

1. Instant: Accept → Join (both) within 2 min → timer runs.
2. Scheduled: coach joins first → timer waits → Start after trainee.
3. Scheduled: coach waits 2+ min → trainee joins → timer auto-starts.
4. `PARTICIPANT_STATUS_CHANGED` → partner sees join banner + notification.
5. Chats: long-press message → edit (<30 min) / delete; long-press list → archive/delete.
6. FAQ submit → `write-us` success toast.

## Support docs

- Settings → **FAQ**, **About us**, **Contact us**.
- Loader shows **one** tip per appearance (`useRotatingLoaderTip`).
