import { configureStore } from "@reduxjs/toolkit";
import { queryCacheListener } from "./middleware/queryCacheListener";
import authReducer from "./slices/authSlice";
import socketReducer from "./slices/socketSlice";
import systemReducer from "./slices/systemSlice";
import uiReducer from "./slices/uiSlice";
import sessionBookingReducer from "./slices/sessionBookingSlice";
import notificationsReducer from "./slices/notificationsSlice";
import instantLessonReducer from "./slices/instantLessonSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    socket: socketReducer,
    system: systemReducer,
    ui: uiReducer,
    sessionBooking: sessionBookingReducer,
    notifications: notificationsReducer,
    instantLesson: instantLessonReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredPaths: ["sessionBooking.activeSession", "sessionBooking.pendingSessions"],
        ignoredActionPaths: [
          "sessionBooking/setActiveSession",
          "sessionBooking/setPendingSessions",
        ],
      },
    }).prepend(queryCacheListener.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
