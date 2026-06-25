import { DateTime } from "luxon";
import {
  buildCalendarMonthGrid,
  buildStartCandidates,
  groupStartCandidatesByPeriod,
  mergeSlotWindows,
  parseSlotTimeOnDate,
  resolveSuggestionDateIso,
  windowsFromApiSlots,
} from "../timeSlotUtils";
import { SCHEDULED_MIN_LEAD_TIME_MINUTES } from "../constants";

const zone = "America/New_York";
const date = "2026-12-15";

describe("timeSlotUtils", () => {
  it("parses 12h slot labels on a date", () => {
    const dt = parseSlotTimeOnDate(date, "3:30 PM", zone);
    expect(dt).not.toBeNull();
    expect(dt!.toFormat("HH:mm")).toBe("15:30");
  });

  it("merges adjacent windows", () => {
    const a = DateTime.fromISO(`${date}T14:00:00`, { zone });
    const b = DateTime.fromISO(`${date}T15:00:00`, { zone });
    const c = DateTime.fromISO(`${date}T16:00:00`, { zone });
    const merged = mergeSlotWindows([
      { start: a, end: b },
      { start: b, end: c },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.end.toMillis()).toBe(c.toMillis());
  });

  it("enforces minimum lead time in buildStartCandidates", () => {
    const now = DateTime.fromISO(`${date}T14:00:00`, { zone });
    const windows = windowsFromApiSlots(
      [{ start: "2:00 PM", end: "5:00 PM" }],
      date,
      zone
    );
    const candidates = buildStartCandidates(windows, 30, 15, { now });
    const minStart = now.plus({ minutes: SCHEDULED_MIN_LEAD_TIME_MINUTES });
    expect(candidates.every((c) => c >= minStart)).toBe(true);
    expect(candidates.some((c) => c.toFormat("HH:mm") === "14:00")).toBe(false);
  });

  it("groups candidates by period", () => {
    const morning = DateTime.fromISO(`${date}T09:00:00`, { zone });
    const afternoon = DateTime.fromISO(`${date}T14:00:00`, { zone });
    const evening = DateTime.fromISO(`${date}T19:00:00`, { zone });
    const grouped = groupStartCandidatesByPeriod([afternoon, morning, evening]);
    expect(grouped.morning).toHaveLength(1);
    expect(grouped.afternoon).toHaveLength(1);
    expect(grouped.evening).toHaveLength(1);
  });

  it("resolves suggestion day labels within horizon", () => {
    const today = DateTime.now().setZone(zone);
    const dayLabel = today.toFormat("cccc");
    const resolved = resolveSuggestionDateIso(dayLabel, zone, 14);
    expect(resolved).toBe(today.toISODate());
  });

  it("resolves MMM d suggestion labels", () => {
    const target = DateTime.now().setZone(zone).plus({ days: 3 });
    const label = target.toFormat("MMM d");
    expect(resolveSuggestionDateIso(label, zone, 14)).toBe(target.toISODate());
  });

  it("builds a 6-week Monday-start month grid with bookable days in horizon", () => {
    const anchor = DateTime.fromISO("2026-06-15", { zone });
    const { weeks, bookableDays } = buildCalendarMonthGrid(anchor, zone, 60);
    expect(weeks).toHaveLength(6);
    expect(weeks[0]).toHaveLength(7);
    expect(bookableDays.length).toBeGreaterThan(0);
    expect(bookableDays.every((iso) => iso >= DateTime.now().setZone(zone).toISODate()!)).toBe(
      true
    );
  });
});
