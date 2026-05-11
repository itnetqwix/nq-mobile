/**
 * Where to port behaviour from `nq-frontend-main/app` into this repo (by domain).
 * Not imported at runtime — documentation for engineers.
 */
export const WEB_APP_SOURCE_CROSS_REFERENCE = {
  webrtcCalling: {
    webFiles: [
      "app/components/video/callEngine.js",
      "app/components/video/video.jsx",
      "app/components/portrait-calling/index.jsx",
      "app/features/meeting/MeetingPage.jsx",
      "app/api/peer/route.js",
    ],
    mobileHome: "src/features/webrtc/",
  },
  dashboardShell: {
    webFiles: ["app/components/dashboard/DashboardLayout", "containers/leftSidebar/index.jsx"],
    mobileHome: "src/navigation/MainTabs.tsx",
    registry: "src/features/dashboard/config/",
  },
  bookingsTrainee: {
    webFiles: [
      "nq-backend-main: src/modules/trainee/traineeRoute.ts (`/trainee/book-session`, `/trainee/book-instant-meeting`)",
    ],
    mobileHome: "src/config/apiRoutes.ts → API_ROUTES.trainee",
  },
  uploadsClips: {
    webFiles: ["containers/rightSidebar/fileSection.js", "app/components/videoupload/"],
    mobileHome: "src/config/apiRoutes.ts → API_ROUTES.common",
  },
  notifications: {
    webFiles: ["containers/leftSidebar/notificationSection", "app/components/notifications-service/"],
    mobileHome: "src/config/apiRoutes.ts → API_ROUTES.notifications",
  },
} as const;
