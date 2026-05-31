# Platform hardening — mobile + backend

Mirrors `nq-backend-main/docs/PLATFORM_HARDENING_PHASES.md`.

## Phase 1 — Critical (done)

- Legacy free extend → **403** `USE_PAID_EXTENSION` (participant-checked)
- Scheduled booking **server price validation**
- Trainer slot **IDOR** fixes on update/delete
- Report / PDF / recording **trainer session ownership**
- Instant accept/decline **REST** + mobile HTTP-first fallback

## Phase 2 — High (done)

- `MeetingRouter` rejoin **error + retry**
- Precall call-slot **fail-closed** on API error
- `ChatsScreen` **error + retry** (no silent empty list)
- Join-readiness **mixed_client_warning** banner in precall

## Phase 3 — Medium (done)

- Chat rate limit on `/common/chat-send`
- `isTrainee` on `book-session`
- Removed dead `ScheduledBookingModal.tsx`

## Still deferred (web or native modules)

- Web paid extension + join-readiness
- Composited video recording on mobile
- iOS system PiP
- Practice sessions on mobile
