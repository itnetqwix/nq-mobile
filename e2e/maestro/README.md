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
```

Flows use visible labels where `testID` is not yet wired. Adjust tap text if your locale differs from English.

## Two-device instant flow

1. Device A (trainee): run `instant-book-accept-join-end.yaml` through payment/wait.
2. Device B (trainer): accept booking in app, then both join from notifications or Upcoming.

## CI

Maestro is not wired in GitHub Actions (needs simulators + secrets). Use backend `npm test` and mobile `npm test` in CI; run Maestro locally before release.
