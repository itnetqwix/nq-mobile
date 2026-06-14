import type { MeetingStatusBanner } from "./meetingUx";
import { resolveMeetingStatusBanner } from "./meetingUx";
import type { SessionPresenceState } from "./useSessionPresence";
import type { SessionDeparturePrompt } from "./useSessionDeparture";
import type { ExtensionPhase } from "./useSessionExtensionFlow";

export type LiveLessonModalKind =
  | "departure_prompt"
  | "rejoin_blocked"
  | "extension_waiting_coach"
  | "booked_window_ended"
  | null;

export type LiveLessonUxState = {
  statusBanner: MeetingStatusBanner;
  timerHint: string | null;
  activeModal: LiveLessonModalKind;
  rejoinBlockedReason: string | null;
  showExtensionWaitingCoach: boolean;
  departureRejoinCountdown: number | null;
};

type Args = {
  cameraRevoked: boolean;
  partnerReconnecting: boolean;
  partnerInSession: boolean;
  hasRemoteStream: boolean;
  partnerDisconnected: boolean;
  peerDisplayName: string;
  isTrainer: boolean;
  presence: SessionPresenceState;
  bothJoined: boolean;
  networkOnline: boolean;
  lessonTimer: {
    status: string;
    pauseReason: string | null;
    remainingSeconds: number;
  };
  extensionPhase: ExtensionPhase;
  departurePrompt: SessionDeparturePrompt | null;
  departureWaitingAfterDecline: boolean;
  departureRejoinSecondsLeft: number | null;
  socketReconnectFailed: boolean;
  joinBlockReason?: string | null;
  joinCode?: string | null;
};

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Central live-lesson UX: one banner + one modal priority queue. */
export function useLiveLessonUxState(input: Args): LiveLessonUxState {
  const {
    cameraRevoked,
    partnerReconnecting,
    partnerInSession,
    hasRemoteStream,
    partnerDisconnected,
    peerDisplayName,
    isTrainer,
    presence,
    bothJoined,
    networkOnline,
    lessonTimer,
    extensionPhase,
    departurePrompt,
    departureWaitingAfterDecline,
    departureRejoinSecondsLeft,
    socketReconnectFailed,
    joinBlockReason,
    joinCode,
  } = input;

  const extensionPausedHint =
    lessonTimer.status === "paused" &&
    (lessonTimer.pauseReason === "extension_pending" ||
      lessonTimer.pauseReason === "extension_accepted")
      ? "Paused — extension in progress"
      : null;

  const departurePresenceHint =
    departureWaitingAfterDecline && !isTrainer
      ? departureRejoinSecondsLeft != null && departureRejoinSecondsLeft > 0
        ? `Coach left — rejoin window ${formatCountdown(departureRejoinSecondsLeft)}`
        : departureRejoinSecondsLeft === 0
          ? "Rejoin window closed — you can report a concern"
          : "Coach left — waiting for rejoin"
      : null;

  const statusBanner = resolveMeetingStatusBanner({
    cameraRevoked,
    partnerReconnecting,
    partnerDisconnected,
    partnerInSession,
    hasRemoteStream,
    peerDisplayName,
    isTrainer,
    trainerConnected: presence.trainerConnected,
    traineeConnected: presence.traineeConnected,
    bothJoined,
    presenceMessage:
      partnerInSession && !departurePresenceHint ? presence.presenceMessage : departurePresenceHint,
    presenceVariant: departurePresenceHint ? "warning" : presence.presenceVariant,
    extensionPausedHint,
    networkOffline: !networkOnline && partnerInSession,
  });

  const timerHint = (() => {
    if (
      lessonTimer.status === "paused" &&
      (lessonTimer.pauseReason === "extension_pending" ||
        lessonTimer.pauseReason === "extension_accepted")
    ) {
      return "Paused — extension in progress";
    }
    if (lessonTimer.pauseReason === "trainer_left" || presence.partnerLeftKind === "trainer") {
      if (lessonTimer.status === "paused") return "Paused — coach disconnected";
    }
    if (lessonTimer.pauseReason === "trainee_left" || presence.partnerLeftKind === "trainee") {
      if (lessonTimer.status === "running") return "Trainee disconnected — timer running";
    }
    if (presence.partnerReconnecting) return "Partner reconnecting…";
    if (lessonTimer.pauseReason === "network_outage" && lessonTimer.status === "paused") {
      return "Paused — connection outage";
    }
    if (departureWaitingAfterDecline && isTrainer && departureRejoinSecondsLeft != null) {
      return `Partner stayed — rejoin in ${formatCountdown(departureRejoinSecondsLeft)}`;
    }
    if (!networkOnline && lessonTimer.status === "running") {
      return "Weak connection — lesson continues";
    }
    return null;
  })();

  const showExtensionWaitingCoach =
    !isTrainer &&
    extensionPhase === "awaiting_trainer" &&
    presence.trainerConnected === false;

  let activeModal: LiveLessonModalKind = null;
  let rejoinBlockedReason: string | null = null;

  if (socketReconnectFailed) {
    activeModal = null;
  } else if (departurePrompt) {
    activeModal = "departure_prompt";
  } else if (joinCode === "departure_rejoin_blocked" && joinBlockReason) {
    activeModal = "rejoin_blocked";
    rejoinBlockedReason = joinBlockReason;
  } else if (showExtensionWaitingCoach) {
    activeModal = "extension_waiting_coach";
  }

  return {
    statusBanner,
    timerHint,
    activeModal,
    rejoinBlockedReason,
    showExtensionWaitingCoach,
    departureRejoinCountdown: departureRejoinSecondsLeft,
  };
}
