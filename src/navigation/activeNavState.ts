import type { NavigationState, PartialState } from "@react-navigation/native";
import { navEntryById } from "./navMatrix";
import type { NavMatrixEntry } from "./navMatrix";

export type ActiveNavState = {
  tab: string | null;
  homeRoute: string | null;
  surfaceId: string | null;
  featureId: string | null;
};

function findFocusedRoute(state: NavigationState | PartialState<NavigationState> | undefined): {
  name: string;
  params?: Record<string, unknown>;
} | null {
  if (!state) return null;
  const route = state.routes[state.index ?? 0];
  if (!route) return null;
  if (route.state) {
    return findFocusedRoute(route.state);
  }
  return { name: route.name, params: route.params as Record<string, unknown> | undefined };
}

/** Walk the navigation tree to determine drawer highlight state. */
export function getActiveNavState(
  state: NavigationState | PartialState<NavigationState> | undefined
): ActiveNavState {
  const result: ActiveNavState = {
    tab: null,
    homeRoute: null,
    surfaceId: null,
    featureId: null,
  };
  if (!state) return result;

  const tabsRoute = state.routes[state.index ?? 0];
  if (tabsRoute?.name !== "Tabs" || !tabsRoute.state) {
    return result;
  }

  const tabState = tabsRoute.state;
  const tabRoute = tabState.routes[tabState.index ?? 0];
  result.tab = tabRoute?.name ?? null;

  if (tabRoute?.name === "Home" && tabRoute.state) {
    const focused = findFocusedRoute(tabRoute.state);
    result.homeRoute = focused?.name ?? null;
    if (focused?.name === "ShellSurface" && focused.params?.surfaceId) {
      result.surfaceId = String(focused.params.surfaceId);
    }
    if (focused?.name === "DashboardFeature" && focused.params?.featureId) {
      result.featureId = String(focused.params.featureId);
    }
  }

  return result;
}

export function isNavEntryActive(entry: NavMatrixEntry, active: ActiveNavState): boolean {
  const { target } = entry;

  if (target.kind === "tab") {
    if (target.tab === "Home") {
      return (
        active.tab === "Home" &&
        (active.homeRoute === "DashboardHome" || active.homeRoute === null)
      );
    }
    return active.tab === target.tab;
  }

  if (target.kind === "shell") {
    return active.tab === "Home" && active.surfaceId === target.surfaceId;
  }

  if (target.kind === "feature") {
    return active.tab === "Home" && active.featureId === target.featureId;
  }

  return false;
}

export function activeEntryIdForState(active: ActiveNavState): string | null {
  if (active.tab === "Schedule") {
    const entry = navEntryById("sessions-trainee") ?? navEntryById("schedule-trainer");
    return entry?.id ?? null;
  }
  if (active.tab === "Chats") return null;
  if (active.surfaceId) return active.surfaceId;
  if (active.featureId) return active.featureId;
  if (active.tab === "Home" && active.homeRoute === "DashboardHome") return "my-locker";
  return null;
}
