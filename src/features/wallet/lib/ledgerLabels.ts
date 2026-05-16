export function ledgerReferenceLabel(referenceType?: string): string {
  const t = String(referenceType ?? "").toLowerCase();
  if (t === "topup") return "Wallet top-up";
  if (t === "booking") return "Lesson booking";
  if (t === "extension") return "Session extension";
  if (t === "refund") return "Refund";
  if (t === "payout") return "Payout";
  if (t === "escrow_hold") return "Payment held";
  if (t === "escrow_release") return "Payment released";
  return referenceType ? String(referenceType).replace(/_/g, " ") : "Transaction";
}

export function formatLedgerAmount(entryType: string, amountMinor: number): string {
  const dollars = (Math.abs(amountMinor) / 100).toFixed(2);
  const sign = entryType === "credit" ? "+" : "−";
  return `${sign}$${dollars}`;
}
