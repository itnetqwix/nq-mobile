type LedgerMetadata = {
  kind?: string;
  session_id?: string;
};

export function ledgerReferenceLabel(
  referenceType?: string,
  metadata?: LedgerMetadata | null
): string {
  const t = String(referenceType ?? "").toLowerCase();
  const kind = String(metadata?.kind ?? "").toLowerCase();

  if (t === "topup") return "Top-up";
  if (t === "extension" || kind === "extension") return "Extension hold";
  if (t === "escrow_hold") {
    return kind === "extension" ? "Extension hold" : "Lesson hold";
  }
  if (t === "booking") return kind === "extension" ? "Extension payment" : "Lesson payment";
  if (t === "refund" || t === "escrow_refund") return "Refund";
  if (t === "payout") return "Payout";
  if (t === "escrow_release") return "Payment released";
  if (t === "adjustment") return "Balance adjustment";
  return referenceType ? String(referenceType).replace(/_/g, " ") : "Transaction";
}

export function formatLedgerAmount(entryType: string, amountMinor: number): string {
  const dollars = (Math.abs(amountMinor) / 100).toFixed(2);
  const sign = entryType === "credit" ? "+" : "−";
  return `${sign}$${dollars}`;
}
