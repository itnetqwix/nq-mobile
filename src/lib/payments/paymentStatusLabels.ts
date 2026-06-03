/** User-facing labels for escrow + refund states from session detail / wallet. */

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
