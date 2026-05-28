import { useCallback } from "react";
import { Linking } from "react-native";
import type { ShellSurfaceRouteId } from "../../../navigation/types";
import { isReactNavigationDeepLink } from "../lib/deepLinks";

const SURFACE_BY_PATH: Record<string, ShellSurfaceRouteId> = {
  wallet: "wallet",
  settings: "settings",
  notifications: "notifications",
  clips: "clips",
  "clip-submissions": "clipSubmissions",
  "game-plans": "gamePlans",
  "saved-lessons": "savedLessons",
  invite: "invite",
  transactions: "transactions",
  schedule: "trainerSchedule",
  "trainer-schedule": "trainerSchedule",
  "edit-profile": "editProfile",
  "professional-profile": "professionalProfile",
  "report-issue": "reportIssue",
  support: "supportChat",
  reviews: "trainerReviews",
};

function pathFromDeepLink(url: string): string {
  const raw = url
    .replace(/^netqwix:\/\//i, "")
    .replace(/^nq:\/\//i, "")
    .split("?")[0]
    .replace(/^\//, "");
  return raw.toLowerCase();
}

type Options = {
  openShell: (id: ShellSurfaceRouteId) => void;
  /** When set, in-app surfaces that need auth redirect here (guest mode). */
  onRequireAuth?: () => void;
};

/**
 * Routes admin tip/banner CTAs (`netqwix://wallet`, etc.) into shell surfaces.
 */
export function useContentDeepLink({ openShell, onRequireAuth }: Options) {
  return useCallback(
    (url: string) => {
      if (!url?.trim()) return;
      if (!isReactNavigationDeepLink(url)) {
        Linking.openURL(url).catch(() => {});
        return;
      }
      const path = pathFromDeepLink(url);
      const surface = SURFACE_BY_PATH[path];
      if (surface) {
        if (onRequireAuth) {
          onRequireAuth();
          return;
        }
        openShell(surface);
        return;
      }
      if (path.includes("wake-up")) {
        Linking.openURL(url).catch(() => {});
        return;
      }
      Linking.openURL(url).catch(() => {});
    },
    [openShell, onRequireAuth]
  );
}
