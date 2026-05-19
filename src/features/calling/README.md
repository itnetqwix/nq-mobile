# Mobile portrait-calling

Native instant/scheduled lessons run in `NativeMeetingScreen` (WebRTC + socket
clip sync). `MeetingRouter` blocks Expo Go unless QA enables web fallback.

## Clip sync (web parity)

`useClipSync` handles **both** payload shapes:

| Emitter | `ON_VIDEO_SELECT` shape |
|---------|-------------------------|
| Web trainer | `type: "clips"`, `videos: Clip[]` |
| Mobile trainer | same (preferred) + legacy `type: "clip"`, `id`, `playbackUrl` |
| Live focus | `type: "swap"`, `id: userId` (via `useMeetingLayout`) |

On join, booking clips from `session.trainee_clips` / `trainee_clip` preload for
the trainer (same as web `VideoCallUI`).

Trainer-only: play/pause, timeline scrub (`ClipPlaybackControls`), per-clip expand,
lock mode, drawing (arm/disarm), screenshot → game plan.

Trainee: follows socket for clip playback, layout, and hide/show; no transport controls.

## Cross-platform QA matrix

| Trainer | Trainee | Clip sync | Live video | Layout sync |
|---------|---------|-----------|------------|-------------|
| Web | Mobile | Web `clips[]` → mobile plays | `socket-webrtc` | `MEETING_TILE_LAYOUT` + swap |
| Mobile | Web | Mobile `clips[]` + `clipIndex` fullscreen | Native socket WebRTC | Mobile emits layout |
| Mobile | Mobile | Full native | Native WebRTC | Full |
| Web | Web | Web only | PeerJS | Web |

### Manual checks

1. Two clips → vertical stack (50/50); expand on each timeline row fills stage.
2. Trainer play/pause + scrub → trainee follows (`both: true` when lock on).
3. Trainer taps PIP → main stage live video; mini PIP for other party; trainee mirrors swap.
4. Drag PIP off-screen >40% → edge tab (“You” / trainee name) restores tile.
5. Corner-drag resize on PIPs (no cycle button); positions sync via `MEETING_TILE_LAYOUT`.
6. Annotation: always on trainer bar; close toolbar keeps strokes until disarm.
7. Timer label **Timer**; instant lessons have no coach Start/Stop (backend auto-start).
8. No recording bar on mobile.
9. Home button during call → OS PiP / background audio (dev build; rebuild after `app.json` PiP flags).

## Key files

| File | Purpose |
|------|---------|
| `useClipSync.ts` | Clip select / play / seek / hide / lock / per-clip fullscreen |
| `useMeetingLayout.ts` | Swap focus + `MEETING_TILE_LAYOUT` tile sync |
| `useNativeMeetingPip.ts` | Background PiP / call keep-alive |
| `MeetingLiveStage.tsx` | Full-stage focused stream |
| `MeetingMiniPip.tsx` | Secondary stream in focus mode |
| `ClipPlaybackControls.tsx` | Play/pause + timeline + expand |
| `DraggableVideoPip.tsx` | Drag, edge dock (40%), corner resize |
| `useDrawingSync.ts` | `EMIT_DRAWING_CORDS` stroke broadcast |

## Dev build and video QA

```bash
npx expo run:ios
# or
npx expo run:android
```

- **Expo Go** cannot run native WebRTC — use an EAS dev build or `expo run:*`.
- **iOS Simulator** has no real camera; use physical devices for live video and PiP.
- Rebuild native apps after changing `app.json` PiP / background modes.

## Timer rules (backend-authoritative)

| Type | When timer starts |
|------|-------------------|
| Instant | Both in call → backend `maybeAutoStartLessonTimer` (no manual coach controls on mobile) |
| Scheduled | Coach taps **Start** when both connected |
| Scheduled late trainee | Trainee joins **>2 min** after coach → auto start |

## Socket events (mobile + web)

- `ON_VIDEO_SELECT`, `ON_VIDEO_PLAY_PAUSE`, `ON_VIDEO_TIME`
- `TOGGLE_FULL_SCREEN` (optional `clipIndex`)
- `TOGGLE_LOCK_MODE`, `TOGGLE_DRAWING_MODE`, `EMIT_DRAWING_CORDS`
- `MEETING_TILE_LAYOUT` (tile x/y/w/h, hidden, `focusedStreamId`)
