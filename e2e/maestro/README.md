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
maestro test e2e/maestro/scheduled-book-call-gameplan.yaml
maestro test e2e/maestro/instant-book-accept-join-end.yaml
maestro test e2e/maestro/wallet-topup-book-cancel.yaml
```

`wallet-topup-book-cancel.yaml` covers trainee wallet top-up (when needed), wallet pay on instant book, and cancel/refund chip. Stripe PaymentSheet steps may require manual completion in test mode.

Flows use visible labels where `testID` is not yet wired. Adjust tap text if your locale differs from English.

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
