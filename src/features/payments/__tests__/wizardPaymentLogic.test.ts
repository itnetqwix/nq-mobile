import {
  resolveWizardChargeTotal,
  resolveWizardPayableAmount,
  resolveWizardPaymentMethodHint,
  shouldSkipPaymentIntent,
} from "../wizardPaymentLogic";

describe("wizardPaymentLogic", () => {
  describe("resolveWizardPayableAmount", () => {
    it("uses explicit payable amount prop", () => {
      expect(
        resolveWizardPayableAmount({
          payableAmountProp: 45,
          promoValid: true,
          promoFinalAmount: 40,
          expectedPrice: 50,
        })
      ).toBe(45);
    });

    it("uses promo final amount when valid", () => {
      expect(
        resolveWizardPayableAmount({
          promoValid: true,
          promoFinalAmount: 40,
          expectedPrice: 50,
        })
      ).toBe(40);
    });

    it("falls back to expected price", () => {
      expect(resolveWizardPayableAmount({ expectedPrice: 50 })).toBe(50);
    });
  });

  describe("shouldSkipPaymentIntent", () => {
    it("skips free sessions", () => {
      expect(shouldSkipPaymentIntent(0, 50)).toBe(true);
      expect(shouldSkipPaymentIntent(25, 0)).toBe(true);
      expect(shouldSkipPaymentIntent(25, 50)).toBe(false);
    });
  });

  describe("resolveWizardPaymentMethodHint", () => {
    it("uses wallet when option enabled", () => {
      expect(resolveWizardPaymentMethodHint(true, 100, 50)).toBe("wallet_us");
    });

    it("uses card hint when wallet cannot cover", () => {
      expect(resolveWizardPaymentMethodHint(false, 10, 50)).toBe("card_domestic_us");
    });
  });

  describe("resolveWizardChargeTotal", () => {
    it("prefers quote charge total", () => {
      expect(resolveWizardChargeTotal(5250, 40, 50)).toBe(52.5);
    });

    it("falls back to price info then payable", () => {
      expect(resolveWizardChargeTotal(undefined, 48, 50)).toBe(48);
      expect(resolveWizardChargeTotal(undefined, undefined, 50)).toBe(50);
    });
  });
});
