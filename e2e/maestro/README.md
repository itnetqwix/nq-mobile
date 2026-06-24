# Maestro E2E (live lessons)

Device flows for **scheduled** and **instant** lessons. Requires a **dev client** build (not Expo Go) and staging credentials.

## Setup

```bash
brew install maestro
cd nq-mobile
# Copy and fill credentials (never commit secrets)
cp e2e/maestro/.env.example e2e/maestro/.env
```

Set `APP_ID` to your iOS bundle id or Android package from `app.json`.

## Run

```bash
maestro test e2e/maestro/scheduled-booking-wizard.yaml
maestro test e2e/maestro/scheduled-book-call-gameplan.yaml
maestro test e2e/maestro/instant-book-accept-join-end.yaml
maestro test e2e/maestro/wallet-topup-book-cancel.yaml
```

### Scheduled booking wizard (`scheduled-booking-wizard.yaml`)

End-to-end through all six wizard steps (datetime → duration → clips → promo → payment → confirm). Uses `testID` hooks on wizard steps (`schedule-step-*`, `wizard-*`). Requires:

- Staging trainee with login credentials
- At least one trainer with availability **2+ days out** (2-hour lead time)
- Wallet balance covering the session **or** Stripe test card for PaymentSheet

`scheduled-book-call-gameplan.yaml` runs the same wizard then optionally checks Upcoming; trainer confirm/join is still manual or two-device.

`wallet-topup-book-cancel.yaml` covers trainee wallet top-up (when needed), wallet pay on instant book, and cancel/refund chip. Stripe PaymentSheet steps may require manual completion in test mode.

Flows fall back to visible English labels where `testID` is not wired. Set device language to English for label-based steps.

## Two-device instant flow

1. Device A (trainee): run `instant-book-accept-join-end.yaml` through payment/wait.
2. Device B (trainer): accept booking in app, then both join from notifications or Upcoming.

## CI

| Job | When | What |
|-----|------|------|
| `validate-flows` | Every PR/push | `npm run test:e2e:validate` — flow file structure |
| `maestro-smoke` | Manual / weekly schedule | Full simulator run on macOS |

Enable full E2E in GitHub:

1. Set repository variable `MAESTRO_E2E_ENABLED` = `true`
2. Add secrets: `MAESTRO_APP_ID`, `TRAINEE_EMAIL`, `TRAINEE_PASSWORD` (optional trainer creds)
3. Optional: `MAESTRO_APP_PATH` — path to `.app` on the runner (upload via artifact or build step)
4. Run **Maestro E2E** workflow manually or wait for Monday schedule

Unit payment tests run in the main **Mobile unit tests** workflow (`npm run test:phase4`).
