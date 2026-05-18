import { AccountType, type AccountTypeValue } from "../../../constants/accountType";
import { WebRoutes } from "../../../constants/webRoutes";

/**
 * Surfaces driven from the web **left sidebar** plus locker sub-areas:
 * clips, game plans, saved lessons, invite friends, notifications, settings, transactions —
 * plus `/meeting` and `/messenger`.
 */
export const UTILITY_SURFACE_IDS = [
  "clips",
  "gamePlans",
  "savedLessons",
  "invite",
  "notifications",
  "settings",
  "wallet",
  "transactions",
  "trainerSchedule",
  "editProfile",
  "reportIssue",
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
    id: "clips",
    title: "Clips",
    subtitle: "Locker videos grouped by category (and trainee clips for trainers).",
    webContext: "Left sidebar → My Uploads → My clips / Enthusiasts (`FileSection`).",
    allowedRoles: [AccountType.TRAINER, AccountType.TRAINEE],
  },
  {
    id: "gamePlans",
    title: "Game plans",
    subtitle: "Session reports and game plan PDFs from your locker.",
    webContext: "Locker library → Game plans (`POST /report/get-all`).",
    allowedRoles: [AccountType.TRAINER, AccountType.TRAINEE],
  },
  {
    id: "savedLessons",
    title: "Saved lessons",
    subtitle: "Recordings saved to your locker.",
    webContext: "Locker library → Saved lessons (`POST /common/get-all-saved-sessions`).",
    allowedRoles: [AccountType.TRAINER, AccountType.TRAINEE],
  },
  {
    id: "invite",
    title: "Invite friends",
    subtitle: "Email invitations.",
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
    id: "wallet",
    title: "Wallet",
    subtitle: "Balance, add funds, and payment activity.",
    webContext: "Mobile wallet hub (balance, top-up, ledger).",
    allowedRoles: [AccountType.TRAINER, AccountType.TRAINEE],
  },
  {
    id: "transactions",
    title: "Transactions",
    subtitle: "Booking payment history and receipts.",
    webContext: "Left sidebar → Transactions (`ToggleTab(\"transaction\")`).",
    allowedRoles: [AccountType.TRAINER, AccountType.TRAINEE],
  },
  {
    id: "trainerSchedule",
    title: "My availability",
    subtitle: "Weekly availability",
    webContext: "Left sidebar → Schedule Inventory (`POST /trainer/update-slots`).",
    allowedRoles: [AccountType.TRAINER],
  },
  {
    id: "editProfile",
    title: "Edit profile",
    subtitle: "Update your name, mobile, and other personal details.",
    webContext: "Web profile editor (`/trainee/profile` / `/trainer/profile`).",
    allowedRoles: [AccountType.TRAINER, AccountType.TRAINEE],
  },
  {
    id: "reportIssue",
    title: "Report an issue",
    subtitle:
      "Pick a session and report a technical issue or request a refund",
    webContext: "Web Contact Us → Report Technical / Refund (`POST /user/raise-concern`).",
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
