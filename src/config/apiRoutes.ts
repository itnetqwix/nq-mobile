/**
 * REST paths for the NetQwix API. Mount prefixes match `nq-backend-main/routes.ts`:
 * `router.use("/user", userRoute)`, `/auth`, `/master`, `/trainer`, `/trainee`,
 * `/transaction`, `/common`, `/report`, `/admin`, `/notifications`.
 *
 * Source files (keep in sync when backend changes):
 * - `src/modules/auth/authRoutes.ts`
 * - `src/modules/user/userRoutes.ts`
 * - `src/modules/master/masterRoutes.ts`
 * - `src/modules/trainer/trainerRoutes.ts`
 * - `src/modules/trainee/traineeRoute.ts`
 * - `src/modules/transaction/transactionRoutes.ts`
 * - `src/modules/common/commonRoutes.ts`
 * - `src/modules/report/reportRoutes.ts`
 * - `src/modules/admin/adminRoutes.ts`
 * - `src/modules/notifications/notificationsRoutes.ts`
 */
export const API_ROUTES = {
  auth: {
    login: "/auth/login",
    signup: "/auth/signup",
    forgotPassword: "/auth/forgot-password",
    confirmResetPassword: "/auth/confirm-reset-password",
    verifyGoogleLogin: "/auth/verify-google-login",
  },
  user: {
    me: "/user/me",
    signUp: "/user/sign-up",
    scheduledMeetings: "/user/scheduled-meetings",
    updateBookedSession: (id: string) => `/user/update-booked-session/${id}` as const,
    shareClips: "/user/share-clips",
    inviteFriend: "/user/invite-friend",
    rating: "/user/rating",
    addTraineeClip: (id: string) => `/user/add-trainee-clip/${id}` as const,
    sendFriendRequest: "/user/send-friend-request",
    acceptFriendRequest: "/user/accept-friend-request",
    cancelFriendRequest: "/user/cancel-friend-request",
    rejectFriendRequest: "/user/reject-friend-request",
    friendRequests: "/user/friend-requests",
    sentFriendRequests: "/user/sent-friend-requests",
    friends: "/user/friends",
    removeFriend: "/user/remove-friend",
    updateAccountPrivacy: "/user/update-account-privacy",
    getAllTrainee: "/user/get-all-trainee",
    getAllUsers: "/user/get-all-users",
    getAllTrainer: "/user/get-all-trainer",
    updateTrainerCommission: "/user/update-trainer-commission",
    registerUserWithStripe: "/user/register-user-with-stripe",
    updateKycStatus: "/user/update-kyc-status",
    createVerificationSession: "/user/create-verification-session",
    bookingList: "/user/booking-list",
    bookingListById: "/user/booking-list-by-id",
    stripeAccountVerification: "/user/stripe-account-verification",
    checkStripeVerification: "/user/check-stripe-verification",
    updateRefundStatus: "/user/update-refund-status",
    writeUs: "/user/write-us",
    raiseConcern: "/user/raise-concern",
    getWriteUs: "/user/write-us",
    getRaiseConcern: "/user/raise-concern",
    updateContactUsStatus: "/user/update-contact-us-status",
    updateRaisedConcernTicket: "/user/update-raised-concern-ticket",
    allOnlineUser: "/user/all-online-user",
    updateMobileNumber: "/user/update-mobile-number",
    updateNotificationsSettings: "/user/update-notifications-settings",
    updateTrainerStatus: "/user/update-trainer-status",
    deleteUser: (id: string) => `/user/delete-user/${id}` as const,
    approveExpert: (id: string) => `/user/approve-expert/${id}` as const,
  },
  master: {
    masterData: "/master/master-data",
  },
  trainer: {
    topTrainers: "/trainer/top-trainers",
    updateSlots: "/trainer/update-slots",
    addSlot: "/trainer/add-slot",
    updateSlot: "/trainer/update-slot",
    deleteSlot: "/trainer/delete-slot",
    getAvailability: "/trainer/get-availability",
    getSlots: "/trainer/get-slots",
    getTrainers: "/trainer/get-trainers",
    getRecentTrainees: "/trainer/get-recent-trainees",
    getTraineeClips: "/trainer/get-trainee-clips",
    profile: "/trainer/profile",
    createMoneyRequest: "/trainer/create-money-request",
    getMoneyRequest: "/trainer/get-money-request",
  },
  trainee: {
    getTrainersWithSlots: "/trainee/get-trainers-with-slots",
    bookSession: "/trainee/book-session",
    bookInstantMeeting: "/trainee/book-instant-meeting",
    profile: "/trainee/profile",
    checkSlot: "/trainee/check-slot",
    recentTrainers: "/trainee/recent-trainers",
  },
  transaction: {
    createPaymentIntent: "/transaction/create-payment-intent",
    getPaymentIntent: "/transaction/get-payment-intent",
    createRefund: "/transaction/create-refund",
  },
  common: {
    extendSessionEndTime: "/common/extend-session-end-time",
    upload: "/common/upload",
    videoUploadUrl: "/common/video-upload-url",
    savedSessionsUploadUrl: "/common/saved-sessions-upload-url",
    getAllSavedSessions: "/common/get-all-saved-sessions",
    pdfUploadUrl: "/common/pdf-upload-url",
    getClips: "/common/get-clips",
    traineeClips: "/common/trainee-clips",
    deleteClip: (id: string) => `/common/delete-clip/${id}` as const,
    deleteSavedSession: (id: string) => `/common/delete-saved-session/${id}` as const,
    updateProfilePicture: "/common/update-profile-picture",
    generateThumbnail: "/common/generate-thumbnail",
    featuredContentUploadUrl: "/common/featured-content-upload-url",
  },
  report: {
    create: "/report",
    addImage: "/report/add-image",
    addSessionRecording: "/report/add-session-recording",
    removeImage: "/report/remove-image",
    cropImage: "/report/crop-image",
    get: "/report/get",
    getAll: "/report/get-all",
    deleteReport: (id: string) => `/report/delete-report/${id}` as const,
  },
  admin: {
    updateGlobalCommission: "/admin/update-global-commission",
    getGlobalCommission: "/admin/get-global-commission",
    callDiagnostics: "/admin/call-diagnostics",
    callQualitySummary: (sessionId: string) => `/admin/call-quality-summary/${sessionId}` as const,
    user360: (id: string) => `/admin/user-360/${id}` as const,
    userTimeline: (id: string) => `/admin/user-timeline/${id}` as const,
    clipPlayUrl: (clipId: string) => `/admin/clip-play-url/${clipId}` as const,
    userLessons: (id: string) => `/admin/user-lessons/${id}` as const,
    userReviews: (id: string) => `/admin/user-reviews/${id}` as const,
    userAssets: (id: string) => `/admin/user-assets/${id}` as const,
    deleteEntity: (entityType: string, entityId: string) =>
      `/admin/entity/${entityType}/${entityId}` as const,
    auditLogs: "/admin/audit-logs",
    dashboardMetrics: "/admin/dashboard-metrics",
    onlineUsers: "/admin/online-users",
  },
  notifications: {
    list: "/notifications",
    getPublicKey: "/notifications/get-public-key",
    subscription: "/notifications/subscription",
    update: "/notifications/update",
    /** Mobile-only: register/unregister device push tokens. The backend will
     *  add these endpoints; until they exist the client logs and falls back. */
    registerPushToken: "/notifications/register-push-token",
    unregisterPushToken: (deviceId: string) =>
      `/notifications/unregister-push-token/${encodeURIComponent(deviceId)}` as const,
  },
  chat: {
    conversations: "/common/chat-conversations",
    messages: (conversationId: string) => `/common/chat-messages/${conversationId}` as const,
    send: "/common/chat-send",
    conversation: "/common/chat-conversation",
  },
} as const;
