# Trainer identity verification (mobile-first)

NetQwix **trainer identity verification** (contact OTP, profile, AWS Rekognition face liveness, admin review) is implemented end-to-end on:

- **nq-mobile** — `OnboardingNavigator` (`VerifyContactScreen` → `ProfileFaceScreen` → `PendingReviewScreen`)
- **nq-backend** — `/verification/*` and `/admin/trainer-verifications/*`
- **nq-admin** — `/apps/trainer-verifications`

The **web app (nq-frontend-main)** does **not** currently run the trainer verification wizard. Web trainers who must verify should use the **mobile app** until web parity is built.

Trainee account review (reject / approve / reapply) is supported on mobile, web (`AccountRestrictionScreen`), backend, and admin (`/apps/manage-trainee` + pending queue).

SLA target for trainer review: **48 hours** (`TRAINER_VERIFICATION_SLA_HOURS`).
