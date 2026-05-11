import { WebRoutes } from "../constants/webRoutes";

/**
 * High-level map from `nq-frontend-main/app/config/routes.config.js` (`ROUTES`) to the same
 * path strings we use for WebView / parity docs on mobile. Extend when new dashboard pages ship.
 */
export const WebAppRouteMap = {
  public: {
    landing: "/",
  },
  auth: {
    signIn: WebRoutes.signIn,
    signUp: WebRoutes.signUp,
    forgetPassword: WebRoutes.forgetPassword,
  },
  dashboard: {
    root: "/dashboard",
    home: WebRoutes.dashboardHome,
    schedule: WebRoutes.dashboardSchedule,
    bookLesson: WebRoutes.dashboardBookLesson,
    chats: WebRoutes.dashboardChats,
    upcomingSessions: WebRoutes.dashboardUpcomingSessions,
    myCommunity: WebRoutes.dashboardMyCommunity,
    contactUs: WebRoutes.dashboardContactUs,
    aboutUs: WebRoutes.dashboardAboutUs,
    friends: WebRoutes.dashboardFriends,
    student: WebRoutes.dashboardStudent,
    meetingRoom: WebRoutes.dashboardMeetingRoom,
    practiceSession: WebRoutes.dashboardPracticeSession,
  },
  meeting: WebRoutes.meeting,
  messenger: WebRoutes.messenger,
  nextApi: {
    peerIce: WebRoutes.nextApiPeer,
  },
} as const;
