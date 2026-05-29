import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type SocketState = {
  isConnected: boolean;
  reconnectFailed: boolean;
};

const initialState: SocketState = {
  isConnected: false,
  reconnectFailed: false,
};

const socketSlice = createSlice({
  name: "socket",
  initialState,
  reducers: {
    setSocketConnected(state, action: PayloadAction<boolean>) {
      state.isConnected = action.payload;
      if (action.payload) {
        state.reconnectFailed = false;
      }
    },
    setSocketReconnectFailed(state, action: PayloadAction<boolean>) {
      state.reconnectFailed = action.payload;
      if (action.payload) {
        state.isConnected = false;
      }
    },
  },
});

export const { setSocketConnected, setSocketReconnectFailed } = socketSlice.actions;
export default socketSlice.reducer;
