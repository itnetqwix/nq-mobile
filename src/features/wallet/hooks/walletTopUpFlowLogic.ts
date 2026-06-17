import type { TopUpIntentResult } from "../walletApi";

export type TopUpFlowResult =
  | { ok: true; topupId: string; amountDollars: number }
  | { ok: false; code: "canceled" | "failed" | "timeout" | "validation"; message: string };

export function validateTopUpAmount(amountDollars: number): TopUpFlowResult | null {
  if (!Number.isFinite(amountDollars) || amountDollars <= 0) {
    return { ok: false, code: "validation", message: "Enter a valid amount." };
  }
  return null;
}

export function parseTopUpIntent(intent: TopUpIntentResult): { topupId: string } | TopUpFlowResult {
  const topupId = String(intent.topupId ?? "");
  if (!topupId || !intent.client_secret) {
    return {
      ok: false,
      code: "failed",
      message: "Invalid response from server. Please try again.",
    };
  }
  return { topupId };
}

export type TopUpSettlementDeps = {
  confirmTopUp: (topupId: string) => Promise<void>;
  waitForTopUpSettled: (
    topupId: string,
    opts: { maxAttempts: number; intervalMs: number }
  ) => Promise<"succeeded" | "failed" | "pending" | string>;
};

export async function finalizeTopUpSettlement(
  topupId: string,
  amountDollars: number,
  deps: TopUpSettlementDeps
): Promise<TopUpFlowResult> {
  try {
    await deps.confirmTopUp(topupId);
  } catch {
    /* webhook may still complete */
  }

  const settled = await deps.waitForTopUpSettled(topupId, { maxAttempts: 12, intervalMs: 2000 });
  if (settled === "succeeded") {
    return { ok: true, topupId, amountDollars };
  }
  if (settled === "failed") {
    return {
      ok: false,
      code: "failed",
      message: "Payment was declined or could not be completed.",
    };
  }

  return {
    ok: false,
    code: "timeout",
    message:
      "Payment received — your balance may take a minute to update. Check Activity or pull to refresh.",
  };
}
