/**
 * Central React Query keys — use these everywhere instead of inline string tuples.
 * Invalidate via `queryInvalidation.ts` or RTK `queryCacheListenerMiddleware`.
 */

export const queryKeys = {
  sessions: {
    all: ["sessions"] as const,
    list: (tab: string) => ["sessions", tab] as const,
    upcoming: ["sessions", "upcoming"] as const,
    completed: ["sessions", "completed"] as const,
    detail: (sessionId: string) => ["sessions", "detail", sessionId] as const,
    lookup: (lessonId: string) => ["sessionLookup", lessonId] as const,
    joinReadiness: (lessonId: string) => ["session", "join-readiness", lessonId] as const,
  },
  scheduledMeetings: ["scheduledMeetings"] as const,
  notifications: {
    all: ["notifications"] as const,
    inbox: ["notifications"] as const,
  },
  wallet: {
    all: ["wallet"] as const,
    balance: ["wallet", "balance"] as const,
    ledger: ["wallet", "ledger"] as const,
    config: ["wallet", "config"] as const,
    earnings: ["wallet", "earnings"] as const,
    stripeConnect: ["wallet", "stripeConnect"] as const,
  },
  friends: {
    all: ["friends"] as const,
    list: ["friends"] as const,
    requests: ["friendRequests"] as const,
    sentRequests: ["sentFriendRequests"] as const,
    forClipShare: ["friends", "forClipShare"] as const,
  },
  chats: {
    all: ["chat"] as const,
    conversations: ["conversations"] as const,
    messages: (chatId: string) => ["chatMessages", chatId] as const,
    archived: ["chat", "archived"] as const,
    groupMembers: (groupId: string, search?: string) =>
      search !== undefined
        ? (["groupMembers", groupId, search] as const)
        : (["groupMembers", groupId] as const),
    groupInvites: ["groupInvites"] as const,
  },
  presence: {
    onlineUsers: ["onlineUsers"] as const,
    bookExpertOnline: ["bookExpert", "online"] as const,
    communityAll: ["communityUsers"] as const,
    community: (search: string) => ["communityUsers", search] as const,
    recentTrainees: ["recentTrainees"] as const,
    recentTrainers: ["recentTrainers"] as const,
    personalizedFeed: (recentIds: readonly string[]) =>
      ["personalizedFeed", recentIds.join(",")] as const,
  },
  trainer: {
    myStats: ["trainer", "myStats"] as const,
    slots: ["trainerSlots"] as const,
    schedule: ["trainerSchedule"] as const,
    promoCodes: ["trainerPromoCodes"] as const,
    availabilityAll: ["trainerAvailability"] as const,
    availability: (trainerId: string) => ["trainerAvailability", trainerId] as const,
    profile: (id: string) => ["trainerProfile", id] as const,
    directory: (hash: string) => ["trainersDirectory", hash] as const,
    directorySearch: (search: string, filterHash: string) =>
      ["trainersDirectory", search, filterHash] as const,
  },
  instant: {
    eligibility: (trainerId: string, durationMinutes: number) =>
      ["instantEligibility", trainerId, durationMinutes] as const,
    wizardClips: ["instantBookingWizardClips"] as const,
    lessonClips: (lessonId: string) => ["instantLessonClips", lessonId] as const,
    lessonClipsAll: ["instantLessonClips"] as const,
  },
  scheduled: {
    checkSlot: (trainerId: string, bookedDateIso: string, traineeTz: string) =>
      ["scheduledCheckSlot", trainerId, bookedDateIso, traineeTz] as const,
  },
  master: {
    row: ["masterRow"] as const,
    signupRow: ["master", "row"] as const,
    sportCategories: ["sportCategories"] as const,
  },
  locker: {
    all: ["locker"] as const,
    myClips: ["locker", "myClips"] as const,
    sharedClips: ["locker", "sharedClips"] as const,
    shareInbox: ["locker", "shareInbox"] as const,
    libraryClips: ["locker", "libraryClips"] as const,
    savedSessions: ["locker", "savedSessions"] as const,
    reports: ["locker", "reports"] as const,
  },
  clips: {
    taxonomy: ["clips", "taxonomy"] as const,
  },
  storage: {
    all: ["storage"] as const,
    info: ["storage", "info"] as const,
  },
  user: {
    referrals: ["myReferrals"] as const,
  },
  points: {
    balance: ["pointsBalance"] as const,
    catalog: ["pointsCatalog"] as const,
    ledger: ["pointsLedger"] as const,
  },
  referral: {
    program: ["referralProgram"] as const,
    invites: ["referralInvites"] as const,
    checkoutPreview: (
      bookingType: string,
      amount: number,
      coupon: string,
      trainerId = ""
    ) => ["referralCheckoutPreview", bookingType, amount, coupon, trainerId] as const,
  },
  transactions: {
    bookingListById: ["transactions", "booking-list-by-id"] as const,
  },
  dashboard: {
    aiRecommendations: ["aiRecommendations"] as const,
  },
  ai: {
    reviewAnalysis: (trainerId: string) => ["ai", "reviewAnalysis", trainerId] as const,
    smartSchedule: (trainerId: string) => ["ai", "smartSchedule", trainerId] as const,
  },
  trainerRole: {
    dashboardSummary: ["trainer", "dashboardSummary"] as const,
    recentTraineeClips: ["trainer", "recentTraineeClips"] as const,
  },
  trainee: {
    favorites: ["trainee", "favoriteTrainers"] as const,
    guestSeededTrainers: ["trainee", "guestSeededTrainers"] as const,
  },
  content: {
    all: ["content"] as const,
    home: (guest: boolean) => ["content", "home", guest ? "guest" : "auth"] as const,
    cmsManifest: ["content", "cmsManifest"] as const,
    banners: ["content", "banners"] as const,
    tips: ["content", "tips"] as const,
    faq: ["content", "faq"] as const,
    legal: (slug: string) => ["content", "legal", slug] as const,
    blogs: (guest: boolean) => ["content", "blogs", guest ? "guest" : "auth"] as const,
    blogPost: (slug: string) => ["content", "blogPost", slug] as const,
  },
} as const;

/** Root prefixes for broad invalidation (e.g. after socket reconnect). */
export const queryKeyRoots = {
  sessions: queryKeys.sessions.all,
  wallet: queryKeys.wallet.all,
  friends: queryKeys.friends.all,
  chats: queryKeys.chats.all,
  locker: queryKeys.locker.all,
  storage: queryKeys.storage.all,
  presence: ["presence"] as const,
} as const;
