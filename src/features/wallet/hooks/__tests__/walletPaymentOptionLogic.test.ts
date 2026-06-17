import { computeWalletPaymentOption } from "../walletPaymentOptionLogic";

describe("computeWalletPaymentOption", () => {
  it("allows wallet pay when balance covers price", () => {
    const r = computeWalletPaymentOption({
      priceDollars: 40,
      availableDollars: 50,
      walletPayEnabled: true,
    });
    expect(r.canPayWithWallet).toBe(true);
    expect(r.shortfall).toBe(0);
  });

  it("computes shortfall when balance is insufficient", () => {
    const r = computeWalletPaymentOption({
      priceDollars: 80,
      availableDollars: 30,
      walletPayEnabled: true,
    });
    expect(r.canPayWithWallet).toBe(false);
    expect(r.shortfall).toBe(50);
  });

  it("requires PIN for payments at or above step-up threshold", () => {
    const r = computeWalletPaymentOption({
      priceDollars: 100,
      availableDollars: 200,
      walletPayEnabled: true,
      stepUpThresholdMinor: 10000,
      pinSet: true,
    });
    expect(r.needsPin).toBe(true);
  });

  it("disables wallet pay when feature flag off", () => {
    const r = computeWalletPaymentOption({
      priceDollars: 40,
      availableDollars: 100,
      walletPayEnabled: false,
    });
    expect(r.canPayWithWallet).toBe(false);
  });
});
