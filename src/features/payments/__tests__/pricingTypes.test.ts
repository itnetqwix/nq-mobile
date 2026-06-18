import { chargeTotalDollars, feeRowsFromQuote } from "../../payments/pricingTypes";

describe("pricingTypes", () => {
  it("chargeTotalDollars converts cents to dollars", () => {
    expect(chargeTotalDollars({ quoteId: "q1", chargeTotalCents: 5025, breakdown: [] })).toBe(50.25);
    expect(chargeTotalDollars(null)).toBeNull();
  });

  it("feeRowsFromQuote omits subtotal and total rows", () => {
    const rows = feeRowsFromQuote({
      quoteId: "q1",
      chargeTotalCents: 5000,
      breakdown: [
        { key: "session_subtotal", label: "Session", amountMinor: 4000 },
        { key: "platform_fee", label: "Fee", amountMinor: 1000 },
        { key: "total", label: "Total", amountMinor: 5000 },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe("platform_fee");
  });
});
