import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { TraineeBooking, TrainerIncoming } from "../../features/instant-lesson/types";

type InstantLessonState = {
  trainerIncoming: TrainerIncoming | null;
  traineeBooking: TraineeBooking | null;
  /** Trainer declined/dismissed — ignore duplicate INSTANT_LESSON_REQUEST for same lesson */
  dismissedLessonIds: string[];
};

const initialState: InstantLessonState = {
  trainerIncoming: null,
  traineeBooking: null,
  dismissedLessonIds: [],
};

const instantLessonSlice = createSlice({
  name: "instantLesson",
  initialState,
  reducers: {
    setTrainerIncoming(state, action: PayloadAction<TrainerIncoming | null>) {
      state.trainerIncoming = action.payload;
    },
    setTraineeBooking(state, action: PayloadAction<TraineeBooking | null>) {
      state.traineeBooking = action.payload;
    },
    patchTrainerIncoming(state, action: PayloadAction<Partial<TrainerIncoming>>) {
      if (!state.trainerIncoming) return;
      state.trainerIncoming = { ...state.trainerIncoming, ...action.payload };
    },
    patchTraineeBooking(state, action: PayloadAction<Partial<TraineeBooking>>) {
      if (!state.traineeBooking) return;
      state.traineeBooking = { ...state.traineeBooking, ...action.payload };
    },
    markDismissedLessonId(state, action: PayloadAction<string>) {
      const id = action.payload;
      if (!id || state.dismissedLessonIds.includes(id)) return;
      state.dismissedLessonIds.push(id);
      if (state.dismissedLessonIds.length > 30) {
        state.dismissedLessonIds = state.dismissedLessonIds.slice(-30);
      }
    },
  },
});

export const {
  setTrainerIncoming,
  setTraineeBooking,
  patchTrainerIncoming,
  patchTraineeBooking,
  markDismissedLessonId,
} = instantLessonSlice.actions;
export default instantLessonSlice.reducer;
