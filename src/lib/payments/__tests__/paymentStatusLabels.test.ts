import { resolvePaymentMethodHint } from "../pricingQuoteHint";
import {
  formatEscrowStatusLabel,
  formatRefundStatusLabel,
  getSessionRefundChip,
} from "../paymentStatusLabels";

describe("pricingQuoteHint", () => {
  it("returns wallet_us when balance covers the charge", () => {
    expect(resolvePaymentMethodHint(50, 40)).toBe("wallet_us");
    expect(resolvePaymentMethodHint(40, 40)).toBe("wallet_us");
  });

  it("returns card_domestic_us when balance is insufficient or charge is zero", () => {
    expect(resolvePaymentMethodHint(10, 40)).toBe("card_domestic_us");
    expect(resolvePaymentMethodHint(100, 0)).toBe("card_domestic_us");
  });
});

describe("paymentStatusLabels", () => {
  it("maps escrow statuses to user-facing copy", () => {
    expect(formatEscrowStatusLabel("held")).toMatch(/escrow/i);
    expect(formatEscrowStatusLabel("released")).toMatch(/released/i);
    expect(formatEscrowStatusLabel("unknown_state")).toContain("unknown_state");
  });

  it("maps refund statuses and prefers transfer label", () => {
    expect(formatRefundStatusLabel("processing")).toMatch(/processing/i);
    expect(formatRefundStatusLabel("completed")).toMatch(/completed/i);
    expect(formatRefundStatusLabel(null, "Returned to wallet")).toBe("Returned to wallet");
  });

  it("returns refund chip for cancelled sessions with refund status", () => {
    const chip = getSessionRefundChip({
      status: "cancelled",
      refund_status: "processing",
    });
    expect(chip?.label).toMatch(/processing/i);
    expect(chip?.tone).toBe("warning");
  });

  it("hides refund chip for active confirmed sessions", () => {
    expect(
      getSessionRefundChip({ status: "confirmed", refund_status: "processing" })
    ).toBeNull();
  });

  it("maps completed refund to success tone", () => {
    const chip = getSessionRefundChip({
      status: "cancelled",
      refund_status: "completed",
    });
    expect(chip?.tone).toBe("success");
  });
});
