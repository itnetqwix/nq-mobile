import { CommonActions, createNavigationContainerRef } from "@react-navigation/native";
import type { RootStackParamList, ShellSurfaceRouteId } from "./types";
import { store } from "../store/store";
import { clearSessionLocalThunk } from "../store/slices/authSlice";

/**
 * Shared navigation ref so non-screen components (toasts, banners, push handlers, etc.)
 * can drive React Navigation imperatively without violating the rules-of-hooks
 * restriction that `useNavigation` only works inside a navigator subtree.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * Ends the local session and opens the Login screen (Auth modal over guest Main).
 * Used from session-expired and other system-state flows.
 */
export async function navigateToAuthLogin(): Promise<void> {
  await store.dispatch(clearSessionLocalThunk());

  const openLogin = (): boolean => {
    if (!navigationRef.isReady()) return false;
    navigationRef.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [
          { name: "Main" },
          { name: "Auth", params: { screen: "Login" } },
        ],
      })
    );
    return true;
  };

  if (openLogin()) return;

  let attempts = 0;
  await new Promise<void>((resolve) => {
    const tick = () => {
      if (openLogin() || attempts++ >= 40) {
        resolve();
        return;
      }
      setTimeout(tick, 50);
    };
    setTimeout(tick, 0);
  });
}

/** Convenience: jump to the Notifications inbox surface from anywhere in the app. */
export function navigateToNotifications(): boolean {
  if (!navigationRef.isReady()) return false;
  (navigationRef as any).navigate("Main", {
    screen: "Tabs",
    params: {
      screen: "Home",
      params: {
        screen: "ShellSurface",
        params: { surfaceId: "notifications" as ShellSurfaceRouteId },
      },
    },
  });
  return true;
}

/** Open wallet Add funds (optionally pre-filled for booking shortfall). */
export function navigateToWalletTopUp(suggestedAmount?: number): boolean {
  if (!navigationRef.isReady()) return false;
  (navigationRef as any).navigate("Main", {
    screen: "Tabs",
    params: {
      screen: "Home",
      params: {
        screen: "ShellSurface",
        params: {
          surfaceId: "wallet" as ShellSurfaceRouteId,
          walletScreen: "WalletTopUp",
          walletParams:
            suggestedAmount != null && suggestedAmount > 0
              ? { suggestedAmount }
              : undefined,
        },
      },
    },
  });
  return true;
}
