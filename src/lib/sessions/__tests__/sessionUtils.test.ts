/** Matrix: P4, B8 — instant vs scheduled join windows */
import {
  canJoinSession,
  canPromptEarlySessionEnd,
  canRejoinLesson,
  dedupeSessionsById,
  filterSessionsForStatusTab,
  isEarlyEndedWithinBookedWindow,
  isInstantLesson,
  isPendingBooking,
  isSessionConfirmedForJoin,
  isSessionInProgress,
  shouldShowInDashboardPending,
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

  it("confirmed scheduled appears in upcoming and confirmed tabs", () => {
    const future = {
      is_instant: false,
      status: "confirmed",
      booked_date: "2026-12-15",
      session_start_time: "14:00",
      session_end_time: "15:00",
      start_time: "2026-12-15T19:00:00.000Z",
      end_time: "2026-12-15T20:00:00.000Z",
    };
    const now = new Date("2026-06-15T12:00:00.000Z");
    expect(filterSessionsForStatusTab([future], "upcoming", now)).toHaveLength(1);
    expect(filterSessionsForStatusTab([future], "confirmed", now)).toHaveLength(1);
  });

  it("instant pending accept stays in upcoming only", () => {
    const pending = {
      is_instant: true,
      status: "booked",
      instant_phase: "pending_accept",
      booked_date: "2026-06-15",
      session_start_time: "12:00",
      session_end_time: "12:30",
    };
    const now = new Date("2026-06-15T12:00:00.000Z");
    expect(filterSessionsForStatusTab([pending], "upcoming", now)).toHaveLength(1);
    expect(filterSessionsForStatusTab([pending], "confirmed", now)).toHaveLength(0);
  });

  it("dedupes sessions by id", () => {
    const rows = [{ _id: "a" }, { _id: "a" }, { _id: "b" }];
    expect(dedupeSessionsById(rows)).toHaveLength(2);
  });

  it("treats early-ended instant lesson as not in progress", () => {
    const now = new Date("2026-06-15T12:10:00.000Z");
    const endedEarly = {
      is_instant: true,
      status: "confirmed",
      both_joined_at: "2026-06-15T12:00:00.000Z",
      instant_phase: "completed",
      actual_end_at: "2026-06-15T12:05:00.000Z",
      end_time: "2026-06-15T12:05:00.000Z",
      start_time: "2026-06-15T12:00:00.000Z",
    };
    expect(isSessionInProgress(endedEarly, now)).toBe(false);
    expect(canRejoinLesson(endedEarly, now)).toBe(false);
  });

  it("keeps early-ended session on confirmed tab until booked window closes", () => {
    const now = new Date("2026-06-15T14:10:00.000Z");
    const endedScheduled = {
      is_instant: false,
      status: "confirmed",
      booked_date: "2026-06-15",
      session_start_time: "14:00",
      session_end_time: "15:00",
      start_time: "2026-06-15T14:00:00.000Z",
      end_time: "2026-06-15T14:05:00.000Z",
      actual_end_at: "2026-06-15T14:05:00.000Z",
    };
    expect(isEarlyEndedWithinBookedWindow(endedScheduled, now)).toBe(true);
    expect(filterSessionsForStatusTab([endedScheduled], "confirmed", now)).toHaveLength(1);
    expect(filterSessionsForStatusTab([endedScheduled], "completed", now)).toHaveLength(0);
  });

  it("moves early-ended session to completed after booked window closes", () => {
    const now = new Date("2026-06-15T16:00:00.000Z");
    const endedScheduled = {
      is_instant: false,
      status: "completed",
      booked_date: "2026-06-15",
      session_start_time: "14:00",
      session_end_time: "15:00",
      start_time: "2026-06-15T14:00:00.000Z",
      end_time: "2026-06-15T14:05:00.000Z",
      actual_end_at: "2026-06-15T14:05:00.000Z",
    };
    expect(filterSessionsForStatusTab([endedScheduled], "confirmed", now)).toHaveLength(0);
    expect(filterSessionsForStatusTab([endedScheduled], "completed", now)).toHaveLength(1);
  });

  it("prompts early end during active booked window after lesson started", () => {
    const now = new Date("2026-06-15T14:30:00.000Z");
    const live = {
      is_instant: false,
      status: "confirmed",
      booked_date: "2026-06-15",
      session_start_time: "14:00",
      session_end_time: "15:00",
      start_time: "2026-06-15T14:00:00.000Z",
      end_time: "2026-06-15T15:00:00.000Z",
      both_joined_at: "2026-06-15T14:05:00.000Z",
    };
    expect(canPromptEarlySessionEnd(live, true, now)).toBe(true);
    expect(canPromptEarlySessionEnd(live, false, now)).toBe(true);
  });

  it("shows scheduled booked sessions in dashboard pending for trainees and trainers", () => {
    const scheduledPending = {
      is_instant: false,
      status: "booked",
      booked_date: "2026-06-20",
      session_start_time: "14:00",
      session_end_time: "15:00",
      time_zone: "America/New_York",
    };
    expect(isPendingBooking(scheduledPending)).toBe(true);
    expect(shouldShowInDashboardPending(scheduledPending)).toBe(true);
    expect(shouldShowInDashboardRequests(scheduledPending)).toBe(true);
  });
});
