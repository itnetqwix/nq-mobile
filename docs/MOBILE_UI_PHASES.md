# nq-mobile UI excellence — phased rollout

Mobile-only plan for responsive layout, loading states, and performance. Each phase is shippable independently.

**Status key:** ✅ implemented in code · ⚠️ partial · 📋 device QA pending

---

## Phase 1 — Foundation ✅

| Deliverable | Path | Status |
|-------------|------|--------|
| Breakpoints + live window metrics | `src/lib/layout/responsive.ts` | ✅ |
| Tab screen wrapper | `src/lib/layout/TabScreenShell.tsx` | ✅ |
| Unified loading API | `src/components/ui/ScreenLoadingState.tsx` | ✅ wired on legal, report issue, share clips |
| Content skeletons | `src/components/ui/ContentSkeletons.tsx` | ✅ |
| Theme breakpoints export | `src/theme/index.ts` | ✅ |

---

## Phase 2 — Tab screens + marketplace ✅

| Target | Status |
|--------|--------|
| `DashboardHomeScreen` — `TabScreenShell` + `TrainerHomeSkeleton` | ✅ |
| `ScheduleScreen` — `TabScreenShell` + `TrainerScheduleSkeleton` | ✅ |
| `WalletScreen` — `TabScreenShell` + `WalletBalanceSkeleton` | ✅ |
| `UpcomingSessionsScreen` — stack feature (not a main tab; morph + skeletons) | ⚠️ no `TabScreenShell` by design |
| `DiscoverHomeChrome` — `useScaledTypography` | ✅ |
| `OffersCarouselSkeleton` — `useContentWidthFraction(0.72)` | ✅ |

---

## Phase 3 — Secondary screens + refresh UX ✅

| Screen | Skeleton / UX | Status |
|--------|----------------|--------|
| `TrainerPromoCodesScreen` | `PromoRowSkeleton` | ✅ |
| `SavedPaymentMethodsScreen` | `PaymentMethodRowSkeleton` + morph | ✅ |
| `BlockedUsersScreen` | `ChatRowSkeleton` | ✅ |
| `LockerListShell` / clips | `ClipCardSkeleton` + morph | ✅ |
| `ChatRoomScreen` | `ChatMessageListSkeleton` | ✅ |
| `ChatsScreen` | Morph refresh | ✅ |
| `UpcomingSessionsScreen` | Morph refresh | ✅ |

---

## Phase 4 — Performance + polish ✅

| Item | Status |
|------|--------|
| `lib/lists/flatListPerf.ts` — defaults + row heights | ✅ |
| `ImageWithSkeleton` on hero / offers / banner carousels | ✅ |
| `React.memo` on `TrainerDashboardHub`, `SessionListSection` | ✅ |
| `useCompactA11yGuard` in `DiscoverHomeChrome` | ✅ |
| `useCombinedScroll` ref-backed handlers | ✅ |

---

## Phase 5 — App-wide morph refresh + list perf ✅

### Helpers

| Helper | Path |
|--------|------|
| Morph bundle | `lib/refresh/useMorphRefreshBundle.ts` |
| List wrapper | `components/ui/MorphRefreshScrollSurface.tsx` |
| Row heights | `lib/lists/flatListPerf.ts` |

### Morph refresh coverage

| Sector | Screens | Status |
|--------|---------|--------|
| **Home** | `DashboardHomeScreen`, `TraineeDiscoverDashboard` | ✅ |
| **Wallet** | `WalletScreen`, `WalletHomeScreen`, `TrainerWalletHome`, `WalletActivityScreen`, `SavedPaymentMethodsScreen`, `PointsActivityScreen` | ✅ |
| **Social** | `ChatsScreen`, `ArchivedChatsScreen`, `FriendsScreen`, `CommunityScreen`, `ShareClipsPanel` | ✅ |
| **Dashboard** | `TransactionsScreen`, `StudentsScreen`, `NotificationsScreen`, `LockerListShell`, `TrainerScheduleScreen`, `ReportIssueScreen`, `InstantBookingScreen` | ✅ |
| **Book** | `BookExpertScreen` | ✅ |
| **Schedule** | `ScheduleScreen`, `UpcomingSessionsScreen` | ✅ |
| **Auth** | `ActiveSessionsScreen` | ✅ |
| **Instant lesson** | `InstantLessonTraineeModal`, `WizardStepClips` (clip picker) | ✅ |
| **Shell** | `ScreenContainer` when `onRefresh` set | ✅ |

### FlatList `getItemLayout` coverage

| Screen | Layout helper | Status |
|--------|---------------|--------|
| Chats / archived | `chatListGetItemLayout` | ✅ |
| Saved payment methods | `paymentMethodGetItemLayout` | ✅ |
| Notifications | `notificationRowGetItemLayout` | ✅ |
| Transactions | `transactionRowGetItemLayout` | ✅ |
| Friends tabs | `friendRowGetItemLayout` | ✅ |
| Students | `studentRowGetItemLayout` | ✅ |
| Wallet activity | `walletLedgerRowGetItemLayout` | ✅ |
| Community | `communityRowGetItemLayout` | ✅ |
| Book Expert | `trainerBrowseRowGetItemLayout` | ✅ |
| Instant booking | `instantBookingRowGetItemLayout` | ✅ |
| Blocked users | `blockedUserRowGetItemLayout` | ✅ |

---

## Phase 6 — Splash, loaders & dark theme ✅ / ⚠️

| Area | Status |
|------|--------|
| `BrandBootScreen` — animated boot + tagline + dots | ✅ |
| `ScreenLoadingState` fullscreen fix | ✅ |
| Dark palette + `skeletonShimmer` + surface ladder | ✅ |
| Theme primitives (`Sheet`, `Banner`, `Avatar`, `ImageWithSkeleton`) | ✅ |
| `themedShadow()` | ✅ |
| Chat overlay hook `useChatOverlayStyles` | ✅ |
| Chat sheets themed (`ForwardPicker`, `Disappearing`, `Scheduled`, `GlobalSearch`, `MessageActions`) | ✅ |
| `ChatRoomScreen` + `ChatsScreen` presence / icon tokens | ✅ |
| `VerifyContactScreen` → `ScreenLoadingState` + themed brand strip | ✅ |
| Spinner → skeleton (`TrainerScheduleScreen`, `ActiveSessionsScreen`) | ✅ |
| **Remaining static `colors` imports** (calling overlays, push tokens, small banners) | ⚠️ incremental |
| **Chat micro-components** (`ChatMessageStatus`, `ChatMediaViewer`, policy banners) | ⚠️ low-traffic |
| **Calling / meeting island** (`meetingTheme.ts`) | ⚠️ intentional separate palette |

---

## Conventions

1. **Responsive:** Use `useWindowMetrics` / `useContentWidth` — not module-scope `Dimensions.get` (`FriendsScreen` migrated).
2. **Loading:** Content skeleton → `ScreenLoadingState` → inline `ActivityIndicator` (buttons/pagination only).
3. **Tab screens:** `TabScreenShell` on main tabs; settings/auth use `ScreenContainer`.
4. **Pull refresh:** `useMorphRefreshBundle` or `MorphRefreshScrollSurface`; chain tab scroll with `useCombinedScroll`.
5. **Lists:** `FLATLIST_PERF_DEFAULTS` + `getItemLayout` when row height is stable.
6. **Dark mode:** `useThemeColors()` / `useThemedStyles()` — never static `colors` in feature UI.

---

## Device QA checklist

Run on iOS + Android (light + dark) before release.

### Loading & splash
- [ ] Cold start — tagline, dot loader, smooth fade (no double flash)
- [ ] Legal doc — branded fullscreen loader, not spinner
- [ ] Report issue / share clips — skeleton first paint

### Morph refresh
- [ ] Home trainee + trainer pull — morph + tab bar hide
- [ ] Wallet, notifications, friends, transactions pull
- [ ] Active sessions, trainer schedule editor, instant booking pull
- [ ] Share clips tab pull inside friends

### Performance
- [ ] Chats 50+ rows — smooth scroll
- [ ] Book Expert / instant booking lists — no jank

### Dark theme
- [ ] Settings → Dark — sheets, banners, avatars, chat room
- [ ] Skeleton shimmer visible on dark lists
- [ ] Chat action sheet + attachment picker readable

### Accessibility
- [ ] iPhone SE + large Dynamic Type — marketplace headline doesn't clip
