# NetQwix Payments — Simple Guide

**Who this is for:** Anyone who wants to understand how money moves on NetQwix — without technical jargon.

**Last updated:** June 2026

---

## The big picture (in one minute)

1. A **trainee** (learner) pays for a lesson.
2. The money is held safely **in escrow** — not given to the trainer right away.
3. The lesson happens. Both people rate the session.
4. After a short waiting period, the trainer gets paid (minus NetQwix’s fee).
5. The trainer can move earnings to their **bank** via Stripe.

Think of escrow like a trusted middle person: *“Pay now, trainer gets paid only after the lesson is done.”*

---

## Who is involved?

| Role | What they do with money |
|------|-------------------------|
| **Trainee (Enthusiast)** | Pays for lessons. Can add money to a **wallet** or pay by **card**. |
| **Trainer (Expert)** | Earns from lessons. Gets paid after escrow releases. Withdraws to bank. |
| **NetQwix (platform)** | Takes a small **commission** on each paid lesson. Handles refunds when needed. |
| **Stripe** | Our payment partner. Handles cards, bank payouts, and secure transfers. |

---

## How a trainee pays for a lesson

There are **two main ways** to book:

### A) Scheduled lesson (book ahead)

1. Trainee picks a trainer, date, and time.
2. They see the **price breakdown** (lesson price, fees, tax if any, discounts).
3. They pay using one of these options:
   - **Wallet** — pay from money already in their NetQwix wallet
   - **Card** — pay with debit/credit card (via Stripe)
   - **Mixed** — part wallet + part card
   - **Promo code** — discount may reduce or remove what they pay
4. Booking is confirmed. Money goes into **escrow**.

### B) Instant lesson (right now)

1. Trainee requests a lesson while the trainer is online and available.
2. They pay the same way (wallet, card, or mixed).
3. Trainer has a short time to **accept** or **decline**.
4. If accepted, they join the lesson. If declined or it times out, the trainee is **refunded**.

---

## What is the wallet?

The **wallet** is like prepaid credits inside NetQwix.

### For trainees

- **Add funds** — top up the wallet with a card (Stripe).
- **Pay faster** — use wallet balance instead of entering card details every time.
- **Auto top-up** — optionally refill when balance gets low.
- **Saved cards** — store a default card for quicker payments.
- **Security PIN** — for larger payments, a PIN may be required (extra safety).
- **Points** — separate from cash; shown on the wallet screen for rewards/loyalty.

> Trainers **cannot** use “Add funds.” That feature is only for trainees paying for lessons.

### For trainers

- **Earnings balance** — money from completed lessons lands here after escrow releases.
- **Stripe Connect** — trainers link their bank account so NetQwix can pay them out.
- **Withdraw** — move available earnings to their bank.
- **Payout choice:**
  - **Fast (wallet)** — earnings stay in the app wallet for quicker access.
  - **Standard (bank)** — earnings go straight to their linked bank via Stripe.

---

## What is escrow? (The safe holding step)

**Escrow** means: *the trainee’s payment is held safely until the lesson is truly finished.*

### When money goes into escrow

- As soon as payment succeeds (wallet, card, or mixed).
- One hold is created per lesson payment.

### When money leaves escrow (trainer gets paid)

All of these must be true:

1. The lesson has **ended** (timer finished or session marked complete).
2. **Both** trainee and trainer have **rated** the session.
3. A **24-hour clearance** period has passed (safety buffer).

Then:

- Trainer receives their **net earnings** — in our $100 example, **$84.50** (after 15% commission and $0.50 trainer fee).
- NetQwix keeps commission, both platform fees, and covers promo subsidies when applicable.

### If something goes wrong

| Situation | What happens |
|-----------|----------------|
| Lesson cancelled before it starts | Trainee is **refunded** from escrow |
| Trainer declines instant lesson | Trainee is **refunded** |
| Instant lesson expires (no accept/join) | Trainee is **refunded** |
| Dispute | Money stays frozen until NetQwix **admin** reviews |

---

## Fees explained — who pays what?

NetQwix uses **two groups of fees**:

1. **Fees the trainee pays** — added on top of (or shown in) the checkout total.
2. **Fees taken from the trainer** — deducted from the trainer’s earnings **after** the lesson.

The trainer sets their **hourly rate**. That rate is the **session price** (the main lesson cost). Everything below is calculated from that.

> **Note:** Exact amounts can vary by US state tax, payment method (card vs wallet), trainer commission deal, promo codes, and admin settings. The example below uses **default US rates** as of June 2026.

---

### Fees paid by the trainee (added at checkout)

These appear on the trainee’s **price breakdown** before they confirm payment.

| Fee name | What it is | Default amount (US) | Who keeps it |
|----------|------------|---------------------|--------------|
| **Session price** | Trainer’s rate × lesson length (e.g. $100/hr × 1 hr) | Set by trainer | Goes into escrow; trainer earns their share after the lesson |
| **Trainee platform fee** | Small NetQwix service fee on each booking | **$0.50** per lesson | NetQwix |
| **Card processing fee** | Cost of running the card payment (Stripe) | **2.9% + $0.30** of the charge base | Passed to trainee when paying by **card**; **$0** when paying by **wallet only** |
| **Sales tax** | Government tax based on billing address | Varies by state (e.g. ~8% in Texas) | Sent to tax authorities |
| **Surge pricing** *(optional)* | Higher price at very busy times | Only when surge rules are on | Split like normal session price |
| **Promo / referral discount** | Money off the session price | Varies | Reduces what trainee pays (see promo section below) |

**Trainee does NOT pay the trainer’s commission.** That comes out of the trainer’s side.

---

### Fees taken from the trainer (deducted from earnings)

These reduce **how much the trainer actually receives** after escrow releases.

| Fee name | What it is | Default amount (US) | Who keeps it |
|----------|------------|---------------------|--------------|
| **Platform commission** | NetQwix’s percentage of the lesson price | **15%** of session price (can differ per trainer) | NetQwix |
| **Trainer platform fee** | Small fixed fee per completed lesson | **$0.50** per lesson | NetQwix |

The trainer still **lists** their rate (e.g. $100/hr). They do not manually subtract these — the system does it when escrow pays out.

---

## Worked example: 1-hour session at $100/hr

**Setup**

- Trainer hourly rate: **$100.00**
- Lesson length: **1 hour**
- Region: **United States**
- Billing state: **Texas** (example tax rate ~8.25%)
- No promo code, no surge pricing
- Default commission: **15%**

---

### Example A — Trainee pays by **card**

| Line item | Amount | Paid by | Notes |
|-----------|--------|---------|-------|
| Session price (1 hr × $100) | **$100.00** | Trainee | Trainer’s listed rate |
| Trainee platform fee | **$0.50** | Trainee | Fixed per booking |
| Card processing fee | **$3.21** | Trainee | 2.9% + $0.30 on $100.50 |
| Estimated sales tax (TX) | **~$8.56** | Trainee | On session + fees |
| **Total trainee pays** | **~$112.27** | Trainee | Shown at checkout |

**What happens to that money**

- The full amount (~$112.27) is collected and held in **escrow**.
- After the lesson completes, both rate, and the 24-hour clearance passes:

| Line item | Amount | Taken from | Who receives |
|-----------|--------|------------|--------------|
| Session price | $100.00 | Escrow | Split below |
| Platform commission (15%) | **$15.00** | Trainer’s share | **NetQwix** |
| Trainer platform fee | **$0.50** | Trainer’s share | **NetQwix** |
| **Trainer receives (net)** | **$84.50** | — | **Trainer** |
| Trainee platform fee | $0.50 | Already paid by trainee | **NetQwix** |
| Processing + tax | $3.21 + ~$8.56 | Paid by trainee | Processing → payment partner; tax → government |

**Simple view for the trainer**

```
Listed rate:     $100.00
− Commission:    $ 15.00  (15%)
− Platform fee:  $  0.50
─────────────────────────
You earn:        $ 84.50
```

**Simple view for the trainee**

```
Lesson price:    $100.00
+ Platform fee:  $  0.50
+ Card fee:      $  3.21
+ Tax:           $  8.56
─────────────────────────
You pay:         ~$112.27
```

---

### Example B — Trainee pays by **wallet** (no card)

Same $100 session, but the trainee uses **wallet balance** only:

| Line item | Amount | Notes |
|-----------|--------|-------|
| Session price | **$100.00** | |
| Trainee platform fee | **$0.50** | |
| Card processing fee | **$0.00** | No card used |
| Estimated sales tax (TX) | **~$8.29** | |
| **Total trainee pays** | **~$108.79** | Lower than card because no processing fee |

**Trainer still earns the same: $84.50** (commission and trainer fee unchanged).

---

### Example C — Trainee pays **mixed** (part wallet + part card)

If the trainee has **$50** in wallet and the session price is **$100**:

- **Two escrow holds** are created — one for the wallet leg, one for the card leg.
- Fees and tax are **split proportionally** between wallet and card (not “all fees on card only”).
- Example on a ~$112 total charge: wallet leg ~$54, card leg ~$58 (approximate; exact split shown at checkout).
- **Trainer still earns $84.50** on the $100 session price (same as full wallet or card pay).

> **Note:** Session extensions do **not** support mixed pay — wallet or card only.

---

### Example D — **$10 off** promo code (platform-sponsored)

Trainee sees a lower checkout total, but the trainer is still paid as if the lesson were full price:

| | Trainee pays | Trainer earns |
|--|--------------|---------------|
| Session price | $100.00 | Based on $100.00 |
| Promo discount | −$10.00 | (NetQwix absorbs discount) |
| Fees + tax | + fees on $90 subtotal | |
| **Trainer net** | — | Still **~$84.50** on $100 base |

If the **trainer** created the promo (trainer-sponsored), the discount **reduces the trainer’s payout** instead.

---

## Edge cases & special situations

This section covers real-world scenarios that differ from the simple flow above.

### Escrow release — what can delay payout?

| Situation | What happens |
|-----------|--------------|
| Lesson not finished yet | Money stays in escrow |
| Only one person rated | Payout **waits** until both trainee and trainer rate |
| 24-hour clearance not passed | Payout **waits** (timer starts when payment is made, not when lesson ends) |
| Dispute opened | Admin must resolve before money moves |
| Session extension purchased | **Separate** escrow hold; each hold releases on its own |

### Instant lessons — timing rules

- Trainer has about **2 minutes** to accept or decline.
- After accept, both have about **2 minutes** to join.
- If accept or join window expires → **automatic refund**.

### Payment edge cases

| Situation | What happens |
|-----------|--------------|
| **100% promo / free lesson** | No payment, no escrow hold |
| **Wallet only** | No card processing fee |
| **Mixed pay** | Two escrow legs; proportional fee split |
| **Session extension** | Wallet or card only (no mixed) |
| **Cancel before lesson** | Refund from escrow (wallet credit or card refund) |
| **Trainer no-show** (scheduled) | Trainee refunded automatically |
| **Unrated session** | Funds can stay in escrow until both rate (or admin steps in) |

### What the Transactions screen shows

- **Trainees** see the **total amount paid** (including fees and tax when escrow data exists).
- **Trainers** see **net earnings** (after commission and platform fee).
- **Session price** is also shown on the transaction detail screen when it differs from the total paid.
- **Payment method** shows friendly labels: NetQwix Wallet, Card, or Wallet + Card.

### Referral & points

- Checkout **dollar discounts** come from **promo codes** (platform- or trainer-sponsored).
- **Referral rewards** are handled through the **points** program, not as an automatic checkout discount.

### Regional availability

- Wallet top-up and wallet pay are **fully enabled in the US** by default.
- Other regions (Canada, EU, UK) may require separate rollout — wallet features may be limited until enabled.

### Trainer payout edge cases

| Situation | What happens |
|-----------|--------------|
| Stripe Connect not set up | Trainer cannot withdraw to bank |
| Bank transfer fails on release | Hold may stay in “releasing” until admin retries |
| Large withdrawal ($100+) | May require PIN and admin approval |

*Engineers: see also `nq-backend-main/docs/PAYMENT_EDGE_CASES.md` for the technical matrix.*

---

## Fee types quick reference

### Trainee-side fees (at checkout)

| # | Fee | Typical? | When it applies |
|---|-----|----------|-----------------|
| 1 | Session price | Always | Every paid lesson |
| 2 | Trainee platform fee | Always (US default) | Every lesson booking |
| 3 | Processing fee | Card / mixed only | When Stripe processes a card |
| 4 | Tax | Most US states | Based on billing address |
| 5 | Surge | Sometimes | Busy periods (if enabled) |
| 6 | Discount | Sometimes | Valid promo or referral |

### Trainer-side deductions (at payout)

| # | Fee | Typical? | When it applies |
|---|-----|----------|-----------------|
| 1 | Platform commission | Always | % of session price (default 15%) |
| 2 | Trainer platform fee | Always (US default) | Every completed lesson |

---

## Important things to remember

1. **The trainer sets the hourly rate** — e.g. $100/hr. That is the “session price” for a 1-hour lesson.
2. **The trainee pays more than $100** — because platform fee, card fee, and tax are added at checkout (wallet pay avoids card fee).
3. **The trainer earns less than $100** — because commission (15%) and trainer platform fee ($0.50) are deducted.
3. **Escrow holds the payment** until the lesson is done and both people rate (see edge cases for timing details).
5. **Commission can differ per trainer** — some trainers may have a custom rate agreed with NetQwix (minimum 5%).
6. **Tax varies** — Texas, California, New York, etc. each have different rates; Canada has provincial tax (HST/GST).

---

## What fees are included? (short list)

When someone books, the price they see can include:

- **Lesson price** — set by the trainer (hourly rate × duration).
- **Trainee platform fee** — small fixed fee per booking ($0.50 US default).
- **Processing fee** — card payment handling (2.9% + $0.30 US default).
- **Tax** — based on billing location.
- **Surge pricing** — optional higher price at busy times.
- **Promo / referral discount** — reduces what the trainee pays.

The app shows a **clear breakdown** before payment so there are no surprises.

**On the trainer side**, NetQwix deducts:

- **Platform commission** — percentage of lesson price (15% default).
- **Trainer platform fee** — fixed per lesson ($0.50 US default).

---

## Step-by-step: money journey (scheduled lesson)

```
Trainee books lesson
        ↓
Payment taken (wallet / card / mixed)
        ↓
Money held in ESCROW
        ↓
Lesson happens (video session)
        ↓
Both people rate the session
        ↓
24-hour wait (clearance)
        ↓
Escrow releases → Trainer earnings
        ↓
Trainer withdraws to bank (via Stripe Connect)
```

---

## Step-by-step: money journey (instant lesson)

```
Trainee requests instant lesson + pays
        ↓
Money held in ESCROW
        ↓
Trainer accepts (~2 min) or declines → refund
        ↓
Both join (~2 min window)
        ↓
Lesson ends + both rate
        ↓
24-hour clearance
        ↓
Escrow releases → Trainer paid
```

---

## Extra features trainees see in the app

| Feature | Where | What it does |
|---------|-------|--------------|
| **Wallet** | Menu → Wallet | Balance, add funds, security |
| **Transactions** | Menu → Transactions | List of lessons, top-ups, refunds |
| **Transaction detail** | Tap any transaction | Status, refund progress, timeline |
| **Payment step** | Booking wizard | Choose wallet, card, or mixed pay |
| **Pricing breakdown** | Before confirm | See all fees and total |
| **Wallet balance** | Home / discover | Quick view of available credits |
| **Session extension** | During live lesson | Pay to extend time (same payment rules) |

---

## Extra features trainers see in the app

| Feature | Where | What it does |
|---------|-------|--------------|
| **Wallet / Earnings** | Menu → Wallet | Available balance, pending earnings |
| **Stripe Connect** | Wallet → Connect bank | One-time setup to receive payouts |
| **Earnings trends** | Wallet home | Charts of recent income |
| **Transactions** | Menu → Transactions | Lessons paid, withdrawals |
| **Earnings breakdown** | Transaction detail | What they earned vs platform fee |
| **Payment explainer** | Wallet screen | Plain explanation of escrow & payouts |
| **Promo codes** | Trainer tools | Create discounts for their trainees |

---

## Session extension (during a live lesson)

Sometimes a lesson needs more time.

1. Trainee requests an extension during the call.
2. They pay again (**wallet or card only** — mixed pay is not supported for extensions).
3. That payment also goes into **escrow** (as a separate hold).
4. Same release rules apply after the extended session ends.

---

## Refunds — in simple terms

- Refunds go **back to how the trainee paid** (wallet credit or card refund via Stripe).
- Status is tracked: processing → completed.
- Trainees can see refund progress on the **transaction detail** screen.

---

## Admin & safety (behind the scenes)

NetQwix admins can:

- View escrow holds and aging reports
- Manually release or refund escrow in disputes
- Search finance transactions
- Approve large trainer withdrawals

Every money move is **logged** for audit and support.

---

## Quick FAQ

**Q: If the trainer charges $100, why do I pay more than $100?**  
The lesson is $100, but checkout also adds a small platform fee ($0.50), card processing fee (if paying by card), and sales tax. Paying by wallet avoids the card fee.

**Q: If the trainer charges $100, why do they only get $84.50?**  
NetQwix takes a 15% commission ($15) and a $0.50 trainer platform fee. $100 − $15 − $0.50 = **$84.50** (default US rates).

**Q: What if one person never rates the session?**  
Funds stay in escrow until **both** parties rate, or NetQwix support/admin resolves it.

**Q: Does the trainer get paid immediately when I book?**  
No. Payment is held in escrow until the lesson is done, both sides rate, and the clearance period passes.

**Q: Can I pay without a card every time?**  
Yes — add money to your wallet once, then pay from wallet balance.

**Q: What if the trainer cancels?**  
You get your money back (refund).

**Q: How does the trainer get money to their bank?**  
They connect Stripe (bank details), then withdraw from available earnings.

**Q: Is my card stored safely?**  
Yes — cards are handled by **Stripe**, not stored directly on NetQwix servers.

**Q: What’s the difference between Transactions and Wallet?**  
**Wallet** = your current balance and add/withdraw actions.  
**Transactions** = history of every lesson payment, top-up, refund, and payout.

---

## Summary

| Stage | Trainee experience | Trainer experience |
|-------|-------------------|-------------------|
| **Before lesson** | Pay full total (e.g. ~$112 card / ~$109 wallet for $100 lesson) → money in escrow | Sees booking; **$84.50** pending (on $100 lesson) |
| **During lesson** | Can extend (extra pay) | Teaches; earnings still pending |
| **After lesson** | Rates session | Rates session |
| **After clearance** | Done | **$84.50** moves to available earnings |
| **Payout** | — | Withdraw to bank |

### $100 / 1-hour lesson cheat sheet

| | Trainee (card) | Trainee (wallet) | Trainer (net) |
|--|----------------|------------------|---------------|
| Session price | $100.00 | $100.00 | (basis for payout) |
| Extra fees at checkout | ~$12.27 | ~$8.79 | — |
| **Total / Earn** | **~$112.27** | **~$108.79** | **$84.50** |

---

## Admin: dynamic fees (for operations team)

All of these live in **Admin → Pricing & fees** (`/apps/pricing`). Changes apply to **new checkouts only** — existing escrow holds keep their saved snapshot.

| Fee type | Where to edit | Who it affects |
|----------|---------------|----------------|
| **Commission %** | Rates & fees → core rates | Trainer payout (per-trainer override in Manage Trainers) |
| **Platform fees** | Rates & fees → trainee + coach platform fee | Trainee checkout + trainer deduction |
| **Processing / transaction fees** | Rates & fees → Advanced → payment processing grid (bps + fixed ¢ per method) | Trainee when “pass processing to trainee” is on |
| **Surge / peak pricing** | Surge & peak tab — time windows + demand rules | Trainee session price; trainer earns on surged subtotal |
| **Tax** | Rates & fees → estimated sales tax grid **or** enable Stripe Tax toggle | Trainee checkout total |
| **Per-product overrides** | Rates & fees → Advanced → product fees | Instant lesson, extension, storage, etc. |

**Company benefit:** Ops can tune margin without a deploy — e.g. raise commission in a market, absorb processing during promos, or adjust TX tax after a CPA review. Use **Profit check** tab before saving.

---

## Remaining edge cases & roadmap

| Item | Status | Notes |
|------|--------|-------|
| Mixed wallet + card pay | **Done** | Bookings + extensions; two escrow holds; proportional fees |
| Transaction detail totals | **Done** | Total paid vs session price + fee breakdown |
| Multi-hold trainer earnings | **Done** | Aggregates booking + extension legs |
| Admin tax rates | **Done** | Editable when Stripe Tax is off |
| Unrated session auto-release | **Done** | Configurable grace days in Admin → Rates → Escrow policy |
| Rating reminders | **Done** | Daily push after N days (configurable) |
| GB/EU pricing regions | **Done** | Admin tabs + quote engine (enable wallet via env) |
| Legacy escrow backfill | **Done** | Finance → Preview / Backfill legacy escrow |
| Extension mixed pay | **Done** | Wallet + card supported in-call |

**Deploy order:** ship **backend** first, then **admin**, then **mobile** so APIs and policy config are live before clients rely on them.

---

*Questions about a specific charge? Use **Transactions** in the app or contact NetQwix support with the session date and trainer name.*
