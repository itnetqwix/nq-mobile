import {
  createNavigationContainerRef,
  type NavigatorScreenParams,
} from "@react-navigation/native";
import type {
  MainTabParamList,
  MenuStackParamList,
  RootStackParamList,
  ShellSurfaceRouteId,
} from "./types";

/**
 * Shared navigation ref so non-screen components (toasts, banners, push handlers, etc.)
 * can drive React Navigation imperatively without violating the rules-of-hooks
 * restriction that `useNavigation` only works inside a navigator subtree.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** Convenience: jump to the Notifications inbox surface from anywhere in the app. */
export function navigateToNotifications(): boolean {
  if (!navigationRef.isReady()) return false;
  navigationRef.navigate(
    "Main",
    {
      screen: "Menu",
      params: {
        screen: "ShellSurface",
        params: { surfaceId: "notifications" as ShellSurfaceRouteId },
      },
    } as unknown as NavigatorScreenParams<MainTabParamList>
  );
  return true;
}
