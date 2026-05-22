export type TrainerIncoming = {
  lessonId: string;
  coachId: string;
  traineeId: string;
  traineeInfo: { _id: string; fullname: string; profile_picture?: string };
  expiresAt: number;
  joinDeadlineAt?: number;
  step: "incoming" | "accepted";
  minimized?: boolean;
  duration?: number;
  lessonType?: string;
};

export type TraineeBooking = {
  lessonId: string;
  coachId: string;
  traineeId: string;
  trainerName: string;
  step: "waiting" | "accepted" | "declined" | "expired";
  acceptDeadlineAt?: number;
  joinDeadlineAt?: number;
  minimized?: boolean;
};
