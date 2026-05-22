/**
 * Central React Query keys — use these everywhere instead of inline string tuples.
 */

export const queryKeys = {
  sessions: {
    all: ["sessions"] as const,
    list: (tab: string) => ["sessions", tab] as const,
    upcoming: ["sessions", "upcoming"] as const,
    completed: ["sessions", "completed"] as const,
    lookup: (lessonId: string) => ["sessionLookup", lessonId] as const,
  },
  scheduledMeetings: ["scheduledMeetings"] as const,
  notifications: {
    inbox: ["notifications"] as const,
  },
  wallet: {
    all: ["wallet"] as const,
    balance: ["wallet", "balance"] as const,
    ledger: ["wallet", "ledger"] as const,
    config: ["wallet", "config"] as const,
    earnings: ["wallet", "earnings"] as const,
  },
  friends: {
    all: ["friends"] as const,
    list: ["friends", "list"] as const,
    requests: ["friendRequests"] as const,
    sentRequests: ["sentFriendRequests"] as const,
    forClipShare: ["friends", "forClipShare"] as const,
  },
  chats: {
    conversations: ["conversations"] as const,
    messages: (chatId: string) => ["chatMessages", chatId] as const,
    archived: ["chat", "archived"] as const,
    groupMembers: (groupId: string) => ["groupMembers", groupId] as const,
    groupInvites: ["groupInvites"] as const,
  },
  presence: {
    onlineUsers: ["onlineUsers"] as const,
    bookExpertOnline: ["bookExpert", "online"] as const,
    communityAll: ["communityUsers"] as const,
    community: (search: string) => ["communityUsers", search] as const,
    recentTrainees: ["recentTrainees"] as const,
    recentTrainers: ["recentTrainers"] as const,
  },
  trainer: {
    slots: ["trainerSlots"] as const,
    schedule: ["trainerSchedule"] as const,
    /** Invalidates all per-trainer availability queries */
    availabilityAll: ["trainerAvailability"] as const,
    availability: (trainerId: string) => ["trainerAvailability", trainerId] as const,
    profile: (id: string) => ["trainerProfile", id] as const,
    directory: (hash: string) => ["trainersDirectory", hash] as const,
  },
  instant: {
    eligibility: (trainerId: string, durationMinutes: number) =>
      ["instantEligibility", trainerId, durationMinutes] as const,
    wizardClips: ["instantBookingWizardClips"] as const,
    lessonClips: (lessonId: string) => ["instantLessonClips", lessonId] as const,
  },
  scheduled: {
    checkSlot: (trainerId: string, bookedDateIso: string, traineeTz: string) =>
      ["scheduledCheckSlot", trainerId, bookedDateIso, traineeTz] as const,
  },
  master: {
    row: ["masterRow"] as const,
    legacy: ["master", "row"] as const,
  },
  dashboard: {
    aiRecommendations: ["aiRecommendations"] as const,
  },
} as const;
