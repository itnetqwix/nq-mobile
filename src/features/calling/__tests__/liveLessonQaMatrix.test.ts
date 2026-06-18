/**
 * Live lesson QA matrix (manual + smoke references).
 * Run through each scenario during release QA; automated smoke covers keyboard + departure hooks.
 */
export const LIVE_LESSON_QA_MATRIX = [
  { id: 1, scenario: "Trainer loses network <45s, returns", expected: "No PARTICIPANT_LEFT; media recovers" },
  { id: 2, scenario: "Trainer offline >45s", expected: "Timer paused; trainee sees coach-left banner" },
  { id: 3, scenario: "Trainee offline >45s", expected: "Timer keeps running" },
  { id: 4, scenario: "Trainer taps End call", expected: "Partner gets departure modal with deadlines" },
  { id: 5, scenario: "Partner chooses Stay", expected: "Timer paused until rejoin or booked end" },
  { id: 6, scenario: "Partner chooses End", expected: "endLessonEarly for both; post-call flow" },
  { id: 7, scenario: "Trainer rejoins after Stay", expected: "clearDepartureOnRejoin; dashboard rejoin UX" },
  { id: 8, scenario: "Trainer rejoin blocked (overlap)", expected: "SessionRejoinBlockedModal" },
  { id: 9, scenario: "Rejoin window expires", expected: "Trainee can report concern" },
  { id: 10, scenario: "Booked window ends while partner stayed", expected: "Auto-end at booked end" },
  { id: 11, scenario: "Extension while coach disconnected", expected: "ExtensionWaitingForCoachModal" },
  { id: 12, scenario: "Extension payment + disconnect", expected: "Idempotent server state" },
  { id: 13, scenario: "Socket reconnect_failed", expected: "ReconnectFailedOverlay" },
  { id: 14, scenario: "Second device takes call slot", expected: "CallSlotTakenOverModal" },
  { id: 15, scenario: "ICE/WebRTC drop", expected: "recoverConnection / partner toast" },
  { id: 16, scenario: "Trainee initiates departure", expected: "Symmetric stay/end flow" },
  { id: 17, scenario: "Instant vs scheduled session", expected: "Join policy + timer source verified" },
  { id: 18, scenario: "Extension rejected at timer 0", expected: "Explicit rejection surfaced" },
  {
    id: 19,
    scenario: "ICE reconnect while both in-call",
    expected: "No duplicate peer-joined toast (reason=reconnect suppressed)",
  },
] as const;

describe("live lesson QA matrix", () => {
  it("documents 19 E2E scenarios", () => {
    expect(LIVE_LESSON_QA_MATRIX).toHaveLength(19);
    expect(LIVE_LESSON_QA_MATRIX[7].expected).toContain("SessionRejoinBlockedModal");
    expect(LIVE_LESSON_QA_MATRIX[18].expected).toContain("reconnect");
  });
});

describe("KeyboardFormModal smoke", () => {
  it("CaptureQuickLabelModal uses keyboard-safe page sheet pattern", () => {
    // Structural smoke: component file exports modal with KeyboardFormModal import.
    const fs = require("fs");
    const path = require("path");
    const src = fs.readFileSync(
      path.join(__dirname, "../../capture/components/CaptureQuickLabelModal.tsx"),
      "utf8"
    );
    expect(src).toContain("KeyboardFormModal");
    expect(src).toContain('presentationStyle="pageSheet"');
    expect(src).not.toMatch(/KeyboardAvoidingView[\s\S]*transparent/);
  });
});
