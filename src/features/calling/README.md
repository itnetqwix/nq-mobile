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
| Web | Mobile | Web `clips[]` → mobile plays | PeerJS vs WebRTC — verify separately |
| Mobile | Web | Mobile emits `clips[]` | same |
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

## Dev build

```bash
npx expo run:ios
# or
npx expo run:android
```

Native video does not run in Expo Go.
