# Platform hardening — mobile + backend

Mirrors `nq-backend-main/docs/PLATFORM_HARDENING_PHASES.md`.

## Phase 1–3 ✅

See backend doc for Critical / High / Medium items (all shipped on mobile-aligned paths).

## Phase 4 — Backend ✅

Report delete ownership, crop/remove ownership, report validators, `check-slot` timezone, socket → `instantLessonActions`, `GET /user/session-timeline/:bookingId`.

## Mobile product (v1 polish) ✅ / deferred

| Item | Status |
|------|--------|
| Locker m4a / audio recordings | ✅ `isLikelyAudio` + `LockerAudioPlayer` in game plans |
| AI smart-schedule in booking wizard | ✅ `fetchSmartSchedule` on datetime step |
| Chat E2E fallback warning | ✅ Banner when encryption unavailable |
| Practice sessions | ✅ Interim: links to Clips + library submit |
| Ops session timeline API client | ✅ `fetchSessionTimeline` + `SessionTimelineCard` (report / transaction) |
| Admin session timeline | ✅ `GET /admin/booking/:id/timeline` + booking drawer panel |
| `MeetingClipToolbar` | Deferred — tools on `TimeRemaining` / `ActionButtons` |
| Composited video recording | ✅ Phase 3 — native MP4 mux + `format: mp4` upload |
| iOS / Android PiP | ✅ Phase 2 — iOS `iosPIP` host; Android native PiP module |
