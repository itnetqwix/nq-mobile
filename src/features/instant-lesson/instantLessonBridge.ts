/** Bridge between notifications, push taps, and InstantLessonContext. */

export type InstantLessonPhasePayload = {
  lessonId?: string;
  phase?: string;
  refundReason?: string;
  coachId?: string;
  traineeId?: string;
  joinDeadlineAt?: string;
  acceptedAt?: string;
};

export type InstantLessonIncomingPayload = {
  lessonId: string;
  coachId: string;
  traineeId: string;
  traineeInfo: {
    _id: string;
    fullname: string;
    profile_picture?: string;
  };
  expiresAt: number;
  duration?: number;
  lessonType?: string;
};

type Handlers = {
  onPhase?: (payload: InstantLessonPhasePayload) => void;
  onIncomingRequest?: (payload: InstantLessonIncomingPayload) => void;
};

type ActionHandlers = {
  acceptIncoming?: (payload: InstantLessonIncomingPayload) => Promise<void>;
  declineIncoming?: (lessonId: string) => Promise<void>;
};

let handlers: Handlers = {};
let actionHandlers: ActionHandlers = {};

export function registerInstantLessonHandlers(next: Handlers) {
  handlers = { ...handlers, ...next };
}

export function registerInstantLessonActionHandlers(next: ActionHandlers) {
  actionHandlers = { ...actionHandlers, ...next };
}

export function emitInstantLessonPhase(payload: InstantLessonPhasePayload) {
  handlers.onPhase?.(payload);
}

export function emitInstantLessonIncomingRequest(payload: InstantLessonIncomingPayload) {
  handlers.onIncomingRequest?.(payload);
}

export function getInstantLessonActionHandlers(): ActionHandlers {
  return actionHandlers;
}
