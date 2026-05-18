/** Lightweight bridge so NotificationProvider can forward instant-lesson events to InstantLessonContext. */

export type InstantLessonPhasePayload = {
  lessonId?: string;
  phase?: string;
  refundReason?: string;
};

type Handlers = {
  onPhase?: (payload: InstantLessonPhasePayload) => void;
};

let handlers: Handlers = {};

export function registerInstantLessonHandlers(next: Handlers) {
  handlers = next;
}

export function emitInstantLessonPhase(payload: InstantLessonPhasePayload) {
  handlers.onPhase?.(payload);
}
