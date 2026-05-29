# Product UX roadmap (mobile + backend)

Phased rollout so existing call, booking, chat, and payment flows keep working. Each phase is shippable on its own.

## Phase 1 — Conversion & trust (mobile-only, low risk)

| Item | Status | Acceptance |
|------|--------|------------|
| Students → Message | Done | Trainer taps Message; conversation opens in Chats tab |
| Students → Nudge to book | Done | Sends `POST /trainer/trainee-nudge` (comeback template); no crash if API fails |
| Continue booking banner | Done | After sign-in from guest book intent, dashboard shows dismissible banner instead of auto-opening wizard |
| Chat offline queue indicator | Done | Chat header shows “N sending…” when messages for this thread are queued |
| Guest tab CTA | Existing | `GuestTabGateScreen` uses `peekPendingAuthIntent` coach name |

## Phase 2 — Lesson quality & money (mobile)

| Item | Status | Acceptance |
|------|--------|------------|
| Wallet guard before payment | Done | Promo → payment warns if wallet balance &lt; payable (Continue / Add funds / Cancel) |
| Game plan → chat | Done | After save, optional “Send to chat” posts summary to trainee |
| Trainer notes on Students | Done | Note icon opens same note API as chat pinned note |
| Pre-class checklist | Existing | `PreClassChecklistSheet` on dashboard |

## Phase 3 — Growth & persistence (mobile + backend)

| Item | Status | Acceptance |
|------|--------|------------|
| Compare trainers persistence | Done | Compare tray survives app restart (AsyncStorage) |
| Guest activity replay | Existing | `replayGuestData` + `POST /trainee/guest-activity` |
| Trainer AI actions | Done | `open-students`, `open-chats`, `open-instant-requests` in `aiActions` |
| Notification deep links | Existing | `PushNotificationBridge` / `useContentDeepLink` |

## Guardrails (do not change without web alignment)

- Socket clip sync event names and payloads
- Trainee cannot seek clips or draw on clip stage
- Server-driven lesson timer end
- `ClipPlayer` uses expo-av with `useNativeControls={false}`

## Phase 4 — Guest funnel completion & notification routing

| Item | Status | Acceptance |
|------|--------|------------|
| Guest seeded coaches carousel | Done | After signup, home shows coaches from `GET /trainee/guest-activity/seeded-trainers` |
| Guest replay cache invalidation | Done | `replayGuestData` invalidates seeded + personalized feed queries |
| Resume chat after sign-in | Done | Guest chat intent with coach opens that DM; generic chat → Chats tab |
| Unified notification deep links | Done | Push taps + inbox use `notificationRouting.ts` (sessions, game plans, clips, chat, meeting) |
| Free intro hero (guest home) | Existing | `GuestDiscoverHomeScreen` + `FreeIntroLessonHero` |

## Phase 5 — Retention & polish

| Item | Status | Acceptance |
|------|--------|------------|
| Post-session rating banner | Done | Home shows “Rate your lesson” when latest completed session has no viewer rating |
| Skip → remind later | Done | In-call “Not now” stashes pending rating; dashboard banner re-opens modal |
| Ratings modal i18n | Done | `postSessionRating.*` keys + `useAppTranslation` in `RatingsModal` |
| Locale sync (Phase 1–5 keys) | Done | `trainees`, `continueBooking`, `guestSeeded*`, `postSessionRating`, AI actions copied to all locale files (English fallback) |

## Phase 6 — Future (not started)

| Item | Notes |
|------|--------|
| Practice sessions | New product surface — needs spec + backend |
| Native background blur | WebRTC / platform SDK — high risk in call path |
| Professional translations | Replace English fallbacks in `ar`, `de`, `es`, etc. with native copy |

## Verification checklist (each release)

1. Guest browse → sign in → continue booking banner → complete book flow
2. Scheduled + instant book with wallet shortfall → guard → card pay still works
3. Chat send offline → queue badge → reconnect → flush
4. Trainer: Students message + nudge + note
5. Post-call game plan save + send to chat
6. Backend: `npm run build` (no CI regressions)
7. New trainee home: "Coaches you were checking out" strip after guest signup
8. Push notification tap → game plan / session / chat (not only inbox)
9. Guest sign-in from coach chat gate → lands in that conversation
10. End lesson → skip rating → home banner → submit rating
