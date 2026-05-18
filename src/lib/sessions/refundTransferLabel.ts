export type RefundTransfer = {
  destination?: "wallet" | "card" | "bank";
  status?: "pending" | "processing" | "completed" | "failed";
  expected_by?: string;
  completed_at?: string | null;
  failure_reason?: string | null;
};

export function formatRefundTransferLabel(transfer: RefundTransfer | null | undefined): string | null {
  if (!transfer?.destination) return null;

  const expected = transfer.expected_by
    ? new Date(transfer.expected_by).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  if (transfer.status === "failed") {
    return transfer.failure_reason || "Refund transfer failed";
  }

  if (transfer.destination === "wallet" && transfer.status === "completed") {
    return "Refunded to your NetQwix wallet";
  }

  if (transfer.destination === "card") {
    if (transfer.status === "completed") {
      return "Refund sent to your card (5–10 business days)";
    }
    return "Refund to card processing…";
  }

  if (transfer.destination === "bank") {
    if (transfer.status === "completed") {
      return "Transfer to your bank completed";
    }
    return expected
      ? `Bank transfer expected by ${expected}`
      : "Bank transfer processing (within 24 hours)";
  }

  return null;
}
