import type { TFunction } from "i18next";

/** Maps navMatrix entry id → i18n key under `nav.*` */
const NAV_I18N_KEYS: Record<string, string> = {
  "my-locker": "nav.dashboard",
  "sessions-trainee": "nav.sessions",
  "schedule-trainer": "nav.sessions",
  "instant-booking": "nav.instantBooking",
  "book-lesson": "nav.bookLesson",
  students: "nav.myTrainees",
  "upcoming-sessions": "nav.upcomingSessions",
  friends: "nav.friends",
  "my-community": "nav.myCommunity",
  clips: "nav.clips",
  gamePlans: "nav.gamePlans",
  notifications: "nav.notifications",
  wallet: "nav.wallet",
  transactions: "nav.transactions",
  invite: "nav.inviteFriends",
  reportIssue: "nav.reportIssue",
  "contact-us": "nav.contactUs",
  "about-us": "nav.aboutUs",
  settings: "nav.settings",
};

export function localizedNavLabel(t: TFunction, entry: { id: string; label: string }): string {
  const key = NAV_I18N_KEYS[entry.id];
  return key ? t(key, { defaultValue: entry.label }) : entry.label;
}
