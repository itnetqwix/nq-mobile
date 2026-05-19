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
lock mode (2 clips only), drawing (arm/disarm), screenshot → game plan.

**Clip broadcast limits:** trainer may select **1 or 2 clips** max (`ClipPickerModal`
multi-select + `emitSelectClips` cap). Lock control appears only when exactly **2**
clips are active. Locked mode shows two stacked players in one frame with a **single
shared timeline** (`LockedDualClipStage`); unlock restores per-pane controls.

Thumbnails use `getClipThumbnailUrl` (S3 prod bucket for bare keys — same as web
`Utils.generateThumbnailURL`).

Trainee: follows socket for clip playback, layout, and hide/show; no transport controls.

## Cross-platform QA matrix

| Trainer | Trainee | Clip sync | Live video | Layout sync |
|---------|---------|-----------|------------|-------------|
| Web | Mobile | Web `clips[]` → mobile plays | `socket-webrtc` | `MEETING_TILE_LAYOUT` + swap |
| Mobile | Web | Mobile `clips[]` + `clipIndex` fullscreen | Native socket WebRTC | Mobile emits layout |
| Mobile | Mobile | Full native | Native WebRTC | Full |
| Web | Web | Web only | PeerJS | Web |

### Manual checks

1. Trainer picks 1 clip → no lock icon; play/seek syncs normally.
2. Trainer picks 2 clips → lock icon appears; lock ON → stacked players + one timeline
   (`both: true` on play/seek); trainee mirrors layout without controls.
3. Unlock → per-pane inline controls return (trainer).
4. Two clips unlocked → vertical stack (50/50); expand on each timeline row fills stage.
5. Trainer play/pause + scrub → trainee follows (`both: true` when lock on).
6. Locker + meeting picker show thumbnails when clip has S3 `thumbnail` key.
7. Session booking preload with up to 2 trainee clips → both load; lock works.
8. Trainer taps PIP → main stage live video; mini PIP for other party; trainee mirrors swap.
9. Drag PIP off-screen >40% → edge tab (“You” / trainee name) restores tile.
10. Corner-drag resize on PIPs (no cycle button); positions sync via `MEETING_TILE_LAYOUT`.
11. Annotation: always on trainer bar; close toolbar keeps strokes until disarm.
12. Timer label **Timer**; instant lessons have no coach Start/Stop (backend auto-start).
13. No recording bar on mobile.
14. Home button during call → OS PiP / background audio (dev build; rebuild after `app.json` PiP flags).

## Key files

| File | Purpose |
|------|---------|
| `useClipSync.ts` | Clip select / play / seek / hide / lock / per-clip fullscreen |
| `useMeetingLayout.ts` | Swap focus + `MEETING_TILE_LAYOUT` tile sync |
| `useNativeMeetingPip.ts` | Background PiP / call keep-alive |
| `MeetingLiveStage.tsx` | Full-stage focused stream |
| `MeetingMiniPip.tsx` | Secondary stream in focus mode |
| `ClipPlaybackControls.tsx` | Play/pause + timeline + expand |
| `LockedDualClipStage.tsx` | Locked dual-clip stack + shared timeline |
| `ClipPickerModal.tsx` | Multi-select clip picker (max 2) |
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
- `TOGGLE_LOCK_MODE` (`locked` + `isLockMode` + optional `lockPoint`)
- `TOGGLE_DRAWING_MODE`, `EMIT_DRAWING_CORDS`
- `MEETING_TILE_LAYOUT` (tile x/y/w/h, hidden, `focusedStreamId`)
