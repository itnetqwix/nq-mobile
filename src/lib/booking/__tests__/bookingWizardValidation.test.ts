/** Matrix: B2, B6, B8 */
import {
  isInstantDurationAllowed,
  isScheduledSlotInPast,
  shouldOpenTrainerScheduledBookingPopup,
} from "../bookingWizardValidation";

describe("bookingWizardValidation", () => {
  it("allows only 15 and 30 minute instant lessons", () => {
    expect(isInstantDurationAllowed(15)).toBe(true);
    expect(isInstantDurationAllowed(30)).toBe(true);
    expect(isInstantDurationAllowed(60)).toBe(false);
  });

  it("detects past scheduled slots", () => {
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);
    expect(isScheduledSlotInPast(past)).toBe(true);
    expect(isScheduledSlotInPast(future)).toBe(false);
  });

  it("never opens scheduled popup for instant", () => {
    expect(
      shouldOpenTrainerScheduledBookingPopup({ is_instant: true }, true)
    ).toBe(false);
    expect(
      shouldOpenTrainerScheduledBookingPopup({ is_instant: false }, true)
    ).toBe(true);
  });
});
