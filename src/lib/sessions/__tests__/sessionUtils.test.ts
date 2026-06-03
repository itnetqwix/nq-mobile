/** Matrix: P4, B8 — instant vs scheduled join windows */
import {
  canJoinSession,
  isInstantLesson,
  isPendingBooking,
  isSessionConfirmedForJoin,
  shouldShowInDashboardRequests,
} from "../sessionUtils";

describe("sessionUtils", () => {
  const scheduledConfirmed = {
    is_instant: false,
    status: "confirmed",
    booked_date: "2026-06-15",
    session_start_time: "14:00",
    session_end_time: "15:00",
    time_zone: "America/New_York",
  };

  const instantPendingJoin = {
    is_instant: true,
    status: "booked",
    accepted_at: "2026-06-15T12:00:00.000Z",
    join_deadline_at: "2026-06-15T12:05:00.000Z",
    instant_phase: "pending_join",
  };

  it("detects instant vs scheduled", () => {
    expect(isInstantLesson({ is_instant: true })).toBe(true);
    expect(isInstantLesson(scheduledConfirmed)).toBe(false);
  });

  it("allows scheduled join 15 min before start", () => {
    const start = new Date("2026-06-15T18:00:00.000Z");
    const session = {
      ...scheduledConfirmed,
      start_time: start.toISOString(),
      end_time: new Date(start.getTime() + 3600_000).toISOString(),
      session_start_time: undefined,
      session_end_time: undefined,
    };
    const now = new Date(start.getTime() - 10 * 60_000);
    expect(canJoinSession(session, now)).toBe(true);
  });

  it("blocks instant join after deadline", () => {
    const now = new Date("2026-06-15T12:10:00.000Z");
    expect(canJoinSession(instantPendingJoin, now)).toBe(false);
  });

  it("allows instant join inside deadline", () => {
    const now = new Date("2026-06-15T12:02:00.000Z");
    expect(canJoinSession(instantPendingJoin, now)).toBe(true);
  });

  it("pending instant awaits accept", () => {
    const pending = {
      is_instant: true,
      status: "booked",
      instant_phase: "pending_accept",
    };
    expect(isPendingBooking(pending)).toBe(true);
    expect(isSessionConfirmedForJoin(pending)).toBe(false);
  });
});
