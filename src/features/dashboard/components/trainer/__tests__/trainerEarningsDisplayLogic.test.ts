import { computeTrainerEarningsDisplay } from "../trainerEarningsDisplayLogic";

describe("computeTrainerEarningsDisplay", () => {
  it("sums pending release and payout", () => {
    const r = computeTrainerEarningsDisplay({
      available: 120,
      pending_release: 30,
      pending_payout: 20,
    });
    expect(r.available).toBe(120);
    expect(r.pending).toBe(50);
    expect(r.showPending).toBe(true);
    expect(r.availableLabel).toBe("$120");
  });

  it("hides pending chip when zero", () => {
    const r = computeTrainerEarningsDisplay({ available: 80 });
    expect(r.showPending).toBe(false);
  });
});
