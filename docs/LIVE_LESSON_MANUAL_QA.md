# Live lesson manual QA (mobile)

Companion to backend [LIVE_LESSON_QA_MATRIX.md](https://github.com/netqwix/nq-backend/blob/main/docs/LIVE_LESSON_QA_MATRIX.md).

## Prerequisites

- **Dev client build** (not Expo Go): `npx expo run:ios --device` or `npm run android:install-dev`
- Staging API in `.env` (`EXPO_PUBLIC_API_BASE_URL`)
- Two accounts: trainer + trainee (Stripe test mode for paid flows)
- Optional second device for instant accept / two-party call

## Build

```bash
cd nq-mobile
npm install
npx expo run:ios --device
```

## Instant lesson smoke (30 min)

1. Trainee: Book Expert → instant wizard → 15 min → clips → pay → wait modal
2. Trainer: Accept within 2 min (push or in-app modal)
3. Both: Join → precall → enter call
4. Trainer: Verify timer auto-starts when both joined
5. Trainer: Screenshot (clip if possible) → add description → save to report
6. Trainer: Game plan → preview PDF → save
7. End call → ratings → handoff → locker PDF

## Scheduled lesson smoke (30 min)

1. Trainee: Book Expert → schedule wizard → pick slot → pay
2. Trainer: Confirm booking popup (not instant modal)
3. Join within 15 min before start window
4. Trainer: Manual timer start
5. Screenshot + crop corner handles → add to game plan
6. End → locker

## Mobile ↔ mobile lesson UX

Use **two physical devices** (both native builds — not Expo Go for full recording).

1. **Annotations:** Trainer enables draw → marks on clip → trainee sees same spot (try different screen sizes, e.g. iPhone + Android).
2. **Clips UI:** Single clip — no black gap above bottom bar; play/pause/scrub inline under video.
3. **Camera:** Local preview not mirrored; partner view unchanged.
4. **Recording (instant):** Trainer starts recording → trainee notice → end lesson → game plan has audio or MP4.

## Network edge cases

- Airplane mode during screenshot upload → queue toast → restore → auto flush
- Crop before upload completes → preview updates → Add enabled after upload

## Sign-off template

| Matrix ID | Instant | Scheduled | Notes |
|-----------|---------|-----------|-------|
| B1–B9 | | | |
| P1–P4 | | | |
| C1–C9 | | | |
| R1–R4 | | | |

Tester: __________  Date: __________  Build: __________
