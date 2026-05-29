import type { RootState } from "./store";

export const selectAuthStatus = (s: RootState) => s.auth.status;
export const selectAuthUser = (s: RootState) => s.auth.user;
export const selectAccountType = (s: RootState) => s.auth.accountType;
export const selectSocketConnected = (s: RootState) => s.socket.isConnected;
export const selectSocketReconnectFailed = (s: RootState) => s.socket.reconnectFailed;
export const selectMaintenanceMode = (s: RootState) => s.system.maintenanceMode;
export const selectLoaderVisible = (s: RootState) => s.ui.loaderVisible;
export const selectLoaderMessage = (s: RootState) => s.ui.loaderMessage;
export const selectActiveBookingSession = (s: RootState) => s.sessionBooking.activeSession;
export const selectPendingBookingSessions = (s: RootState) => s.sessionBooking.pendingSessions;
export const selectUnreadCount = (s: RootState) => s.notifications.unreadCount;
export const selectToastQueue = (s: RootState) => s.notifications.toastQueue;
export const selectTrainerIncoming = (s: RootState) => s.instantLesson.trainerIncoming;
export const selectTraineeBooking = (s: RootState) => s.instantLesson.traineeBooking;
export const selectDismissedInstantLessonIds = (s: RootState) =>
  s.instantLesson.dismissedLessonIds;
