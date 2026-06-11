/**
 * navMatrix
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for every navigable destination in the mobile app.
 * Each entry declares which surfaces (tabs, drawer, More menu) it should
 * appear on, and what its single canonical target is.
 *
 * Why: before this matrix lived, two different labels ("Instant booking"
 * appearing in the drawer AND in More) pointed at two different screens,
 * and several menu items led to `null` because their DashboardFeature
 * cases were never wired. Routing every menu surface through this list
 * makes those bugs structurally impossible — a target is declared once,
 * surfaces opt-in.
 */

import type { Ionicons } from "@expo/vector-icons";
import { AccountType, type AccountTypeValue } from "../constants/accountType";
import type { DashboardRouteId } from "../features/dashboard/config/dashboardRoutes";
import type { ShellSurfaceRouteId, MainTabParamList } from "./types";

export type NavTarget =
  /** Bottom-tab destination. */
  | { kind: "tab"; tab: keyof MainTabParamList }
  /** DashboardFeature surface inside the Home stack. */
  | { kind: "feature"; featureId: DashboardRouteId }
  /** ShellSurface inside the Home stack. */
  | { kind: "shell"; surfaceId: ShellSurfaceRouteId };

export type NavMatrixEntry = {
  /** Stable identifier — also used as the React key. */
  id: string;
  /** Display label across every surface. */
  label: string;
  /** Ionicons glyph name. */
  icon: keyof typeof Ionicons.glyphMap;
  /** Canonical destination. Every surface routes to the same place. */
  target: NavTarget;
  /** Which menu surfaces should render this entry. */
  surfaces: ReadonlyArray<"drawer" | "more">;
  /** Optional grouping inside More — `dashboard` (top section) or `tools`
   *  (bottom section). Drawer ignores this. */
  group?: "dashboard" | "tools";
  /** Role gating. Defaults to all roles. */
  roles?: ReadonlyArray<AccountTypeValue>;
  /** Drawer-only role gating (e.g. trainer-only drawer items). */
  drawerRoles?: ReadonlyArray<AccountTypeValue>;
};

/**
 * The full menu matrix. ORDER MATTERS — surfaces render in declaration order
 * so updates here flow uniformly.
 *
 * Routing rules baked in (Phase 5 decisions):
 *   • Instant booking → ONE canonical destination (`DashboardFeature`).
 *   • Settings → ONLY the More header gear; not duplicated in Tools.
 *   • Trainer schedule → renamed "Manage availability", lives under Tools only
 *     (the Schedule bottom tab shows booked sessions; this edits weekly slots).
 *   • Schedule / Chats / Home aren't in the matrix — they live as bottom tabs.
 *   • `meeting-room` is intentionally removed (the Meeting route is full-screen
 *     and only reachable through the booking flow, never as a menu item).
 */
export const NAV_MATRIX: readonly NavMatrixEntry[] = [
  {
    id: "my-locker",
    label: "damdam",
    icon: "home-outline",
    target: { kind: "tab", tab: "Home" },
    surfaces: ["drawer"],
  },
  {
    id: "sessions-trainee",
    label: "Sessions",
    icon: "time-outline",
    target: { kind: "tab", tab: "Schedule" },
    surfaces: ["drawer"],
    roles: [AccountType.TRAINEE],
  },
  {
    id: "schedule-trainer",
    label: "Sessions",
    icon: "time-outline",
    target: { kind: "tab", tab: "Schedule" },
    surfaces: ["drawer"],
    roles: [AccountType.TRAINER],
  },
  {
    id: "instant-booking",
    label: "Instant Booking",
    icon: "flash-outline",
    target: { kind: "feature", featureId: "instant-booking" },
    surfaces: ["more"],
    group: "dashboard",
    roles: [AccountType.TRAINEE],
  },
  {
    id: "book-lesson",
    label: "Book Expert",
    icon: "book-outline",
    target: { kind: "feature", featureId: "book-lesson" },
    surfaces: ["drawer", "more"],
    group: "dashboard",
    roles: [AccountType.TRAINEE],
  },
  {
    id: "students",
    label: "My Trainees",
    icon: "school-outline",
    target: { kind: "feature", featureId: "students" },
    surfaces: ["more"],
    group: "dashboard",
    roles: [AccountType.TRAINER],
  },
  {
    id: "upcoming-sessions",
    label: "Upcoming Sessions",
    icon: "time-outline",
    target: { kind: "feature", featureId: "upcoming-sessions" },
    surfaces: ["drawer", "more"],
    group: "dashboard",
    drawerRoles: [AccountType.TRAINER],
  },
  {
    id: "friends",
    label: "Friends",
    icon: "person-add-outline",
    target: { kind: "feature", featureId: "friends" },
    surfaces: ["drawer", "more"],
    group: "dashboard",
  },
  {
    id: "my-community",
    label: "My Community",
    icon: "people-outline",
    target: { kind: "feature", featureId: "my-community" },
    surfaces: ["drawer", "more"],
    group: "dashboard",
  },
  {
    id: "clips",
    label: "Clips",
    icon: "film-outline",
    target: { kind: "shell", surfaceId: "clips" },
    surfaces: ["drawer", "more"],
    group: "tools",
  },
  {
    id: "clipSubmissions",
    label: "Library Submissions",
    icon: "library-outline",
    target: { kind: "shell", surfaceId: "clipSubmissions" },
    surfaces: ["more"],
    group: "tools",
  },
  {
    id: "gamePlans",
    label: "Game Plans",
    icon: "clipboard-outline",
    target: { kind: "shell", surfaceId: "gamePlans" },
    surfaces: ["drawer", "more"],
    group: "tools",
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: "notifications-outline",
    target: { kind: "shell", surfaceId: "notifications" },
    surfaces: ["drawer", "more"],
    group: "tools",
  },
  {
    id: "wallet",
    label: "Wallet",
    icon: "wallet-outline",
    target: { kind: "shell", surfaceId: "wallet" },
    surfaces: ["drawer", "more"],
    group: "tools",
  },
  {
    id: "transactions",
    label: "Transactions",
    icon: "receipt-outline",
    target: { kind: "shell", surfaceId: "transactions" },
    surfaces: ["drawer", "more"],
    group: "tools",
    drawerRoles: [AccountType.TRAINER],
  },
  {
    id: "invite",
    label: "Invite Friends",
    icon: "mail-outline",
    target: { kind: "shell", surfaceId: "invite" },
    surfaces: ["drawer", "more"],
    group: "tools",
  },
  {
    id: "reportIssue",
    label: "Report An Issue",
    icon: "alert-circle-outline",
    target: { kind: "shell", surfaceId: "reportIssue" },
    surfaces: ["drawer", "more"],
    group: "tools",
  },
  {
    id: "contact-us",
    label: "Contact Us",
    icon: "mail-outline",
    target: { kind: "feature", featureId: "contact-us" },
    surfaces: ["drawer", "more"],
    group: "tools",
  },
  {
    id: "about-us",
    label: "About Us",
    icon: "information-circle-outline",
    target: { kind: "feature", featureId: "about-us" },
    surfaces: ["drawer", "more"],
    group: "tools",
  },
  {
    id: "settings",
    label: "Settings",
    icon: "settings-outline",
    target: { kind: "shell", surfaceId: "settings" },
    surfaces: ["drawer"],
    group: "tools",
  },

  // Blog section temporarily hidden
  // {
  //   id: "blogs",
  //   label: "Blog",
  //   icon: "newspaper-outline",
  //   target: { kind: "feature", featureId: "blogs" },
  //   surfaces: ["drawer", "more"],
  //   group: "tools",
  // },

  /** Items below are only reachable via the More menu or deep links. */
  {
    id: "practice-session",
    label: "Practice Session",
    icon: "fitness-outline",
    target: { kind: "feature", featureId: "practice-session" },
    surfaces: ["more"],
    group: "dashboard",
  },
  {
    id: "savedLessons",
    label: "Saved Lessons",
    icon: "bookmark-outline",
    target: { kind: "shell", surfaceId: "savedLessons" },
    surfaces: ["more"],
    group: "tools",
  },
  {
    id: "trainerSchedule",
    label: "Manage Availability",
    icon: "calendar-outline",
    target: { kind: "shell", surfaceId: "trainerSchedule" },
    surfaces: ["more"],
    group: "tools",
    roles: [AccountType.TRAINER],
  },
  {
    id: "editProfile",
    label: "Edit Profile",
    icon: "person-outline",
    target: { kind: "shell", surfaceId: "editProfile" },
    surfaces: [],
    group: "tools",
  },
];

/** Filter the matrix by surface + role + optional group. */
export function navMatrixFor(
  surface: "drawer" | "more",
  accountType: AccountTypeValue | string | null,
  group?: "dashboard" | "tools",
  options?: { guest?: boolean }
): NavMatrixEntry[] {
  if (options?.guest) {
    const guestIds = new Set([
      "my-locker",
      "book-lesson",
      "about-us",
      "contact-us",
      "settings",
    ]);
    return NAV_MATRIX.filter(
      (entry) => entry.surfaces.includes(surface) && guestIds.has(entry.id)
    );
  }
  return NAV_MATRIX.filter((entry) => {
    if (!entry.surfaces.includes(surface)) return false;
    if (group && entry.group !== group) return false;
    if (surface === "drawer" && entry.drawerRoles && entry.drawerRoles.length > 0) {
      if (!accountType) return false;
      if (!entry.drawerRoles.includes(accountType as AccountTypeValue)) return false;
    }
    if (entry.roles && entry.roles.length > 0) {
      if (!accountType) return false;
      if (!entry.roles.includes(accountType as AccountTypeValue)) return false;
    }
    return true;
  });
}

export function navEntryById(id: string): NavMatrixEntry | undefined {
  return NAV_MATRIX.find((e) => e.id === id);
}
