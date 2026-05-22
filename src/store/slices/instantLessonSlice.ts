import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { TraineeBooking, TrainerIncoming } from "../../features/instant-lesson/types";

type InstantLessonState = {
  trainerIncoming: TrainerIncoming | null;
  traineeBooking: TraineeBooking | null;
};

const initialState: InstantLessonState = {
  trainerIncoming: null,
  traineeBooking: null,
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
  },
});

export const {
  setTrainerIncoming,
  setTraineeBooking,
  patchTrainerIncoming,
  patchTraineeBooking,
} = instantLessonSlice.actions;
export default instantLessonSlice.reducer;
