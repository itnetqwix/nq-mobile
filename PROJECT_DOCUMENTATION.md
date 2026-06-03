# NetQwix Mobile (`nq-mobile`) — Project Documentation

> Single source of truth for **what is in the mobile app, how it works, and the cases it handles**.
> Update this file every time a feature/screen/store slice/socket event is added.

---

## 1. Project Overview

**Type:** React Native (Expo SDK 54) + TypeScript app for iOS & Android. Companion to the NetQwix web app (`nq-frontend-main`) and admin (`nq-admin-frontend`). Same backend (`nq-backend-main`).

**Runtime:** React `19.1.0`, React Native `0.81.5`, Expo `~54.0.33`, TypeScript `~5.9.2`. Requires a **dev client** (custom Expo build) for native video — Expo Go cannot host WebRTC + CallKeep.

**State / data:**
- **Redux Toolkit** (`@reduxjs/toolkit`) — auth, socket, ui, system, sessionBooking, notifications, instantLesson slices.
- **TanStack Query v5** with `AsyncStorage` persistence (`query-async-storage-persister` + `query-persist-client`).
- **AsyncStorage** + `expo-secure-store` for tokens, session id, refresh token, account type, biometric prefs.

**Navigation:** `@react-navigation/native` v7 — native stack + bottom tabs + drawer. See §4.

**Networking:** Axios (`apiClient`) with Bearer token interceptor, refresh-token retry, network status reporter, cert pinning gate, optional Expo native fetch (`EXPO_PUBLIC_USE_EXPO_FETCH=1`).

**Real-time:** `socket.io-client` connection in `src/features/socket/SocketContext.tsx` with bridges for chat / instant lessons / notifications / call signaling / query invalidation.

**WebRTC:** `react-native-webrtc 124.0.6` + `react-native-callkeep` for native in-app call UI.

**Payments:** `@stripe/stripe-react-native` (PaymentSheet, Apple/Google Pay).

**Security:**
- E2E chat via NaCl box (`tweetnacl` + `tweetnacl-util`) using each user’s Curve25519 public key from `/user/:id/chat-public-key`.
- Cert pinning gate (`src/lib/security/certPinning.ts`).
- `expo-local-authentication` biometric app unlock (`AppUnlockGate`).
- Session epoch + `markAuthSessionEstablished` to ignore stale 401s during grace.

**i18n:** `i18next` + `react-i18next` (`src/i18n/`). Language follows the user profile (`applyLanguageFromUser`).

---

## 2. Entry Points

| File | Purpose |
|------|---------|
| `index.ts` | Registers root component, mutes known dev warnings. |
| `App.tsx` | Wraps `AppRoot` from `src/app/`. |
| `src/app/AppRoot.tsx` | Providers tree: gesture handler, safe-area, ErrorBoundary, Redux StoreProvider, React Query persister, theme, i18n, AuthContext, SocketContext, InstantLessonContext, NotificationContext, navigation container, system-state providers. |
| `src/navigation/RootNavigator.tsx` | Auth status routing + verification gate + trainer-profile setup gate + global overlays (instant-lesson UI, toast, onboarding walkthrough). |

**Environment:** `EXPO_PUBLIC_API_BASE_URL` (defaults to `https://api-netqwix.com`). Only `EXPO_PUBLIC_*` env vars are exposed to the app.

---

## 3. Top-level Folder Map (`src/`)

| Folder | Role |
|--------|------|
| `app/` | `AppRoot` — providers/wiring. |
| `api/` | Axios `apiClient`, request/response interceptors, refresh-token retry, browser-like headers, API contract types/OpenAPI export. |
| `config/` | Environment + `apiRoutes.ts` (mirrors backend paths). |
| `constants/` | Account types, web route parity, storage keys, design tokens. |
| `theme/` | Colors, typography, spacing, `useThemeColors`. |
| `components/` | UI primitives + brand assets + network/system banners + payment buttons. |
| `navigation/` | Root, auth, main tabs, drawer, stacks, helpers (header, swipe shells), nav matrix. |
| `features/` | All product code grouped by domain (see §5). |
| `i18n/` | Initialisation + per-language JSON. |
| `lib/` | Shared utilities — auth session guard, query keys / invalidate, idempotency, sentry, presigned put, http parsers, security, intl, time zones, sessions, refresh, support helpers. |
| `store/` | Redux store + slices + middleware (query-cache listener) + selectors. |
| `i18n/`, `theme/` | i18n + design system. |

---

## 4. Navigation Topology

```
RootNavigator (Native Stack)
├── BrandedSessionLoader            (status === "loading")
├── AccountRejectedScreen           (user.status === "rejected")
├── TrainerProfileSetupNavigator    (trainer needs profile setup)
├── OnboardingNavigator             (verification required or started early)
└── Stack:
    ├── Main → DashboardDrawerShell
    │      └── Drawer ("Tabs") → MainTabs (bottom)
    │            ├── Home    → TabSwipeShell → HomeNavigator
    │            │     ├── DashboardHome / DashboardFeature / ShellSurface
    │            │     ├── TransactionDetail / ReportIssue
    │            │     ├── ActiveSessions / StoragePlan / ArchivedChats
    │            │     ├── NotificationPreferences / BlockedUsers
    │            │     └── DataExport / TwoFactor
    │            ├── Schedule → ScheduleScreen (guest gate shown for guests)
    │            └── Chats    → ChatsScreen
    ├── Meeting → MeetingRouter (fullScreenModal, gestureDisabled)
    ├── Auth   → AuthNavigator (Login/SignUp/ForgotPassword/MagicLinkRequest/MagicLinkVerify)
    └── SystemState → SystemStateScreen (modal)

Overlays (mounted alongside the stack when signed in):
  InstantLessonIncomingCallOverlay
  InstantLessonTrainerModal
  InstantLessonTraineeModal
  InstantLessonStatusBanner
  NotificationToast
  OnboardingWalkthrough
  GracePeriodBanner (verification grace period)
```

**Route types:** `src/navigation/types.ts` (`RootStackParamList`, `MainTabParamList`, `HomeStackParamList`, `AuthStackParamList`, `DashboardDrawerParamList`, `ChatTabOpenPayload`).

**Dashboard surfaces** (declarative metadata, see §5.1):
- Feature surfaces in `src/features/dashboard/config/dashboardRoutes.ts` — `instant-booking`, `schedule`, `book-lesson`, `chats`, `upcoming-sessions`, `my-community`, `contact-us`, `about-us`, `faq`, `friends`, `students`, `meeting-room`, `practice-session`.
- Shell surfaces in `src/features/dashboard/config/shellSurfaces.ts` — `clips`, `gamePlans`, `savedLessons`, `invite`, `notifications`, `settings`, `wallet`, `transactions`, `trainerSchedule`, `editProfile`, `professionalProfile`, `reportIssue`, `supportChat`, `meeting`, `messenger`.

Each surface lists the **allowed roles** (Trainer / Trainee) and the web equivalent for parity.

---

## 5. Features (`src/features/*`)

### 5.1 `dashboard/` — Home hub + locker + utilities

**Screens (`screens/`):** `DashboardHomeScreen`, `DashboardFeatureScreen` (route dispatcher), `ShellSurfaceScreen`, `MenuHomeScreen`, `EditProfileScreen`, `ContactUsScreen`, `FaqScreen`, `AboutUsScreen`, `CommunityScreen`, `ClipsScreen`, `GamePlansScreen`, `SavedLessonsScreen`, `InviteFriendsScreen`, `ReportIssueScreen`, `SettingsScreen`, `TrainerScheduleScreen`, `TransactionsScreen`, `TransactionDetailScreen`, `MeetingRoomScreen`, `InstantBookingScreen`, `PracticeSessionScreen`, `GuestDiscoverHomeScreen`.

**Config:** `dashboardRoutes.ts`, `shellSurfaces.ts` — declarative role gating + web parity.

**Hooks:** `useDashboardSessions`, `useFavoriteTrainers`, `useGuestFavoriteTrainers`, `useRecentlyViewedTrainers`.

**API:** `favoriteTrainersApi.ts`, `trainerNotesApi.ts`.

**Lib:** `categoryIcons`, `recentlyViewedTrainers`, `sortTrainersForDiscover`, `traineeDiscoverConstants`, `traineeInterests`, `trainerSlotUtils`.

### 5.2 `auth/`

**Screens:** `LoginScreen`, `SignUpScreen`, `ForgotPasswordScreen`, `MagicLinkRequestScreen`, `MagicLinkVerifyScreen`, `ActiveSessionsScreen`, `GuestTabGateScreen`.

**Components:** `AppUnlockGate` (biometric), `AuthEscapeLink`, `AuthModalChrome`, `AuthScreenLayout`, `GoogleSignInButton`, `LegalTermsAcceptance`, `PasswordRequirements`, `PendingAuthResumeBridge`, `SignupCategoryPicker`, `SignupInlineOtp`, `SocialAuthButtons`.

**API:** `authApi`, `authSessionsApi`, `magicLinkApi`, `signupOtpApi`, `socialAuth`, `accountDeletionApi`, `masterApi`, `types`.

**Context / hooks / session:** `AuthContext`, `useGuestMode`, `useTrainerVerificationGate`, `session/tokenStorage`, `session/clientSessionHeaders`, `security/*`.

**Cases handled:**
- Email/password sign-in with refresh-token rotation.
- Google / Apple SSO (Expo `expo-apple-authentication`, `expo-auth-session`).
- Magic-link request + verify.
- Signup with inline OTP (email or phone) + master-data driven category picker.
- Guest browsing (no token) for `book-lesson`, `about-us`, `contact-us`.
- Multi-device sessions: list, revoke, revoke-others, revoke-all.
- Biometric “App unlock” via `expo-local-authentication`.
- Account deletion (self).
- Session-expired toast + auto sign-out on 401 (with grace window for transient race conditions).

### 5.3 `calling/` & `meeting/`

WebRTC stack — native UI only (not Expo Go).

**Engine:** `NativeCallEngine.ts` + `CallContext.tsx`.
**Signaling:** `useCallSignaling.ts`, `iceServers.ts`, `meetingIceServers.ts`.
**Permissions / utilities:** `permissions.ts`, `nativeCallAvailability.ts`, `featureFlag.ts`, `meetingReportApi.ts`, `postSessionApi.ts`, `sessionExtensionApi.ts`.
**Hooks:** `useClipSync`, `useDrawingSync`, `useInstantLessonRecording`, `useLessonCountdown`, `useLessonTimer`, `useMeetingChromeInsets`, `useMeetingLayout`, `useMeetingScreenshot`, `useSessionExtensionFlow`, `useSessionPresence`, `useVideoPipLayout`.
**Screens (`meeting/screens/` & `calling/screens/`):** `MeetingRouter`, `NativeCallRequiredScreen`, `NativeMeetingScreen`, `PrecallLobbyScreen`.

**Components:** `ActionButtons`, `CallRejoinBanner`, `ClipMiniPip`, `ClipPickerModal`, `ClipPlaybackControls`, `ClipPlayer`, `ClipZoomControls`, `ConnectionQualityPill`, `DraggableVideoPip`, `DrawingOverlay`, `DualLiveStage`, `LockedDualClipStage`, `MeetingAnnotationToolbar`, `MeetingClipToolbar`, `MeetingJoinBanner`, `MeetingLiveStage`, `MeetingMiniPip`, `PeerJoinedModal`, `PortraitCallChrome`, `PortraitCallOverlay`, `RatingsModal`, `RecordingBar`, `ScreenshotCompositeHost`, `SessionExtensionModal`, `SessionGamePlanModal`, `SessionRecapSheet`, `SessionScreenshotDetailsModal`, `SessionScreenshotSheet`, `SessionTimeWarningModal`, `TimeRemaining`, `TrainerExtensionRequestModal`, `UnlockedDualClipStage`, `UserBox`.

**Cases handled:**
- Pre-call lobby (camera/mic test + connectivity).
- ICE server retrieval per booking; PeerJS signaling fallback.
- Lesson timer with warnings, end, extension, pause/resume.
- Mid-call paid extension request → trainer accept → Stripe pay → applied.
- In-call screenshot composite + drawing overlay + clip play + zoom/pan + dual stage + clip lock.
- Recording (instant lesson) with `useInstantLessonRecording`.
- Connection quality pill + automatic re-join banner.
- Rating & game-plan + session recap after the call.
- Native-only enforcement screen (`NativeCallRequiredScreen`) when running under Expo Go.

### 5.4 `instant-lesson/`

Files: `InstantLessonContext`, `InstantLessonBookingWizardModal`, `InstantLessonTraineeModal`, `InstantLessonTrainerModal`, `InstantLessonStatusBanner`, `InstantLessonCallKeepBridge`, `TrainerOnlinePresenceBridge`, `instantLessonBridge`, `instantLessonCallKeep`, `instantLessonClipsApi`, `instantLessonIncomingNotifications`, `instantLessonPendingAction`, `instantLessonSocketEvents`, `confirmTrainerDecline`, `useInstantLessonRingtone`, `useNativeIncomingCallUi`.

Plus `booking-wizard/` (multi-step wizard) and `components/` (`InstantLessonIncomingCallOverlay`).

**Cases handled:**
- Trainee picks trainer → checks eligibility → idempotent `POST /trainee/book-instant-meeting` with `Idempotency-Key` header.
- Trainer receives socket `INSTANT_LESSON_REQUEST` → native CallKeep incoming UI + ringtone.
- Accept → both navigate to `Meeting`; decline / cancel / expire → toast.
- Trainee selects clips during instant flow (`instantLessonClipsApi`).
- Status banner persists between modal dismissals.
- Pending-action store survives app kill (auto-resumes on next open).

### 5.5 `chats/`

**Screens:** `ChatsScreen` (list), `ChatRoomScreen` (1:1 + group), `ArchivedChatsScreen`.
**Crypto:** `chatEncryption.ts` (NaCl box), `chatKeysApi.ts` (publish + fetch public keys).
**Hooks:** `useChatE2E`, `useChatRoomChrome`.
**Lib:** `chatDateUtils`, `chatMediaUpload`, `chatMediaUtils`, `chatSearchUtils`, `offlineChatQueue`, `openChatTab`.
**Components:** day separators, media viewer/preview, disappearing messages, forward picker, global search results, group members, message actions sheet, pinned banner, scheduled messages composer/sheet, trainer-nudge picker.
**API:** `chatActionsApi` (group ops, scheduling, reactions, pinning, search, etc.).

**Cases handled:**
- 1:1 and group conversations; group invites + accept/decline.
- E2E (per-user Curve25519); offline queue for sends made when disconnected.
- Disappearing TTL, read-receipts toggle, mute, archive, delete, clear.
- Reactions, pin/unpin, edit, delete, forward, search globally.
- Voice-message transcription via socket event `CHAT_TRANSCRIPT_READY`.
- Scheduled messages (server-side cron dispatches).
- Trainer nudge sheet for trainer-initiated re-engagement (mirrors backend `/trainer/trainee-nudge`).

### 5.6 `wallet/`

**Screens:** `WalletScreen`, `WalletHomeScreen`, `WalletActivityScreen`, `WalletTopUpScreen`, `AutoTopUpScreen`, `SavedPaymentMethodsScreen`, `TrainerEarningsScreen`, `WalletSecurityScreen`.

**Components:** `TrainerWalletHome`, `TrainerEarningsPanel`, `EarningsTrendsCard`.

**Other:** `walletApi.ts`, `lib/` (utilities), `navigation/`, `security/` (PIN), `hooks/`.

**Cases handled:**
- Top-up via PaymentSheet (idempotent intent creation + confirm).
- Wallet PIN set / verify / forgot (rate-limited).
- Payout preference (`PUT /wallet/payout-preference`) + withdraw request (idempotent).
- Trainer earnings (pulse + series + CSV export deep link).
- Auto-top-up management.
- Saved payment methods.

### 5.7 `sessions/`, `schedule/`, `bookings/`, `scheduled-booking/`

- `sessions/screens/UpcomingSessionsScreen.tsx` + `sessions/components/{BookingDetailsModal, PostLessonConcernBanner, SessionsCalendar, SessionCountdownText, postLessonConcernDismissStore}`.
- `sessions/SessionActionModal.tsx`, `sessions/SessionBookingContext.tsx`, `sessions/SessionLifecycleBridge.tsx` — booking lifecycle + cancel/reschedule.
- `schedule/screens/ScheduleScreen.tsx` — trainer/trainee combined calendar.
- `sessions/SessionBookingContext.tsx` + `SessionActionModal.tsx` — trainer scheduled booking popup (instant excluded).
- `scheduled-booking/` — Wizard for scheduling lessons:
  - `ScheduledBookingWizardModal.tsx` + `useScheduledBookingWizard.ts` + `steps/` + `constants.ts` + `scheduledBookingApi.ts` + `timeSlotUtils.ts` + `trainerUtils.ts`.

**Cases handled:**
- Discover trainer → pick slot → confirm pricing/promo → idempotent `POST /trainee/book-session`.
- Post-lesson concern banner with dismiss persistence.
- Sessions calendar with trainer + trainee parity.
- Trainer-side: see upcoming bookings, join calls.

### 5.8 `clips/`

`api/clipsApi.ts`, `components/LibrarySubmissionSheet.tsx`. The general clips library + locker is shown via the dashboard `ClipsScreen` + Shell `clips` surface.

### 5.9 `notifications/`

`NotificationContext.tsx`, `NotificationToast.tsx`, `PushNotificationBridge.tsx`, `pushTokens.ts`, `api/`, `components/`, `screens/` (preferences, list).

**Cases handled:**
- Register expo push token on login; unregister on logout/device change.
- Foreground toast for socket-pushed notifications.
- Mute, quiet hours, per-channel preferences synced with backend.
- Deep-link from notification taps into chat / session / wallet surfaces.

### 5.10 `verification/`, `onboarding/`, `trainer-profile/`

- `verification/` — KYC + face liveness flow. Screens, hooks (`useTrainerVerificationGate`), `verificationApi.ts`, `verificationGateCache.ts`, grace-period banner, account-rejected screen.
- `onboarding/` — coach marks + walkthrough (`OnboardingWalkthrough.tsx`, `coachMarks/`, `profileCompletion.ts`).
- `trainer-profile/` — required setup before trainers can be discoverable: `components/`, `lib/trainerProfileSetup`, `screens/`, `types/`.

**Cases handled:**
- New trainer redirected to profile-setup navigator until profile is complete.
- Existing trainers in grace period see banner with countdown; once required, they’re routed into `OnboardingNavigator` for verification.
- Rejected accounts get `AccountRejectedScreen` with reapply.

### 5.11 `socket/`, `system-states/`, `support/`, `friends/`, `ai/`, `webrtc/`, `students/`, `bookexpert/`

- `socket/SocketContext.tsx`, `SocketQueryInvalidationBridge.tsx`, `useOnlinePresence.ts` — connection lifecycle + listen → React Query invalidation.
- `system-states/` — Maintenance / forced-update / region-blocked / offline screens, driven by API response codes (`useSystemStateFromError`) and `setMaintenanceMode` action.
- `support/SupportChatScreen.tsx` — live support shim over `/chat`.
- `friends/` — friend graph UI (requests, accept, block).
- `ai/` — AI helper surfaces (recommendations, smart schedule, smart search).
- `webrtc/` — RTC helpers (codecs, stats).
- `students/screens/StudentsScreen.tsx` — trainer-only “my trainees”.
- `bookexpert/` — discovery/booking entry for trainees.

### 5.12 `dev/`

`DesignSystemScreen.tsx` — internal screen for inspecting the design system (gated to dev builds).

### 5.13 `profile/`, `settings/`

- `profile/screens/` — public/own profile views.
- `settings/screens/` + `settings/api/` + `settings/hooks/` — notifications prefs, privacy, language, biometric, data export, two-factor, blocked users.

---

## 6. State Management (`src/store/`)

| Slice | What it stores |
|-------|----------------|
| `authSlice` | `status: "loading" \| "signedOut" \| "signedIn"`, `user`, `accountType`. Thunks: `hydrateAuth`, `signInThunk`, `completeSessionFromTokens`, `signOutThunk`, `refreshUserThunk`, `clearSessionLocalThunk`. |
| `socketSlice` | `isConnected`, last connect/disconnect timestamps. |
| `systemSlice` | Maintenance mode, region blocking, forced upgrade. |
| `uiSlice` | Global loader visibility + message. |
| `sessionBookingSlice` | `activeSession` + `pendingSessions` (booking-in-progress objects — non-serializable allowed). |
| `notificationsSlice` | Unread count + toast queue. |
| `instantLessonSlice` | Trainer incoming + trainee outgoing instant-lesson state. |

**Cross-slice middleware:** `middleware/queryCacheListener.ts` reacts to certain actions to invalidate React Query keys.

**Actions barrel:** `actions/cacheInvalidation.ts` exposes named invalidation helpers used across features.

---

## 7. API Layer (`src/api/`)

- `client.ts` — Axios with:
  - Bearer token injection from `tokenStorage`.
  - `X-NQ-Session-Id` + browser-like + client-session headers.
  - Refresh-token retry on 401 (single attempt; opt-out via meta flags).
  - Network status reporter (`reportNetworkOk`, `reportNetworkError`).
  - Cert pinning gate.
  - Optional Expo native fetch adapter (`EXPO_PUBLIC_USE_EXPO_FETCH=1`).
  - Sign-out fan-out via `emitSessionExpired` / `emitUnauthorized`.
- `apiContract.ts` — derives `API_OPERATIONS` from `src/config/apiRoutes.ts` and exports `buildOpenApiDocument`. Use `npm run sync:api-contract` to write an OpenAPI snapshot.
- `authRefresh.ts` — refresh-token logic with single-flight de-dup.
- `axiosAuthMeta.ts` — per-request flags (`_skipAuthSignOut`, `_authRetried`, soft 401 paths).
- `browserRequestHeaders.ts` — emulates desktop browser fingerprint (some WAFs block bare RN).
- `expoFetchForAxios.ts` — adapter for Expo native fetch.
- `httpDebug.ts` — dev request/response logger.

**Route names** live in `src/config/apiRoutes.ts` (mirrors the backend `routes.ts`). Always import from there — don’t hardcode paths.

---

## 8. Shared UI (`src/components/`)

- **UI primitives (`ui/`):** `Avatar`, `Banner`, `Button`, `Card`, `ContentSkeletons`, `Divider`, `EmptyState`, `FormField`, `Header`, `HelpBubble`, `ImageWithSkeleton`, `InlineSavedIndicator`, `LanguagePickerModal`, `ListRow`, `MorphRefreshHeader`, `PasswordVisibilityToggle`, `Pill`, `PresenceDot`, `Screen`, `ScreenContainer`, `SectionHeader`, `Sheet`, `Skeleton`, `Stack`, `TextField`, `TimeZoneSearchModal`, `VerifiedBadge`.
- **Brand (`brand/`):** `NetqwixLogo`, `NetqwixMark`, `BrandedSessionLoader`, `LoaderProvider`, `NetQwixLoader`, `loaderTips/`.
- **Payments:** `PlatformPayButtonRow`.
- **System banners:** `NetworkStatusBanner`.

**Theme:** `src/theme/` exposes `useThemeColors`, design tokens, dark/light support.

**i18n:** `src/i18n/` (init, language switch, `applyLanguageFromUser`).

---

## 9. Real-time Wiring (Socket.IO)

Connection lives in `src/features/socket/SocketContext.tsx`. Authentication uses the access token from `tokenStorage`. The socket survives auth refresh.

**Bridges (auto-mounted by `AppRoot`):**
- `SocketQueryInvalidationBridge` — invalidates React Query keys when relevant events fire.
- `InstantLessonCallKeepBridge` + `TrainerOnlinePresenceBridge` — incoming-call UI and trainer presence sync.
- `PushNotificationBridge` — expo push token registration / token rotation.
- `SessionLifecycleBridge` — session start/end transitions.

**Events** mirror `EVENTS` in the backend (`nq-backend-main/src/config/constance.ts`). See `instantLessonSocketEvents.ts`, `useCallSignaling.ts`, `callEvents.ts`, `clipEvents.ts`, the chat hook `useChatE2E`, etc.

---

## 10. Cases Handled (Cross-cutting)

- **Cold start:** splash + `hydrateAuth` thunk → `GET /user/me` → restore session or go to `LoginScreen`.
- **Guest browse:** signed-out users still see `MainTabs` with `book-lesson`, `about-us`, `contact-us` accessible; protected tabs show `GuestTabGateScreen`.
- **Trainer setup gating:** new trainer → `TrainerProfileSetupNavigator`; existing trainer in grace → banner; required → `OnboardingNavigator` for verification.
- **Rejected accounts:** dedicated screen with reapply path (`/clips/account/reapply`).
- **Network:** banner + retries + offline chat queue + status reporter.
- **Maintenance / system states:** API maintenance response or 5xx triggers `SystemStateScreen` modal.
- **Background → foreground:** session refresh, push token re-registration, chat reconnect.
- **Push notifications:** Expo push token registered on auth; tapped notifications deep-link into chat / session / wallet.
- **Idempotency:** all booking-related mutations include `Idempotency-Key` header (UUID).
- **Refresh tokens:** single-flight refresh on 401; if refresh fails, sign-out unless the path is whitelisted as a soft 401.
- **App unlock (biometric):** `AppUnlockGate` blocks signed-in shell until biometric/PIN passes (only when enabled in settings).
- **Cert pinning:** `assertCertificatePinningAllowed` aborts requests if pinning is unavailable on the OS version.
- **Deep links / NetQwix dev client:** dev URL printer (`npm run print:expo-url`) for in-app dev launcher.
- **E2E chat:** auto-publishes my Curve25519 public key on login (`registerMyChatPublicKey`).
- **Instant lesson reliability:** pending action store, ringtone, CallKeep, socket fallback, expiry recovery on the server.
- **Paid extension:** trainee quote → request → trainer accept → Stripe pay → extension applied (sockets keep both sides in sync).

---

## 11. Environment & Build

```bash
npm install
cp .env.example .env   # set EXPO_PUBLIC_API_BASE_URL
npm start              # dev client (NetQwix dev IPA / APK)
npm run start:go       # Expo Go (no native video)
npm run start:tunnel   # tunnel mode for non-LAN devices
npm run ios            # build + install simulator/device
npm run android        # Android equivalent

# EAS builds
npm run build:ios          # production iOS via EAS
npm run build:android      # production Android via EAS
npm run build:dev          # iOS development build via EAS
npm run submit:ios         # submit to App Store
npm run deploy:ios         # build + auto-submit

# Misc
npm run print:expo-url     # print LAN URL for the dev client
npm run sync:api-contract  # regenerate OpenAPI contract from apiRoutes.ts
```

**Native modules requiring a dev build:** `react-native-webrtc`, `react-native-callkeep`, `react-native-incall-manager`, `react-native-permissions`, `@shopify/react-native-skia`, `@stripe/stripe-react-native`.

**EAS config:** `eas.json` (production / development profiles).
**App config:** `app.json` (splash, native names, plugins for CallKeep + WebRTC).

---

## 12. How to Extend (Convention)

1. **New screen** → add under `src/features/<area>/screens/`, register route in the appropriate navigator (`HomeStackParamList` etc.) and add types.
2. **New API call** → add the path constant to `src/config/apiRoutes.ts`, write a function in `src/features/<area>/api/`, import `apiClient`. Use `getApiErrorMessage` for user-facing error strings.
3. **New socket event** → mirror the backend `EVENTS.*` name and add a listener in `SocketContext` or a feature bridge; trigger React Query invalidation if applicable.
4. **New Redux slice** → add to `store/slices/`, register in `store/store.ts`, export selectors via `store/selectors.ts`.
5. **New shell/dashboard surface** → add to `dashboardRoutes.ts` (feature) or `shellSurfaces.ts` (utility) with allowed roles and web parity context; wire the matching screen.
6. **Idempotent mutation** → generate a UUID, send via `Idempotency-Key`, and include retries safely.
7. **Translations** → add keys under `src/i18n/<lang>.json`; use `i18n.t("…")`.
8. **Always update this `PROJECT_DOCUMENTATION.md`** when adding/renaming features.

---

## 13. Useful Cross-references

- Backend module map → `nq-backend-main/PROJECT_DOCUMENTATION.md`.
- Admin portal → `nq-admin-frontend/PROJECT_DOCUMENTATION.md`.
- API contract canonical source → `src/api/apiContract.ts` + `src/config/apiRoutes.ts`.
- Web parity for surfaces → `nq-frontend-main/app/config/routes.config.js`.
