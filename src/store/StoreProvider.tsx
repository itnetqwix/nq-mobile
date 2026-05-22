import React, { useEffect } from "react";
import { Provider } from "react-redux";
import { store } from "./store";
import { hydrateAuth } from "./slices/authSlice";
import { useAppDispatch } from "./hooks";
import { onUnauthorized } from "../lib/auth/sessionEvents";
import { signOutThunk } from "./slices/authSlice";

function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    void dispatch(hydrateAuth());
  }, [dispatch]);

  useEffect(() => {
    return onUnauthorized(() => {
      void dispatch(signOutThunk());
    });
  }, [dispatch]);

  return <>{children}</>;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <AuthBootstrap>{children}</AuthBootstrap>
    </Provider>
  );
}
