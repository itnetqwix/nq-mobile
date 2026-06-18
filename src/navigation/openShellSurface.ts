import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { HomeStackParamList } from "./types";

export type ShellSurfaceParams = HomeStackParamList["ShellSurface"];

type HomeStackNavigation = NativeStackNavigationProp<HomeStackParamList>;

/**
 * Open a locker / settings shell surface.
 * When already inside a shell (or on a home-stack page pushed from shell),
 * push so back returns to the previous surface instead of the dashboard.
 */
export function openShellSurface(navigation: HomeStackNavigation, params: ShellSurfaceParams): void {
  const state = navigation.getState();
  const current = state.routes[state.index];

  if (current?.name === "ShellSurface") {
    navigation.push("ShellSurface", params);
    return;
  }

  const previous = state.index > 0 ? state.routes[state.index - 1] : undefined;
  if (previous?.name === "ShellSurface") {
    navigation.push("ShellSurface", params);
    return;
  }

  navigation.navigate("ShellSurface", params);
}

/** Push settings sub-screens when opened from inside a shell surface. */
export function openHomeStackScreen<RouteName extends keyof HomeStackParamList>(
  navigation: HomeStackNavigation,
  name: RouteName,
  params?: HomeStackParamList[RouteName]
): void {
  const state = navigation.getState();
  const current = state.routes[state.index];
  if (current?.name === "ShellSurface") {
    (navigation.push as (screen: keyof HomeStackParamList, params?: unknown) => void)(name, params);
    return;
  }
  (navigation.navigate as (screen: keyof HomeStackParamList, params?: unknown) => void)(name, params);
}
