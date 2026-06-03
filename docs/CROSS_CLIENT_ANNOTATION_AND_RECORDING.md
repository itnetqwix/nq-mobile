# Mobile ↔ mobile live lesson — annotations & recording

Scope: **native app only** (trainer + trainee on `nq-mobile`) plus **nq-backend** socket/API relay. Web client parity is out of scope for this doc.

Companion: `LESSON_UX_PHASES.md`, backend `LIVE_LESSON_BACKEND.md`.

## Annotations (two phones)

Strokes use **`videoUv`** — normalized coordinates inside the visible video region:

| Stage | Fit mode | Mobile implementation |
|-------|----------|------------------------|
| Clips | `contain` | `annotationCoords.ts` + clip `naturalSize` from `ClipPlayer` |
| Live camera | `cover` | 16:9 default or focused stream aspect |

| File | Role |
|------|------|
| `annotationCoords.ts` | UV math (contain / cover) |
| `useDrawingSync.ts` | Socket emit/parse `coordSpace: "videoUv"` |
| `DrawingOverlay.tsx` | Emit + render with `strokeForSyncEmit` / `projectStrokeToCanvas` |
| `NativeMeetingScreen.tsx` | Passes `contentAspect`, `contentFit`, `annotationTargetUserId` |

Backend relays `DRAW` → `EMIT_DRAWING_CORDS` **without modifying** `strikes` or `canvasSize` (`relayInCallBySessionOrPeer` + session room `session:{bookingId}`).

### QA (two mobile devices)

1. Trainer draws freehand on clip → trainee sees same position (different screen sizes).
2. Shapes, arrows, text on clip and live focus.
3. Undo / clear canvas syncs.
4. Reconnect: trainer `replaySocketState` rebroadcasts buffered strokes.

## Session recording (instant lessons)

| Step | Mobile | Backend |
|------|--------|---------|
| Toggle | `useInstantLessonRecording` → socket `INSTANT_LESSON_SESSION_RECORDING` with `sessionId` | Relays to session room (same as draw/clip events) |
| Capture | `expo-av` audio + `lessonStageFrameSampler` JPEGs | — |
| Mux | `netqwix-meeting-native` → MP4 if ≥2 frames, else M4A | — |
| Upload | `POST /report/add-session-recording` `format: m4a` \| `mp4` | Presigned PUT; `sessionRecordingUrl` on report |

Not OS screen recording (ReplayKit / MediaProjection). Delivers coach-stage recap for the game plan.

Toggle: `INSTANT_RECORDING_CAPTURE_ENABLED` in `useInstantLessonRecording.ts`.

## Mixed client warning

When **both** users are on mobile, `GET /user/session-join-readiness` returns `mixed_client_warning: null`. Warning appears only if the peer used the web app (`X-NQ-Client` ≠ mobile).

## Related mobile UX (same release)

- Coach browse skeletons (`TrainerBrowseCardSkeleton`, carousels)
- Single-clip inline playback bar (no dead band above action bar)
- Non-mirrored local camera preview in lesson (`mirrorPreview={false}`)
- Offline / system state pages (`SystemOfflineTips`, etc.)

## Out of scope

- Web trainer or trainee in the same lesson
- Web `sendDrawEvent` canvas blob protocol
