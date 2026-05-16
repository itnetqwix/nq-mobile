import { createNavigationContainerRef } from "@react-navigation/native";
import type { RootStackParamList, ShellSurfaceRouteId } from "./types";

/**
 * Shared navigation ref so non-screen components (toasts, banners, push handlers, etc.)
 * can drive React Navigation imperatively without violating the rules-of-hooks
 * restriction that `useNavigation` only works inside a navigator subtree.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

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
