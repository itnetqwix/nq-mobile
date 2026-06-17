/** User-facing labels for escrow + refund states from session detail / wallet. */

import { formatRefundTransferLabel } from "../sessions/refundTransferLabel";
import { isSessionTerminalForUI, normalizeSessionStatus } from "../sessions/sessionUtils";

export type RefundChipTone = "success" | "warning" | "danger" | "neutral";

export type SessionRefundChip = {
  label: string;
  tone: RefundChipTone;
};

const ESCROW_LABELS: Record<string, string> = {
  held: "Payment held in escrow until the lesson completes",
  releasing: "Releasing payment to your coach…",
  released: "Payment released to your coach",
  refunded: "Payment refunded",
  disputed: "Payment under review",
  cancelled: "Payment hold cancelled",
};

const REFUND_STATUS_LABELS: Record<string, string> = {
  pending: "Refund pending",
  processing: "Refund processing",
  completed: "Refund completed",
  refunded: "Refund completed",
  failed: "Refund failed — contact support if this persists",
};

export function formatEscrowStatusLabel(status: string | null | undefined): string | null {
  if (!status) return null;
  return ESCROW_LABELS[String(status).toLowerCase()] ?? `Escrow: ${status}`;
}

export function formatRefundStatusLabel(
  status: string | null | undefined,
  transferLabel?: string | null
): string | null {
  if (transferLabel) return transferLabel;
  if (!status) return null;
  return REFUND_STATUS_LABELS[String(status).toLowerCase()] ?? `Refund: ${status}`;
}

function refundChipTone(status: string): RefundChipTone {
  const s = status.toLowerCase();
  if (s === "failed") return "danger";
  if (s === "completed" || s === "refunded") return "success";
  return "warning";
}

/** Compact refund pill for session list rows (cancelled / terminal sessions only). */
export function getSessionRefundChip(session: Record<string, unknown> | null | undefined): SessionRefundChip | null {
  if (!session) return null;

  const status = normalizeSessionStatus(session.status as string | undefined);
  const isCancelled = status === "cancelled" || status === "canceled";
  if (!isCancelled && !isSessionTerminalForUI(session)) return null;

  const refundStatus = String(
    (session._refund as { status?: string } | undefined)?.status ??
      session.refund_status ??
      ""
  ).trim();
  if (!refundStatus) return null;

  const transferLabel = formatRefundTransferLabel(
    (session._refund as { transfer?: unknown } | undefined)?.transfer ??
      (session.refund_transfer as Parameters<typeof formatRefundTransferLabel>[0])
  );

  const label =
    formatRefundStatusLabel(refundStatus, transferLabel) ??
    `Refund: ${refundStatus}`;
  if (!label) return null;

  return { label, tone: refundChipTone(refundStatus) };
}
