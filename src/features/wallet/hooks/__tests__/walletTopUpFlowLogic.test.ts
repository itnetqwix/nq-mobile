import {
  finalizeTopUpSettlement,
  parseTopUpIntent,
  validateTopUpAmount,
} from "../walletTopUpFlowLogic";

describe("walletTopUpFlowLogic", () => {
  describe("validateTopUpAmount", () => {
    it("rejects non-positive amounts", () => {
      expect(validateTopUpAmount(0)?.code).toBe("validation");
      expect(validateTopUpAmount(-5)?.code).toBe("validation");
      expect(validateTopUpAmount(Number.NaN)?.code).toBe("validation");
    });

    it("accepts valid amounts", () => {
      expect(validateTopUpAmount(25)).toBeNull();
    });
  });

  describe("parseTopUpIntent", () => {
    it("requires topup id and client secret", () => {
      const r = parseTopUpIntent({ topupId: "t1" });
      expect(r).toEqual({
        ok: false,
        code: "failed",
        message: "Invalid response from server. Please try again.",
      });
    });

    it("returns topup id when intent is valid", () => {
      expect(parseTopUpIntent({ topupId: "t1", client_secret: "sec" })).toEqual({
        topupId: "t1",
      });
    });
  });

  describe("finalizeTopUpSettlement", () => {
    it("succeeds when settlement reports succeeded", async () => {
      const confirmTopUp = jest.fn().mockResolvedValue(undefined);
      const waitForTopUpSettled = jest.fn().mockResolvedValue("succeeded");

      const r = await finalizeTopUpSettlement("top1", 50, { confirmTopUp, waitForTopUpSettled });

      expect(r).toEqual({ ok: true, topupId: "top1", amountDollars: 50 });
      expect(confirmTopUp).toHaveBeenCalledWith("top1");
    });

    it("returns failed when settlement reports failed", async () => {
      const r = await finalizeTopUpSettlement("top1", 50, {
        confirmTopUp: jest.fn().mockResolvedValue(undefined),
        waitForTopUpSettled: jest.fn().mockResolvedValue("failed"),
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("failed");
    });

    it("returns timeout when settlement stays pending", async () => {
      const r = await finalizeTopUpSettlement("top1", 50, {
        confirmTopUp: jest.fn().mockRejectedValue(new Error("network")),
        waitForTopUpSettled: jest.fn().mockResolvedValue("pending"),
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("timeout");
    });
  });
});
