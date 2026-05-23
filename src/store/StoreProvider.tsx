import React, { useEffect } from "react";
import { Provider } from "react-redux";
import { store } from "./store";
import { hydrateAuth } from "./slices/authSlice";
import { useAppDispatch } from "./hooks";
import { onUnauthorized } from "../lib/auth/sessionEvents";
import { clearSessionLocalThunk } from "./slices/authSlice";
import { isInAuthGracePeriod } from "../lib/auth/authSessionGuard";

function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    void dispatch(hydrateAuth());
  }, [dispatch]);

  useEffect(() => {
    return onUnauthorized(() => {
      if (isInAuthGracePeriod()) return;
      void dispatch(clearSessionLocalThunk());
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
