export type WizardStep = "intro" | "duration" | "clips" | "payment" | "confirm";

/** Trainer row from `fetchOnlineUsers` — kept loose for API shape drift. */
export type WizardTrainer = Record<string, unknown> | null;

export type InstantLessonBookingWizardModalProps = {
  visible: boolean;
  trainer: WizardTrainer;
  onDismiss: () => void;
};
