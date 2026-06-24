import { DateTime } from "luxon";
import { pickAvailableDurations, isSlotConflictMessage } from "../scheduledBookingFlow";
import { windowsFromApiSlots } from "../timeSlotUtils";

const zone = "America/New_York";
const date = "2026-12-15";

describe("scheduledBookingFlow", () => {
  const windows = windowsFromApiSlots(
    [{ start: "2:00 PM", end: "4:00 PM" }],
    date,
    zone
  );
  const now = DateTime.fromISO(`${date}T10:00:00`, { zone });

  it("returns all durations when no start selected", () => {
    expect(pickAvailableDurations(windows, null, zone, now)).toEqual([
      15, 30, 45, 60, 75, 90,
    ]);
  });

  it("limits durations for a tight window", () => {
    const tight = windowsFromApiSlots(
      [{ start: "2:00 PM", end: "2:45 PM" }],
      date,
      zone
    );
    const start = DateTime.fromISO(`${date}T14:00:00`, { zone }).toISO()!;
    const available = pickAvailableDurations(tight, start, zone, now);
    expect(available).toContain(15);
    expect(available).toContain(30);
    expect(available).not.toContain(90);
  });

  it("detects slot conflict copy", () => {
    expect(isSlotConflictMessage("This time is no longer available.")).toBe(true);
    expect(isSlotConflictMessage("Sessions must start at least 120 minutes from now.")).toBe(
      true
    );
    expect(isSlotConflictMessage("Invalid promo code.")).toBe(false);
  });
});
