export function walletBalanceDisplayParts(balances?: {
  available?: number;
  pending_topup?: number;
}) {
  const available = balances?.available ?? 0;
  const pendingTopUp = balances?.pending_topup ?? 0;
  return {
    available,
    pendingTopUp,
    showPendingTopUp: pendingTopUp > 0,
  };
}
