import { useLiveLessonUxState } from "../useLiveLessonUxState";

describe("useLiveLessonUxState", () => {
  const baseArgs = {
    cameraRevoked: false,
    partnerReconnecting: false,
    partnerInSession: true,
    hasRemoteStream: true,
    partnerDisconnected: false,
    peerDisplayName: "Alex",
    isTrainer: false,
    presence: {
      trainerConnected: true,
      traineeConnected: true,
      partnerConnected: true,
      partnerLeftKind: null,
      presenceMessage: null,
      presenceVariant: "info" as const,
      partnerReconnecting: false,
    },
    bothJoined: true,
    networkOnline: true,
    lessonTimer: {
      status: "running",
      pauseReason: null,
      remainingSeconds: 600,
    },
    extensionPhase: "idle" as const,
    departurePrompt: null,
    departureWaitingAfterDecline: false,
    departureRejoinSecondsLeft: null,
    socketReconnectFailed: false,
  };

  it("prioritizes departure prompt modal over extension waiting", () => {
    const state = useLiveLessonUxState({
      ...baseArgs,
      departurePrompt: {
        sessionId: "s1",
        departedRole: "trainer",
        departedDisplayName: "Coach",
        rejoinDeadlineAt: new Date(Date.now() + 120_000).toISOString(),
        bookedEndAt: null,
      },
      presence: {
        ...baseArgs.presence,
        trainerConnected: false,
      },
      extensionPhase: "awaiting_trainer",
    });
    expect(state.activeModal).toBe("departure_prompt");
  });

  it("shows rejoin blocked when join code is departure_rejoin_blocked", () => {
    const state = useLiveLessonUxState({
      ...baseArgs,
      joinCode: "departure_rejoin_blocked",
      joinBlockReason: "You have another session during this time.",
    });
    expect(state.activeModal).toBe("rejoin_blocked");
    expect(state.rejoinBlockedReason).toContain("another session");
  });

  it("surfaces extension waiting for coach when trainer offline", () => {
    const state = useLiveLessonUxState({
      ...baseArgs,
      presence: {
        ...baseArgs.presence,
        trainerConnected: false,
      },
      extensionPhase: "awaiting_trainer",
    });
    expect(state.showExtensionWaitingCoach).toBe(true);
    expect(state.activeModal).toBe("extension_waiting_coach");
  });

  it("maps trainer_left pause to timer hint", () => {
    const state = useLiveLessonUxState({
      ...baseArgs,
      lessonTimer: {
        status: "paused",
        pauseReason: "trainer_left",
        remainingSeconds: 300,
      },
      presence: {
        ...baseArgs.presence,
        partnerLeftKind: "trainer",
      },
    });
    expect(state.timerHint).toContain("coach disconnected");
  });
});
