import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type SessionBookingState = {
  activeSession: Record<string, unknown> | null;
  pendingSessions: Record<string, unknown>[];
};

const initialState: SessionBookingState = {
  activeSession: null,
  pendingSessions: [],
};

const sessionBookingSlice = createSlice({
  name: "sessionBooking",
  initialState,
  reducers: {
    setActiveSession(state, action: PayloadAction<Record<string, unknown> | null>) {
      state.activeSession = action.payload;
    },
    setPendingSessions(state, action: PayloadAction<Record<string, unknown>[]>) {
      state.pendingSessions = action.payload;
    },
  },
});

export const { setActiveSession, setPendingSessions } = sessionBookingSlice.actions;
export default sessionBookingSlice.reducer;
