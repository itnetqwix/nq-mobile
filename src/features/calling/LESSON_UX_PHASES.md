# Live lesson UX — phased rollout (mobile + backend)

Use this checklist when verifying releases. Network adaptation is tracked separately.

## Phase 0 — P0 (lesson blockers)

| Item | Status | Notes |
|------|--------|--------|
| Unified post-call (timer end = manual end) | Done | `openPostCallFlow()` on `lessonTimer.status === "ended"` |
| Recap send → game plan / ratings | Done | `onSent` → `continueAfterRecap()` |
| Call-slot / join-readiness headers | Done | `X-NQ-Auth-Session-Id` + `X-NQ-Device-Id` on REST; backend fallbacks |
| Instant recording | Done | Audio + stage MP4 mux upload; `INSTANT_RECORDING_CAPTURE_ENABLED` |
| Native app lesson notice (precall) | Done | `lesson_client_requirement` + lobby copy |

## Phase 1 — P1 (important UX)

| Item | Status | Notes |
|------|--------|--------|
| Trainee live notes (read-only) | Done | `MeetingTraineeNotesPanel` |
| Persistent extend CTA | Done | Timer toolbar when `extension_preview.allowed` |
| Time warnings (trainer vs trainee copy) | Done | `SessionTimeWarningModal.audience` |
| Instant trainer timer Start/Stop | Done | `showCoachControls={isTrainer}` |
| Game plan pill → locker | Done | `navigateToMyLocker()` |
| Slot taken over modal | Done | `CallSlotTakenOverModal` + `onSlotTakenOver` |
| Rejoin slot check | Done | `MeetingRouter` + `fetchLessonCallSlotStatus` |
| Handoff rebook / retry / trainer rows | Done | `navigateToBookTrainer`, game plan stat |
| Timer pause hints | Done | extension, disconnect, `network_outage` reason |
| Trainee mid-lesson clips | Done | See `CLIPS_PHASES.md` |

## Phase 2 — P2 (polish)

| Item | Status | Notes |
|------|--------|--------|
| Extension 60/120 min | Done | `SessionExtensionModal` chips |
| Session unavailable CTA | Done | Go home on `!peer` |
| Precall “background dim” label | Done | Already honest in lobby |
| Recording consent | Done | Trainer Alert + trainee notice modal |
| `MeetingClipToolbar` | Deferred | Unused; tools on `TimeRemaining` |
| Peer joined modal vs toast | Done | Toast kept (documented in `MeetingPeerJoinedToast`) |

## Phase 3 — Backend

| Item | Status | Notes |
|------|--------|--------|
| Join-readiness header fallbacks | Done | `userController.getSessionJoinReadiness` |
| `LESSON_TIME_PAUSED.reason` | Done | From `LESSON_TIMER_PAUSE_REQUEST` body |
| Handoff summary (trainer game plan) | Done | Existing fields surfaced in UI |
| SESSION_LEAVE grace 45s | Done | `socket.service.ts` |
| Extension payment idempotency | Done | Stable keys; HTTP dedup on all extension POSTs |
| Session recording m4a presign | Done | `format: "m4a"` on `addSessionRecording` |

## Epic order (shipped)

1. Extension payment idempotency
2. Trainee mid-lesson clips
3. Instant recording upload (audio MVP on mobile; web has full video)

## Mobile ↔ mobile (supported)

See `docs/CROSS_CLIENT_ANNOTATION_AND_RECORDING.md`.

- **Annotations:** `videoUv` with contain (clips) / cover (live); backend relays full stroke payload on `session:{id}` rooms.
- **Recording:** Audio + stage-frame mux → M4A/MP4 upload; backend `add-session-recording` + session-room recording socket relay.

Precall may show `mixed_client_warning` only when the **peer is on web** — not for mobile↔mobile.

## Deferred

- **Web in the same lesson** — not a supported matrix row; native-only lessons recommended.
- **OS-level screen recording** — ReplayKit / MediaProjection (separate native epic).
- **PiP multi-tile** (coach + trainee composite in PiP window)
