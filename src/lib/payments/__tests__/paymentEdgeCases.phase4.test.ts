import { resolvePaymentMethodHint } from "../pricingQuoteHint";
import { getSessionRefundChip } from "../paymentStatusLabels";

/**
 * Phase 4 mobile UX validation — refund chips and wallet-aware quotes.
 */
describe("Phase 4 mobile payment UX", () => {
  it("shows refund processing chip on cancelled session", () => {
    const chip = getSessionRefundChip({
      status: "cancelled",
      refund_status: "processing",
      _refund: { transfer: { destination: "wallet", status: "processing" } },
    });
    expect(chip?.label).toMatch(/processing|wallet/i);
    expect(chip?.tone).toBe("warning");
  });

  it("shows refund completed chip after successful refund", () => {
    const chip = getSessionRefundChip({
      status: "cancelled",
      refund_status: "completed",
      _refund: { transfer: { destination: "wallet", status: "completed" } },
    });
    expect(chip?.tone).toBe("success");
  });

  it("hides refund chip on active confirmed booking", () => {
    expect(
      getSessionRefundChip({ status: "confirmed", refund_status: "processing" })
    ).toBeNull();
  });

  it("wallet-aware quote hint when balance covers lesson total", () => {
    expect(resolvePaymentMethodHint(100, 80)).toBe("wallet_us");
    expect(resolvePaymentMethodHint(50, 80)).toBe("card_domestic_us");
  });
});
