import { useCallback } from "react";
import { Linking } from "react-native";
import type { DashboardRouteId } from "../../dashboard/config/dashboardRoutes";
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

const FEATURE_BY_PATH: Record<string, DashboardRouteId> = {
  "book-lesson": "book-lesson",
  "about-us": "about-us",
  "contact-us": "contact-us",
  faq: "faq",
  blogs: "blogs",
  blog: "blogs",
};

/** Surfaces guests may open without signing in. */
const GUEST_SHELL_SURFACES = new Set<ShellSurfaceRouteId>(["settings"]);

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
  openFeature?: (id: DashboardRouteId) => void;
  /** When set, protected surfaces redirect here (guest mode). */
  onRequireAuth?: () => void;
  /** Guest browse — allow public shells/features without auth. */
  isGuest?: boolean;
};

/**
 * Routes admin tip/banner CTAs (`netqwix://wallet`, `netqwix://blogs`, etc.).
 */
export function useContentDeepLink({
  openShell,
  openFeature,
  onRequireAuth,
  isGuest = false,
}: Options) {
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
        if (isGuest && !GUEST_SHELL_SURFACES.has(surface)) {
          onRequireAuth?.();
          return;
        }
        openShell(surface);
        return;
      }
      const feature = FEATURE_BY_PATH[path];
      if (feature && openFeature) {
        if (isGuest && !["book-lesson", "about-us", "contact-us", "faq", "blogs"].includes(feature)) {
          onRequireAuth?.();
          return;
        }
        openFeature(feature);
        return;
      }
      if (path === "legal/terms" || path === "terms") {
        openFeature?.("faq");
        return;
      }
      if (path.includes("wake-up")) {
        Linking.openURL(url).catch(() => {});
        return;
      }
      Linking.openURL(url).catch(() => {});
    },
    [openShell, openFeature, onRequireAuth, isGuest]
  );
}
