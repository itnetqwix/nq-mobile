import { shouldCancelExtensionOnPaymentFailure } from "../../calling/extensionPaymentRecoverability";

describe("extensionPaymentRecoverability", () => {
  it("treats expired and not-found as terminal (cancel request)", () => {
    expect(shouldCancelExtensionOnPaymentFailure("Quote expired")).toBe(true);
    expect(shouldCancelExtensionOnPaymentFailure("Extension request not found")).toBe(true);
    expect(shouldCancelExtensionOnPaymentFailure("not ready for payment")).toBe(true);
  });

  it("treats transient card errors as recoverable (stay on payment step)", () => {
    expect(shouldCancelExtensionOnPaymentFailure("Your card was declined")).toBe(false);
    expect(shouldCancelExtensionOnPaymentFailure("Network request failed")).toBe(false);
    expect(shouldCancelExtensionOnPaymentFailure("Insufficient wallet balance")).toBe(false);
  });

  it("does not cancel when extension already applied", () => {
    expect(shouldCancelExtensionOnPaymentFailure("already applied")).toBe(false);
  });
});
