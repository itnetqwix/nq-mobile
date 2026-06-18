export function computeTrainerEarningsDisplay(balances?: {
  available?: number;
  pending_release?: number;
  pending_payout?: number;
}) {
  const available = balances?.available ?? 0;
  const pending = (balances?.pending_release ?? 0) + (balances?.pending_payout ?? 0);
  return {
    available,
    pending,
    showPending: pending > 0,
    availableLabel: `$${available.toFixed(0)}`,
    pendingLabel: `$${pending.toFixed(0)}`,
  };
}
