# Cross-platform sessions (mobile ↔ web)

NetQwix treats **one booking id (`lessonId`)** as the session key across web and mobile. Media runs per device; **MongoDB + socket session rooms** keep timer, presence, clips, and booking status consistent.

## Layers of truth

| Layer | Source | Shared across devices? |
|-------|--------|-------------------------|
| Booking row | MongoDB via `GET /user/scheduled-meetings`, `GET /user/session-detail/:id` | Yes |
| Instant pre-call UI | Socket `INSTANT_LESSON_*` + `INSTANT_LESSON_PHASE` | Per device unless reconciled |
| In-call timer / presence | Socket room `session:{bookingId}` + `LESSON_*` events | Yes for clients in the room |
| WebRTC media | Per client (`PeerJS` web, `socket-webrtc` mobile) | No handoff — rejoin same `lessonId` |
| Local overlays | `InstantLessonContext` (mobile), Redux (web) | Rebuilt on connect / foreground |

Constants: [`src/lib/sessions/sessionContract.ts`](../src/lib/sessions/sessionContract.ts)

## End-to-end flows

### Scheduled session

1. Trainee books on web or mobile → `BOOKING_CREATED` → both clients invalidate lists.
2. Trainer confirms → `BOOKING_STATUS_UPDATED` (scheduled only).
3. Join window: ±15 min around slot; both use `ON_CALL_JOIN` with `signalingMode: "socket-webrtc"` on mobile for web↔mobile video.
4. Timer: trainer may start manually; server broadcasts `LESSON_STATE_SYNC` to the room.
5. Leave / rejoin: `ON_CALL_LEAVE` (temporary) vs `close` / `CALL_END` (terminal). Mobile mirrors web in `useSessionPresence` + `NativeCallEngine`.

### Instant lesson

1. Trainee books → Mongo `booked`, `pending_accept` → `INSTANT_LESSON_REQUEST`.
2. Trainer accepts on **either** client → `INSTANT_LESSON_PHASE` = `pending_join` + `INSTANT_LESSON_ACCEPT` (includes `joinDeadlineAt`).
3. Both join meeting with same `lessonId` → `ON_CALL_JOIN` → `ON_BOTH_JOIN` sets `both_joined_at` (instant).
4. Expiry / decline → `INSTANT_LESSON_PHASE` = `cancelled` + refund; lists use **Expired/Cancelled** tab on mobile.

## Mobile architecture

```
AppRoot
  SocketProvider
    NotificationProvider     ← BOOKING_*, INSTANT_LESSON_PHASE → invalidate + bridge
    SessionBookingProvider   ← pending scheduled requests
    InstantLessonProvider    ← instant overlays + socket handlers
      SessionLifecycleBridge ← reconcile Mongo → UI on connect / foreground
      PushNotificationBridge
    MeetingRouter → NativeMeetingScreen
      CallProvider / NativeCallEngine   ← ON_CALL_JOIN, signalingMode: socket-webrtc
      useLessonTimer / useSessionPresence / useClipSync
```

### Reconciliation (mobile ↔ web handoff)

[`SessionLifecycleBridge`](../src/features/sessions/SessionLifecycleBridge.tsx) runs when:

- Socket connects
- App returns to foreground

It refetches `upcoming` + `confirmed` meetings and calls [`reconcileInstantLessonRows`](../src/lib/sessions/reconcileCrossPlatformSessions.ts):

- **Trainer:** restores incoming or accepted join-window UI via `focusTrainerRequestFromSession`.
- **Trainee:** restores waiting or accepted flow via `restoreTraineeFlowFromSession`.

It does **not** auto-open the meeting — user taps **Join** / **Rejoin** or follows a push deep link (same as web opening `/meeting?id=`).

`INSTANT_LESSON_PHASE` handler in `InstantLessonContext` now syncs `pending_join`, `active`, and `completed` so accept on web updates mobile without restart.

### In-call parity with web

| Concern | Mobile module | Web module |
|---------|---------------|------------|
| Join announce | `NativeCallEngine` → `ON_CALL_JOIN` | `VideoCallUI` |
| Mixed signaling | `signalingMode: "socket-webrtc"` | Native path in portrait-calling |
| Timer | `useLessonTimer` | `useLessonTimer.js` |
| Presence | `useSessionPresence` | Same event names |
| Clips / layout | `useClipSync`, `useMeetingLayout` | `clip-mode.jsx` |

See also [`src/features/calling/README.md`](../src/features/calling/README.md).

## What we do not support (by design)

- **Moving live video between devices** — user ends or backgrounds one client and **Rejoins** on the other with the same booking id.
- **Single socket per user** — booking events go to the last connected device; in-call room events reach every socket that joined `session:{id}`.
- **Expo Go** — native WebRTC required; use dev build or EAS.

## QA matrix (mobile ↔ web)

| Step | Trainer | Trainee | Pass criteria |
|------|---------|---------|---------------|
| Instant accept on web, open mobile | Web | Mobile app foreground | Trainee sees accepted + join CTA; lists refreshed |
| Instant accept on mobile, open web | Mobile | Web refresh | Web trainee modal / meeting join available |
| Join web, rejoin mobile | Web in call | Mobile | Same timer via `LESSON_STATE_REQUEST`; Rejoin works until timer ends |
| Clip play | Web | Mobile | Trainee follows `ON_VIDEO_*` |
| Expired request | — | — | Row leaves dashboard; appears under Expired/Cancelled |

## Future hardening (optional)

- Backend: emit `BOOKING_STATUS_UPDATED` for instant confirm **or** document PHASE-only (current).
- Multi-device fan-out for `BOOKING_*` / `INSTANT_LESSON_ACCEPT` (all push tokens).
- Redis Socket.IO adapter for multi-node `lessonSessions`.
- Explicit “Continue on this device” that emits `ON_CALL_LEAVE` on other tab.
