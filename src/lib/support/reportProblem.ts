/**
 * Deep-link to the "Report a problem" form with pre-filled context.
 *
 * The idea: when something fails (network error, server 500, payment
 * declined) the toast / alert presents a "Report a problem" CTA. Tapping
 * it lands the user inside `ReportIssueScreen` with the request id and
 * screen name already in the description, so support tickets aren't
 * starved of context.
 *
 * Extracting a "request id" from an axios error is best-effort:
 *   1. `x-request-id` response header (set by our gateway)
 *   2. `request_id` / `requestId` field in the error body
 *   3. fallback: timestamp so support has at least *something* to grep
 */

import { isAxiosError } from "axios";
import { navigationRef } from "../../navigation/navigationRef";
import type { ShellSurfaceRouteId } from "../../navigation/types";

export type ReportProblemContext = {
  /** What was the user trying to do? Used as the subject. */
  action?: string;
  /** Screen the error occurred on (best-effort; falls back to current route). */
  screen?: string;
  /** The thrown error — used to derive request id + status code. */
  error?: unknown;
  /** Custom note to prepend to the description (e.g. "Trainer wouldn't load"). */
  note?: string;
  /** Optional booking / session id for the form to attach. */
  bookingId?: string;
};

function extractRequestId(error: unknown): string | null {
  if (isAxiosError(error)) {
    const headerId =
      (error.response?.headers as Record<string, unknown> | undefined)?.[
        "x-request-id"
      ] ??
      (error.response?.headers as Record<string, unknown> | undefined)?.[
        "X-Request-Id"
      ];
    if (typeof headerId === "string" && headerId.length > 0) return headerId;
    const body = error.response?.data as
      | { request_id?: unknown; requestId?: unknown }
      | undefined;
    if (typeof body?.request_id === "string" && body.request_id.length > 0) {
      return body.request_id;
    }
    if (typeof body?.requestId === "string" && body.requestId.length > 0) {
      return body.requestId;
    }
  }
  return null;
}

function extractStatus(error: unknown): number | null {
  if (isAxiosError(error)) return error.response?.status ?? null;
  return null;
}

function currentScreenName(): string {
  if (!navigationRef.isReady()) return "unknown";
  try {
    const r = navigationRef.getCurrentRoute();
    if (!r) return "unknown";
    return r.name;
  } catch {
    return "unknown";
  }
}

function buildSubject(ctx: ReportProblemContext): string {
  const screen = ctx.screen ?? currentScreenName();
  if (ctx.action) return `Problem · ${ctx.action} · ${screen}`;
  return `Problem reported on ${screen}`;
}

function buildDescription(ctx: ReportProblemContext): string {
  const lines: string[] = [];
  const requestId = ctx.error ? extractRequestId(ctx.error) : null;
  const status = ctx.error ? extractStatus(ctx.error) : null;
  const screen = ctx.screen ?? currentScreenName();

  lines.push(ctx.note ?? "Tell us what happened:");
  lines.push("");
  lines.push("— — — Diagnostic info — — —");
  lines.push(`Screen: ${screen}`);
  if (ctx.action) lines.push(`Action: ${ctx.action}`);
  if (status != null) lines.push(`Status: HTTP ${status}`);
  if (requestId) lines.push(`Request id: ${requestId}`);
  /** Always include a timestamp so support can grep server logs even when
   *  the request id is missing. */
  lines.push(`Local time: ${new Date().toISOString()}`);
  return lines.join("\n");
}

/**
 * Imperatively open the ReportIssue screen with `subject` + `description`
 * pre-filled. Falls back to a no-op when navigation isn't mounted yet.
 */
export function openReportProblem(ctx: ReportProblemContext = {}): boolean {
  if (!navigationRef.isReady()) return false;
  const subject = buildSubject(ctx);
  const description = buildDescription(ctx);

  try {
    (navigationRef as any).navigate("Main", {
      screen: "Tabs",
      params: {
        screen: "Home",
        params: {
          screen: "ReportIssue",
          params: { prefillSubject: subject, prefillDescription: description, bookingId: ctx.bookingId },
        },
      },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Convenience: opens the in-app support chat via the dashboard "contact-us"
 * route. Provided so call-sites can offer "Chat with support" as the
 * primary CTA on transient/non-actionable errors.
 */
export function openSupportChat(): boolean {
  if (!navigationRef.isReady()) return false;
  try {
    (navigationRef as any).navigate("Main", {
      screen: "Tabs",
      params: {
        screen: "Home",
        params: {
          screen: "ShellSurface",
          params: { surfaceId: "supportChat" as ShellSurfaceRouteId },
        },
      },
    });
    return true;
  } catch {
    return false;
  }
}
