# Device QA tracker — physical sign-off

Use with [CRITICAL_FLOWS_E2E.md](./CRITICAL_FLOWS_E2E.md). Fill this in on **staging** before release.

**Build under test:** _______________  
**Tester:** _______________  
**Date:** _______________

## How to score

| Symbol | Meaning |
|--------|---------|
| P | Pass |
| F | Fail (link Linear/Jira ticket) |
| B | Blocked (note dependency) |
| N/A | Not applicable for this role/platform |

## Matrix

| # | Area | Trainer iOS | Trainer Android | Trainee iOS | Trainee Android | Ticket / notes |
|---|------|-------------|-----------------|-------------|-----------------|----------------|
| 1 | Live lessons | | | | | |
| 2 | Payments / escrow | | | | | |
| 3 | Schedule sessions | | | | | |
| 4 | Instant lessons | | | | | |
| 5 | Chats (+ extras) | | | | | |
| 6 | Onboarding | | | | | |
| 7 | Clips / locker | | | | | |
| 8 | Invite / referral | | | | | |
| 9 | Capture (+ offline upload) | | | | | |
| 10 | Settings / privacy / export | | | | | |
| 11 | Wallet / payouts | | | | | |

## Cross-platform calls (explicit)

| Scenario | Result | Notes |
|----------|--------|-------|
| Mobile trainer ↔ mobile trainee | | Dev client required |
| Mobile trainer ↔ web trainee | | Web uses socket-native when mobile peer detected |
| Mobile trainee ↔ web trainer | | |
| Web ↔ web (regression) | | PeerJS path |

## Capture offline upload

| Step | Result | Notes |
|------|--------|-------|
| Record clip in Capture | | |
| Airplane mode → upload from library | | Should queue, not lose clip |
| Restore network → auto upload | | Locker refreshes |

## Data export

| Step | Result | Notes |
|------|--------|-------|
| Small account → inline JSON + share sheet | | |
| Large account → queued → email link | | Needs `REDIS_ENABLED=true` |
| Status screen shows `ready` + download | | |

## Sign-off

- [ ] All **P** or **N/A** for release-critical cells
- [ ] No open **F** without approved waiver
- [ ] Finance + admin smoke on nq-admin completed separately

**Approved by:** _______________ **Date:** _______________
