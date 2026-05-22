import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type UiState = {
  loaderVisible: boolean;
  loaderMessage: string;
  loaderPending: boolean;
};

const initialState: UiState = {
  loaderVisible: false,
  loaderMessage: "Loading",
  loaderPending: false,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setLoaderMessage(state, action: PayloadAction<string>) {
      state.loaderMessage = action.payload;
    },
    setLoaderPending(state, action: PayloadAction<boolean>) {
      state.loaderPending = action.payload;
    },
    setLoaderVisible(state, action: PayloadAction<boolean>) {
      state.loaderVisible = action.payload;
    },
  },
});

export const { setLoaderMessage, setLoaderPending, setLoaderVisible } = uiSlice.actions;
export default uiSlice.reducer;
