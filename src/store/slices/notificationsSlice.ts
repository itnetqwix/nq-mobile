import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type IncomingNotification = {
  _id?: string;
  title: string;
  description?: string;
  createdAt?: string;
  isRead?: boolean;
  sender?: {
    _id?: string;
    name?: string;
    profile_picture?: string | null;
  };
  bookingInfo?: unknown;
  type?: string;
  isLocalOnly?: boolean;
};

type NotificationsState = {
  unreadCount: number;
  toastQueue: IncomingNotification[];
};

const initialState: NotificationsState = {
  unreadCount: 0,
  toastQueue: [],
};

const notificationsSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    setUnreadCount(state, action: PayloadAction<number>) {
      state.unreadCount = action.payload;
    },
    incrementUnreadCount(state) {
      state.unreadCount += 1;
    },
    setToastQueue(state, action: PayloadAction<IncomingNotification[]>) {
      state.toastQueue = action.payload;
    },
    pushToast(state, action: PayloadAction<IncomingNotification>) {
      const next = action.payload;
      const without = next._id
        ? state.toastQueue.filter((t) => t._id !== next._id)
        : state.toastQueue;
      state.toastQueue = [...without, next].slice(-3);
    },
    dismissToastById(state, action: PayloadAction<string | undefined>) {
      const id = action.payload;
      if (!id) {
        state.toastQueue = state.toastQueue.slice(1);
        return;
      }
      state.toastQueue = state.toastQueue.filter((t) => t._id !== id);
    },
    clearToasts(state) {
      state.toastQueue = [];
    },
  },
});

export const {
  setUnreadCount,
  incrementUnreadCount,
  setToastQueue,
  pushToast,
  dismissToastById,
  clearToasts,
} = notificationsSlice.actions;
export default notificationsSlice.reducer;
