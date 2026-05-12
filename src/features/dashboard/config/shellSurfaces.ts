import { AccountType, type AccountTypeValue } from "../../../constants/accountType";
import { WebRoutes } from "../../../constants/webRoutes";

/**
 * Surfaces driven from the web **left sidebar** (`containers/leftSidebar/index.jsx`):
 * uploads, invite friends, notifications, settings, transactions — plus `/meeting` and `/messenger`.
 * These are not separate `pages/dashboard/*` routes but the same product flows on mobile.
 */
export const UTILITY_SURFACE_IDS = [
  "uploads",
  "invite",
  "notifications",
  "settings",
  "transactions",
] as const;
export type UtilitySurfaceId = (typeof UTILITY_SURFACE_IDS)[number];

export type ShellSurfaceMeta = {
  id: UtilitySurfaceId | "meeting" | "messenger";
  title: string;
  subtitle: string;
  webContext: string;
  allowedRoles: readonly AccountTypeValue[];
};

export const SHELL_SURFACES: readonly ShellSurfaceMeta[] = [
  {
    id: "uploads",
    title: "My uploads",
    subtitle: "Clips and files from the web “My Uploads” / locker file panel.",
    webContext: "Left sidebar → My Uploads (`ToggleTab(\"file\")` → `FileSection`).",
    allowedRoles: [AccountType.TRAINER, AccountType.TRAINEE],
  },
  {
    id: "invite",
    title: "Invite friends",
    subtitle: "Email invitations — same `/user/invite-friend` flow as the web dashboard card.",
    webContext: "Dashboard home → Invite friends (`InviteFriendsCard`).",
    allowedRoles: [AccountType.TRAINER, AccountType.TRAINEE],
  },
  {
    id: "notifications",
    title: "Notifications",
    subtitle: "Alerts for bookings, messages, and system events.",
    webContext: "Left sidebar → Notifications (`ToggleTab(\"notification\")`).",
    allowedRoles: [AccountType.TRAINER, AccountType.TRAINEE],
  },
  {
    id: "settings",
    title: "Settings",
    subtitle: "Account, preferences, and app options.",
    webContext: "Left sidebar → Settings (`ToggleTab(\"setting\")`).",
    allowedRoles: [AccountType.TRAINER, AccountType.TRAINEE],
  },
  {
    id: "transactions",
    title: "Transactions",
    subtitle: "Payments and wallet activity.",
    webContext: "Left sidebar → Transactions (`ToggleTab(\"transaction\")`).",
    allowedRoles: [AccountType.TRAINER, AccountType.TRAINEE],
  },
  {
    id: "meeting",
    title: "Live meeting",
    subtitle: "Join the in-call experience (Agora / web `MeetingPage`).",
    webContext: `Full-screen route: ${WebRoutes.meeting}`,
    allowedRoles: [AccountType.TRAINER, AccountType.TRAINEE],
  },
  {
    id: "messenger",
    title: "Messenger",
    subtitle: "Dedicated messenger shell on the web; mobile maps to Chats + this entry.",
    webContext: WebRoutes.messenger,
    allowedRoles: [AccountType.TRAINER, AccountType.TRAINEE],
  },
] as const;

export function shellSurfacesForRoles(accountType: string | null): ShellSurfaceMeta[] {
  if (!accountType) return [];
  const role = accountType as AccountTypeValue;
  return SHELL_SURFACES.filter((s) => s.allowedRoles.includes(role));
}

export function shellSurfaceById(
  id: ShellSurfaceMeta["id"]
): ShellSurfaceMeta | undefined {
  return SHELL_SURFACES.find((s) => s.id === id);
}
