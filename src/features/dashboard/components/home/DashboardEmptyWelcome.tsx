import React from "react";
import { EmptyState } from "../../../../components/ui";
import { useAuth } from "../../../auth/context/AuthContext";
import { AccountType } from "../../../../constants/accountType";

type Props = {
  onBookLesson: () => void;
  onOpenClips: () => void;
};

/** Shown on home when the user has no sessions yet. */
export function DashboardEmptyWelcome({ onBookLesson, onOpenClips }: Props) {
  const { accountType } = useAuth();
  const isTrainer = accountType === AccountType.TRAINER;

  return (
    <EmptyState
      icon="home-outline"
      title={isTrainer ? "Welcome, coach" : "Welcome to NetQwix"}
      description={
        isTrainer
          ? "Your dashboard will show session requests, trainees, and clips once activity starts."
          : "Book your first lesson or explore clips to get started."
      }
      actionLabel={isTrainer ? "View schedule" : "Book a lesson"}
      onAction={onBookLesson}
    />
  );
}
