import { walletBalanceDisplayParts } from "../walletBalanceDisplayLogic";

describe("walletBalanceDisplayParts", () => {
  it("exposes available and pending top-up", () => {
    const r = walletBalanceDisplayParts({ available: 75.5, pending_topup: 25 });
    expect(r.available).toBe(75.5);
    expect(r.pendingTopUp).toBe(25);
    expect(r.showPendingTopUp).toBe(true);
  });

  it("defaults missing balances to zero", () => {
    const r = walletBalanceDisplayParts();
    expect(r.available).toBe(0);
    expect(r.showPendingTopUp).toBe(false);
  });
});
