# Critical flows — manual E2E checklist

Use this checklist before release. Run on **staging** with real Stripe test mode where noted.

**Physical device sign-off:** copy [DEVICE_QA_TRACKER.md](./DEVICE_QA_TRACKER.md) and fill the matrix per build.

Mark each cell: **Pass** / **Fail** / **N/A** / **Blocked**. Test on **iOS** and **Android** separately — native WebRTC, MMKV, and push behave differently per platform.

## Device QA matrix (11 areas × role × platform)

| Area | Trainer iOS | Trainer Android | Trainee iOS | Trainee Android | Notes |
|------|-------------|-----------------|-------------|-----------------|-------|
| **1. Live lessons** | | | | | Join/rejoin, call slot, game plan, screenshots |
| **2. Payments / escrow** | | | | | Book, hold, release, refund visibility in wallet |
| **3. Schedule sessions** | | | | | Trainer confirm/decline; trainee cancel pending + refund |
| **4. Instant lessons** | | | | | Accept/decline, join window, auto-refund on expiry |
| **5. Chats** | | | | | Send/receive, react, forward, pin, read receipts toggle |
| **6. Onboarding** | | | | | Trainer verification wizard; trainee signup + OTP |
| **7. Clips / locker** | | | | | Upload, library, share, delete |
| **8. Invite / referral** | | | | | Code share, attribution, rewards |
| **9. Capture** | | | | | Record, trim, local library |
| **10. Settings / privacy** | | | | | Block list, visibility, 2FA (trainer), data export save/share |
| **11. Wallet / payouts** | | | | | Top-up, saved cards, trainer Connect payout |

### Per-area smoke steps

#### 1. Live lessons
- [ ] Trainer + trainee: scheduled confirmed session → both join within window → lesson completes
- [ ] Rejoin after brief disconnect
- [ ] Game plan PDF (server stitch when enabled)
- [ ] Report issue from completed session

#### 2. Payments / escrow
- [ ] Trainee: card PI → `confirmPayment` → book → escrow hold created
- [ ] Trainee: wallet pay + PIN → book → wallet debit + escrow
- [ ] Trainee: 100% promo → book without PI/wallet
- [ ] Double-tap book → same `Idempotency-Key` → single booking (409 or replay)
- [ ] PI succeeds → force DB save fail → Stripe refund fires
- [ ] Promo at usage limit → second booking rejected atomically
- [ ] Escrow status visible on session detail + wallet activity

#### 3. Schedule sessions
- [ ] Trainee books → status `booked` → trainer sees confirm/decline
- [ ] Trainer confirms → trainee notified → join opens 15 min before start
- [ ] Trainer declines → trainee refund initiated (`trainer_cancelled_scheduled`)
- [ ] **Trainee cancels pending** → refund initiated (`trainee_cancelled_scheduled`)
- [ ] Unauthorized caller cannot confirm/cancel another user's session (403)

#### 4. Instant lessons
- [ ] Mobile: card payment step → book → trainer accept/decline
- [ ] Wallet instant path (mobile)
- [ ] Accept expiry / join expiry refunds

#### 5. Chats
- [ ] 1:1 send/receive (text + media)
- [ ] React to message (`POST /common/chat-react`)
- [ ] Forward message (`POST /common/chat-forward`)
- [ ] Pin / unpin / get pinned (`/common/chat-pin`, `/common/chat-unpin`, `/common/chat-pinned/:id`)
- [ ] Read receipts toggle (`POST /common/chat-read-receipts`)
- [ ] Scheduled message list + cancel (`/common/chat-scheduled`)
- [ ] Group create, invite, exit

#### 6. Onboarding
- [ ] Trainee: account → profile → OTP → password → login; draft restore after kill
- [ ] Trainer: signup → profile → verification wizard → pending review
- [ ] Trainer: Stripe Connect from wallet

#### 7. Clips / locker
- [ ] Upload clip with presigned URL
- [ ] Library + shared clips load
- [ ] Delete clip / saved session

#### 8. Invite / referral
- [ ] Share referral link / code
- [ ] New signup attributes referrer
- [ ] Rewards visible in referral dashboard (if enabled)

#### 9. Capture
- [ ] Record clip in Capture tab
- [ ] Appears in local captured library
- [ ] Upload to locker (when online)

#### 10. Settings / privacy
- [ ] Block / unblock user
- [ ] Profile visibility toggles persist
- [ ] Trainer 2FA enable + trusted device
- [ ] Data export: request → JSON saved + share sheet; status shows `ready` on revisit

#### 11. Wallet / payouts (trainer-heavy)
- [ ] Wallet top-up (card)
- [ ] Saved payment methods CRUD
- [ ] Trainer withdrawal / Connect onboarding
- [ ] Activity list matches ledger

---

## Payment — scheduled booking (detailed)

- [ ] Trainee: card PI → `confirmPayment` → book session → escrow hold created
- [ ] Trainee: wallet pay + PIN → book session → wallet debit + escrow
- [ ] Trainee: 100% promo → book without PI/wallet
- [ ] Double-tap book → same `Idempotency-Key` → single booking (409 or replay)
- [ ] PI succeeds → force DB save fail → Stripe refund fires
- [ ] Promo at usage limit → second booking rejected atomically

## Payment — instant lesson

- [ ] Mobile: card payment step → book → trainer accept/decline
- [ ] Web: Stripe step in modal → book → clip selection
- [ ] Wallet instant path (mobile)

## Payment — extension

- [ ] Mobile: wallet extension → `isExtensionWalletSettled` true
- [ ] Mobile: card extension → PI metadata `request_id` → escrow idempotency key
- [ ] Expire/cancel extension → wallet + Stripe refund

## Signup — trainee (mobile)

- [ ] Full flow: account → profile → OTP email/SMS → password → login
- [ ] Kill app mid-OTP → reopen → draft restored (7-day TTL)
- [ ] Keyboard dismiss on tap outside fields

## Signup — trainer (mobile)

- [ ] Signup → profile setup (certs/work/degrees) → verification wizard → pending
- [ ] Wallet → Payout setup → Stripe Connect URL opens → refresh status

## Signup — web

- [ ] Basic info → details → email OTP + SMS OTP → signup succeeds
- [ ] Password rules: 8+ chars, upper, lower, special
- [ ] Trainer KYC step (Stripe link) after signup

## Admin finance

- [ ] Escrow: release + refund buttons
- [ ] Wallet adjust (credit/debit)
- [ ] Wallet refund by session (no PI)
- [ ] Stuck top-ups list + reconcile
- [ ] Reconcile refunds / releasing holds

## Ops / infra

- [ ] Production boot fails if `REDIS_ENABLED=false`
- [ ] `REDIS_ENABLED=true`: idempotency replay, quote cache, auto top-up lock

## Deprecated paths

- [ ] `POST /trainer/create-money-request` returns 410
- [ ] Trainer uses `POST /wallet/withdraw` instead

## Known gaps (track separately)

- Mobile ↔ web WebRTC in same lesson (use mobile ↔ mobile for release QA)
- Expo Go: no native WebRTC / MMKV — use dev client builds
- Capture upload queue when offline (local-only until online)
