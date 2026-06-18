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
  {
    id: 20,
    scenario: "Annotate on unlocked dual-clip",
    expected: "Both panes visible; pane switcher changes stroke target only",
  },
  {
    id: 21,
    scenario: "Trainer scrubs locked dual-clip",
    expected: "Trainee video + slim progress bar follow within ~100ms",
  },
  {
    id: 22,
    scenario: "Screenshot dual-clip with annotations",
    expected: "Full-brightness frame from clip thumbnails; annotations burned in",
  },
  {
    id: 23,
    scenario: "Initiator ends then partner End",
    expected: "Both reach post-call (trainer recap / trainee ratings)",
  },
  {
    id: 24,
    scenario: "Initiator ends then partner Stay",
    expected: "Initiator sees paused state; no post-call until booked end",
  },
  {
    id: 25,
    scenario: "Missed SESSION_DEPARTURE_PROMPT",
    expected: "Status poll on AppState active shows SessionDepartureModal",
  },
] as const;

describe("live lesson QA matrix", () => {
  it("documents 25 E2E scenarios", () => {
    expect(LIVE_LESSON_QA_MATRIX).toHaveLength(25);
    expect(LIVE_LESSON_QA_MATRIX[7].expected).toContain("SessionRejoinBlockedModal");
    expect(LIVE_LESSON_QA_MATRIX[18].expected).toContain("reconnect");
    expect(LIVE_LESSON_QA_MATRIX[19].expected).toContain("pane switcher");
    expect(LIVE_LESSON_QA_MATRIX[22].expected).toContain("post-call");
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

describe("live lesson structural smoke", () => {
  const fs = require("fs");
  const path = require("path");
  const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

  it("dual-clip annotation does not auto setClipFocus on toolbar open", () => {
    const src = read("screens/NativeMeetingScreen.tsx");
    expect(src).not.toMatch(
      /annotationToolbarOpen[\s\S]{0,400}clipSync\.setClipFocus\(annotationSourcePane\)/
    );
    expect(src).toContain("unlockedAnnotPane");
    expect(src).toContain('dualClip && annotationToolbarOpen');
  });

  it("useClipSync seek emits scrubbing flag for live trainer scrub", () => {
    const src = read("useClipSync.ts");
    expect(src).toContain("scrubbing: !isCommit");
    expect(src).toContain("lastScrubSeekEmit");
    expect(src).toContain("payload?.scrubbing === true");
  });

  it("ClipPlaybackControls exposes slim inline timeline tier", () => {
    const src = read("components/ClipPlaybackControls.tsx");
    expect(src).toContain('"slim"');
    expect(src).toContain("hideTimeLabels");
  });

  it("useSessionDeparture recovers missed prompt on AppState active", () => {
    const src = read("useSessionDeparture.ts");
    expect(src).toContain("AppState.addEventListener");
    expect(src).toContain("recoverPendingPrompt");
    expect(src).toContain("onRespondError");
  });

  it("screenshot capture hides drawing overlay and prefers clip frames", () => {
    const meeting = read("screens/NativeMeetingScreen.tsx");
    expect(meeting).toContain("annotationArmed && !screenshot.capturing");
    expect(meeting).toContain("screenshot.takeScreenshot(sources)");
    const burnIn = read("components/AnnotationBurnInHost.tsx");
    expect(burnIn).toContain("EXPORT_WIDTH = 1080");
    expect(burnIn).toContain('resizeMode="cover"');
  });
});
