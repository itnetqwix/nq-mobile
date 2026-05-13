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
  /**
   * `navigate` is overloaded with strict types per stack. We're addressing
   * the nested Menu stack inside the Main drawer; the runtime form is the
   * `(name, params)` payload below. Cast through `any` to bypass the
   * compiler narrowing that only knows about the top-level RootStackParamList.
   */
  (navigationRef as any).navigate("Main", {
    screen: "Menu",
    params: {
      screen: "ShellSurface",
      params: { surfaceId: "notifications" as ShellSurfaceRouteId },
    },
  });
  return true;
}
