# Performance stack — phased rollout (mobile + backend)

Status key: ✅ shipped · ⏭️ intentionally skipped · 📋 device QA

---

## Phase 1 — Quick wins ✅

| Item | Status |
|------|--------|
| NetInfo → `networkStatusStore` | ✅ |
| FlashList: BookExpert, Notifications, ChatRoom | ✅ |
| Optimistic sessions (`patch` / `upsert` query caches) | ✅ |
| MMKV: query persist, offline chat queue, screenshot queue | ✅ |
| Backend: Redis join-readiness cache | ✅ |
| Backend: Helmet security headers | ✅ |
| Backend: Sessions list cache (60s) | ✅ (pre-existing) |

---

## Phase 2 — Medium impact ✅

| Item | Status |
|------|--------|
| Zustand ephemeral UI (browse filters, meeting chrome) | ✅ |
| Generalized offline action queue + booking status flush | ✅ |
| Annotation stroke throttle (16ms normal tier) | ✅ |
| Backend compound session indexes | ✅ |
| BullMQ game-plan notify worker | ✅ |
| Zod validation scaffold (session-detail, join-readiness, timeline) | ✅ |

---

## Phase 3 — Scale ✅

| Item | Status |
|------|--------|
| Server PDF stitch (sharp + pdf-lib + BullMQ) | ✅ |
| Mongo `MONGO_READ_PREFERENCE` | ✅ |
| FlashList: Chats, Friends, Community, Instant Booking | ✅ |
| MMKV offline chat history read cache | ✅ |
| Session-detail Redis cache (30s) | ✅ |
| WatermelonDB | ⏭️ skipped (MMKV cache sufficient) |
| Daily/LiveKit, gRPC, uWebSockets | ⏭️ out of scope |

---

## Phase 4 — Server PDF handoff ✅

| Item | Status |
|------|--------|
| Mobile skips client PDF upload when server stitches | ✅ |
| `EXPO_PUBLIC_SERVER_GAME_PLAN_PDF` env toggle | ✅ |
| `serverPdfStitchEnqueued` in createReport response | ✅ |
| FlashList: ArchivedChats | ✅ |

---

## Phase 5 — FlashList completion ✅

| Screen | Status |
|--------|--------|
| UpcomingSessionsScreen | ✅ |
| TransactionsScreen | ✅ |
| StudentsScreen | ✅ |
| WalletActivityScreen | ✅ |
| TrainerPromoCodesScreen | ✅ |
| BlockedUsersScreen | ✅ |
| SavedPaymentMethodsScreen | ✅ |
| CapturedLibraryScreen | ✅ |

**Still FlatList (low traffic / special UX):** IntroOnboarding (horizontal pager), AIAssistant, SupportChat — keep FlatList for `scrollToEnd` simplicity.

---

## Tests ✅

- Mobile: 11 suites / 39 tests (`npm test`)
- Backend: 32 suites / 93 tests + `npm run typecheck`

---

## Env knobs

```bash
# Mobile
EXPO_PUBLIC_SERVER_GAME_PLAN_PDF=true   # default; set false for legacy client PDF

# Backend
REDIS_ENABLED=true
MONGO_READ_PREFERENCE=secondaryPreferred   # optional Atlas read replicas
```
