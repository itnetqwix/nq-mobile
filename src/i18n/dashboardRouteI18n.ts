import type { TFunction } from "i18next";
import type { DashboardRouteMeta } from "../features/dashboard/config/dashboardRoutes";

const ROUTE_KEYS: Record<string, string> = {
  "instant-booking": "nav.instantBooking",
  schedule: "nav.sessions",
  "book-lesson": "nav.bookLesson",
  chats: "nav.chats",
  "upcoming-sessions": "nav.upcomingSessions",
  "my-community": "nav.myCommunity",
  "contact-us": "nav.contactUs",
  "about-us": "nav.aboutUs",
  faq: "nav.faq",
  friends: "nav.friends",
  students: "nav.myTrainees",
  "meeting-room": "dashboard.meetingRoom",
  "practice-session": "dashboard.practiceSession",
};

export function localizedDashboardTitle(
  t: TFunction,
  meta: Pick<DashboardRouteMeta, "id" | "title">
): string {
  const key = ROUTE_KEYS[meta.id];
  return key ? t(key, { defaultValue: meta.title }) : meta.title;
}
