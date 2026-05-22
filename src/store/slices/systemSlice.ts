import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type SystemState = {
  maintenanceMode: boolean;
};

const initialState: SystemState = {
  maintenanceMode: process.env.EXPO_PUBLIC_MAINTENANCE_MODE === "1",
};

const systemSlice = createSlice({
  name: "system",
  initialState,
  reducers: {
    setMaintenanceMode(state, action: PayloadAction<boolean>) {
      state.maintenanceMode = action.payload;
    },
  },
});

export const { setMaintenanceMode } = systemSlice.actions;
export default systemSlice.reducer;
