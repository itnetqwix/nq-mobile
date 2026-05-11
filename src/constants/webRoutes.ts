/**
 * Paths aligned with `nq-frontend-main/app/common/constants.js` → `routingPaths`
 * and `app/config/routes.config.js`. Use for deep links, WebView targets, and docs.
 */
export const WebRoutes = {
  signIn: "/auth/signIn",
  signUp: "/auth/signUp",
  forgetPassword: "/auth/forgetPassword",
  dashboardHome: "/dashboard/home",
  dashboardSchedule: "/dashboard/schedule",
  dashboardBookLesson: "/dashboard/book-lesson",
  dashboardChats: "/dashboard/chats",
  dashboardUpcomingSessions: "/dashboard/upcoming-sessions",
  dashboardMyCommunity: "/dashboard/my-community",
  dashboardContactUs: "/dashboard/contact-us",
  dashboardAboutUs: "/dashboard/about-us",
  dashboardFriends: "/dashboard/friends",
  dashboardStudent: "/dashboard/student",
  dashboardMeetingRoom: "/dashboard/meeting-room",
  dashboardPracticeSession: "/dashboard/practice-session",
  meeting: "/meeting",
  messenger: "/messenger",
  /** Next.js App Route — ICE / TURN (`nq-frontend-main/app/api/peer/route.js`). Host is `WEB_APP_ORIGIN`. */
  nextApiPeer: "/api/peer",
} as const;
