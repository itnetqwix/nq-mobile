import { Platform } from "react-native";
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";

/** Unified motion timing — tuned for smooth native-stack on iOS + Android. */
export const STACK_TRANSITION_MS = 280;

const iosPush = Platform.OS === "ios" ? ("default" as const) : ("slide_from_right" as const);

/** Primary in-app pushes (wallet, capture, onboarding, auth sub-screens). */
export function nestedStackScreenOptions(
  overrides: NativeStackNavigationOptions = {}
): NativeStackNavigationOptions {
  return {
    headerShown: false,
    animation: iosPush,
    animationDuration: STACK_TRANSITION_MS,
    gestureEnabled: true,
    fullScreenGestureEnabled: Platform.OS === "ios",
    ...overrides,
  };
}

/** Home dashboard stack — fade keeps header stable; swipe-back via StackSwipeBackShell. */
export function homeStackScreenOptions(
  overrides: NativeStackNavigationOptions = {}
): NativeStackNavigationOptions {
  return {
    animation: "fade",
    animationDuration: STACK_TRANSITION_MS,
    gestureEnabled: false,
    ...overrides,
  };
}

/** Root modals (Auth, Meeting). */
export function rootModalScreenOptions(
  overrides: NativeStackNavigationOptions = {}
): NativeStackNavigationOptions {
  return {
    presentation: "fullScreenModal",
    animation: "slide_from_bottom",
    animationDuration: STACK_TRANSITION_MS,
    gestureEnabled: true,
    ...overrides,
  };
}

/** Lightweight overlays (system state, alerts). */
export function rootFadeModalScreenOptions(
  overrides: NativeStackNavigationOptions = {}
): NativeStackNavigationOptions {
  return {
    presentation: "modal",
    animation: "fade",
    animationDuration: STACK_TRANSITION_MS,
    headerShown: false,
    ...overrides,
  };
}

/** Root stack under Main (Meeting push from tabs). */
export function rootPushScreenOptions(
  overrides: NativeStackNavigationOptions = {}
): NativeStackNavigationOptions {
  return {
    headerShown: false,
    animation: iosPush,
    animationDuration: STACK_TRANSITION_MS,
    gestureEnabled: true,
    fullScreenGestureEnabled: Platform.OS === "ios",
    ...overrides,
  };
}
