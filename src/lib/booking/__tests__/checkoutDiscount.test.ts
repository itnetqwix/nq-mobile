import { resolveCheckoutDiscountAmount } from "../checkoutDiscount";

describe("resolveCheckoutDiscountAmount", () => {
  it("uses the reported total checkout discount when referral discounts are included", () => {
    expect(
      resolveCheckoutDiscountAmount({
        expectedPrice: 120,
        payableAmount: 85,
        reportedTotalDiscount: 35,
      })
    ).toBe(35);
  });

  it("falls back to the expected minus payable amount when preview totals are unavailable", () => {
    expect(
      resolveCheckoutDiscountAmount({
        expectedPrice: 100,
        payableAmount: 80,
      })
    ).toBe(20);
  });

  it("does not understate the discount when the payable amount is lower than the reported total", () => {
    expect(
      resolveCheckoutDiscountAmount({
        expectedPrice: 100,
        payableAmount: 70,
        reportedTotalDiscount: 10,
      })
    ).toBe(30);
  });

  it("does not return negative discounts", () => {
    expect(
      resolveCheckoutDiscountAmount({
        expectedPrice: 75,
        payableAmount: 75,
        reportedTotalDiscount: -10,
      })
    ).toBe(0);
  });
});
