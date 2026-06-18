import { resolvePaymentMethodHint } from "../pricingQuoteHint";

describe("resolvePaymentMethodHint", () => {
  it("prefers wallet when balance covers charge", () => {
    expect(resolvePaymentMethodHint(100, 80)).toBe("wallet_us");
  });

  it("uses card when balance is insufficient", () => {
    expect(resolvePaymentMethodHint(30, 80)).toBe("card_domestic_us");
  });

  it("uses card when required amount is zero", () => {
    expect(resolvePaymentMethodHint(100, 0)).toBe("card_domestic_us");
  });
});
