/**
 * AI assistant action whitelist.
 *
 * The assistant can return a structured list of `actions` alongside its
 * text response. Each action is a verb + safely-typed payload; the
 * client routes the user to the appropriate surface (booking flow,
 * cancel sheet, support chat, etc.). We deliberately do NOT auto-execute
 * destructive actions — the user always taps to confirm in the
 * destination screen.
 *
 * Adding a new action:
 *   1. Add it to the `AiActionType` union below.
 *   2. Map its payload + label in `describeAiAction`.
 *   3. Add navigation logic in `runAiAction`.
 *
 * The set is intentionally small for the first cut — booking, browsing
 * trainers, opening the schedule, top-up, and support hand-off. We can
 * grow from here as the LLM tooling matures.
 */

import i18n from "../../i18n";
import { navigationRef } from "../../navigation/navigationRef";
import type { ShellSurfaceRouteId } from "../../navigation/types";
import { openSupportChat } from "../../lib/support/reportProblem";

export type AiActionType =
  | "open-book-lesson"
  | "open-trainer-profile"
  | "open-schedule"
  | "open-upcoming-sessions"
  | "open-wallet-topup"
  | "open-support-chat"
  | "open-report-issue"
  | "open-faq";

export type AiAction = {
  type: AiActionType;
  /** Free-form payload — only consumed by the matching `runAiAction` branch. */
  payload?: Record<string, unknown>;
  /** Optional label override (otherwise generated from i18n). */
  label?: string;
};

export function describeAiAction(action: AiAction): string {
  if (action.label) return action.label;
  switch (action.type) {
    case "open-book-lesson":
      return i18n.t("ai.action.bookLesson", { defaultValue: "Book a lesson" });
    case "open-trainer-profile":
      return i18n.t("ai.action.viewTrainer", { defaultValue: "View trainer" });
    case "open-schedule":
      return i18n.t("ai.action.editSchedule", { defaultValue: "Edit my schedule" });
    case "open-upcoming-sessions":
      return i18n.t("ai.action.upcomingSessions", { defaultValue: "Upcoming sessions" });
    case "open-wallet-topup":
      return i18n.t("ai.action.topUp", { defaultValue: "Add funds" });
    case "open-support-chat":
      return i18n.t("ai.action.supportChat", { defaultValue: "Chat with support" });
    case "open-report-issue":
      return i18n.t("ai.action.reportIssue", { defaultValue: "Report an issue" });
    case "open-faq":
      return i18n.t("ai.action.faq", { defaultValue: "Open FAQ" });
    default:
      return i18n.t("ai.action.open", { defaultValue: "Open" });
  }
}

function navShell(surfaceId: ShellSurfaceRouteId, extra: Record<string, unknown> = {}): boolean {
  if (!navigationRef.isReady()) return false;
  try {
    (navigationRef as any).navigate("Main", {
      screen: "Tabs",
      params: {
        screen: "Home",
        params: {
          screen: "ShellSurface",
          params: { surfaceId, ...extra },
        },
      },
    });
    return true;
  } catch {
    return false;
  }
}

function navFeature(featureId: string): boolean {
  if (!navigationRef.isReady()) return false;
  try {
    (navigationRef as any).navigate("Main", {
      screen: "Tabs",
      params: {
        screen: "Home",
        params: {
          screen: "DashboardFeature",
          params: { featureId },
        },
      },
    });
    return true;
  } catch {
    return false;
  }
}

export function runAiAction(action: AiAction): boolean {
  switch (action.type) {
    case "open-book-lesson":
      return navFeature("book-lesson");
    case "open-trainer-profile":
      return navFeature("book-lesson");
    case "open-schedule":
      return navShell("trainerSchedule");
    case "open-upcoming-sessions":
      return navFeature("upcoming-sessions");
    case "open-wallet-topup":
      return navShell("wallet", { walletScreen: "WalletTopUp" });
    case "open-support-chat":
      return openSupportChat();
    case "open-report-issue":
      return navShell("reportIssue");
    case "open-faq":
      return navFeature("faq");
    default:
      return false;
  }
}

/**
 * Best-effort coercion of a `result.actions` array from an arbitrary
 * server payload. Drops unknown action types so the rest of the chat
 * still renders even if the backend ships a new action before the
 * client is updated.
 */
export function parseAiActions(value: unknown): AiAction[] {
  if (!Array.isArray(value)) return [];
  const known: AiActionType[] = [
    "open-book-lesson",
    "open-trainer-profile",
    "open-schedule",
    "open-upcoming-sessions",
    "open-wallet-topup",
    "open-support-chat",
    "open-report-issue",
    "open-faq",
  ];
  const out: AiAction[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const type = (raw as { type?: unknown }).type;
    if (typeof type !== "string" || !known.includes(type as AiActionType)) continue;
    const label = (raw as { label?: unknown }).label;
    const payload = (raw as { payload?: unknown }).payload;
    out.push({
      type: type as AiActionType,
      label: typeof label === "string" ? label : undefined,
      payload: payload && typeof payload === "object" ? (payload as Record<string, unknown>) : undefined,
    });
  }
  return out;
}
