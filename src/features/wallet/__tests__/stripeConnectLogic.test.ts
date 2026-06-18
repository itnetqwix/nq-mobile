import { parseStripeConnectMessage } from "../stripeConnectLogic";

describe("parseStripeConnectMessage", () => {
  it("marks complete when verification succeeded", () => {
    const r = parseStripeConnectMessage("Stripe verification completed successfully.");
    expect(r.complete).toBe(true);
  });

  it("marks incomplete when message says not completed", () => {
    const r = parseStripeConnectMessage("Stripe verification not completed.");
    expect(r.complete).toBe(false);
  });
});
