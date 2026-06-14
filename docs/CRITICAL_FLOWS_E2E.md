# Critical flows — manual E2E checklist

Use this checklist before release. Run on **staging** with real Stripe test mode where noted.

## Payment — scheduled booking

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
