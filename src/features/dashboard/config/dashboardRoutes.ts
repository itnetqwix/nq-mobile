import { AccountType, type AccountTypeValue } from "../../../constants/accountType";

/**
 * Mirrors `nq-frontend-main/app/config/routes.config.js` → `ROUTES.DASHBOARD` children
 * (`pages/dashboard/*.jsx` + `routingPaths.dashboard*` in `app/common/constants.js`).
 * Shell-only flows (clips, game plans, saved lessons, notifications, settings, …) live in `shellSurfaces.ts`.
 * Mobile maps each entry to `MenuNavigator` → `DashboardFeatureScreen`.
 */
export const DASHBOARD_ROUTE_IDS = [
  "instant-booking",
  "schedule",
  "book-lesson",
  "chats",
  "upcoming-sessions",
  "my-community",
  "contact-us",
  "about-us",
  "faq",
  "blogs",
  "friends",
  "students",
  "meeting-room",
  "practice-session",
] as const;

export type DashboardRouteId = (typeof DASHBOARD_ROUTE_IDS)[number];

export type DashboardRouteMeta = {
  id: DashboardRouteId;
  title: string;
  subtitle: string;
  /** Web path for parity / future deep links */
  webPath: string;
  allowedRoles: readonly AccountTypeValue[];
};

export const DASHBOARD_ROUTES: readonly DashboardRouteMeta[] = [
  {
    id: "instant-booking",
    title: "Instant booking",
    subtitle:
      "(`NavHomePage`): instant lesson modal, active sessions, and quick bookings.",
    webPath: "/dashboard/home",
    allowedRoles: [AccountType.TRAINEE],
  },
  {
    id: "schedule",
    title: "Schedule",
    subtitle: "Calendar and availability like the web Schedule page.",
    webPath: "/dashboard/schedule",
    allowedRoles: [AccountType.TRAINER, AccountType.TRAINEE],
  },
  {
    id: "book-lesson",
    title: "Book expert",
    subtitle: "Find and book a trainer (Trainee).",
    webPath: "/dashboard/book-lesson",
    allowedRoles: [AccountType.TRAINEE],
  },
  {
    id: "chats",
    title: "Chats",
    subtitle: "Messages between trainers and trainees.",
    webPath: "/dashboard/chats",
    allowedRoles: [AccountType.TRAINER, AccountType.TRAINEE],
  },
  {
    id: "upcoming-sessions",
    title: "Upcoming sessions",
    subtitle: "Sessions you are booked into.",
    webPath: "/dashboard/upcoming-sessions",
    allowedRoles: [AccountType.TRAINER, AccountType.TRAINEE],
  },
  {
    id: "my-community",
    title: "My community",
    subtitle: "Community feed and connections.",
    webPath: "/dashboard/my-community",
    allowedRoles: [AccountType.TRAINER, AccountType.TRAINEE],
  },
  {
    id: "contact-us",
    title: "Contact us",
    subtitle: "Reach NetQwix support.",
    webPath: "/dashboard/contact-us",
    allowedRoles: [AccountType.TRAINER, AccountType.TRAINEE],
  },
  {
    id: "about-us",
    title: "About us",
    subtitle: "Product and company information.",
    webPath: "/dashboard/about-us",
    allowedRoles: [AccountType.TRAINER, AccountType.TRAINEE],
  },
  {
    id: "blogs",
    title: "Blog",
    subtitle: "Tips, product updates, and coaching stories from NetQwix.",
    webPath: "/blog",
    allowedRoles: [AccountType.TRAINER, AccountType.TRAINEE],
  },
  {
    id: "faq",
    title: "FAQ",
    subtitle: "Help, common questions, and contact support.",
    webPath: "/dashboard/faq",
    allowedRoles: [AccountType.TRAINER, AccountType.TRAINEE],
  },
  {
    id: "friends",
    title: "Friends",
    subtitle: "Friend list and requests.",
    webPath: "/dashboard/friends",
    allowedRoles: [AccountType.TRAINER, AccountType.TRAINEE],
  },
  {
    id: "students",
    title: "My trainees",
    subtitle: "Trainees you have had sessions with — not every user on the platform.",
    webPath: "/dashboard/student",
    allowedRoles: [AccountType.TRAINER],
  },
  {
    id: "meeting-room",
    title: "Meeting room",
    subtitle: "Join live video sessions.",
    webPath: "/dashboard/meeting-room",
    allowedRoles: [AccountType.TRAINER, AccountType.TRAINEE],
  },
  {
    id: "practice-session",
    title: "Practice session",
    subtitle: "Practice and drills flows from the web app.",
    webPath: "/dashboard/practice-session",
    allowedRoles: [AccountType.TRAINER, AccountType.TRAINEE],
  },
] as const;

export function dashboardRouteById(id: DashboardRouteId): DashboardRouteMeta | undefined {
  return DASHBOARD_ROUTES.find((r) => r.id === id);
}

export function dashboardRoutesForRoles(accountType: string | null): DashboardRouteMeta[] {
  if (!accountType) return [];
  const role = accountType as AccountTypeValue;
  return DASHBOARD_ROUTES.filter((r) => r.allowedRoles.includes(role));
}

/** Routes guests may open while browsing (no account). */
export const GUEST_BROWSE_ROUTE_IDS: readonly DashboardRouteId[] = [
  "book-lesson",
  "about-us",
  "contact-us",
  "blogs",
  "faq",
];

export function isDashboardRouteAllowed(
  id: DashboardRouteId,
  accountType: string | null,
  options?: { guest?: boolean }
): boolean {
  if (options?.guest) {
    return GUEST_BROWSE_ROUTE_IDS.includes(id);
  }
  if (!accountType) return false;
  const route = dashboardRouteById(id);
  if (!route) return false;
  return route.allowedRoles.includes(accountType as AccountTypeValue);
}

/** Primary shortcuts on the home hub (subset of full menu). */
export const HOME_QUICK_ROUTE_IDS: readonly DashboardRouteId[] = [
  "instant-booking",
  "schedule",
  "upcoming-sessions",
  "chats",
  "book-lesson",
  "students",
  "my-community",
] as const;
