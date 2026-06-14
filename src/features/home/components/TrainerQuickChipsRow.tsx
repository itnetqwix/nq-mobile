import React, { useMemo } from "react";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { HomeQuickActionsRow, type HomeQuickAction } from "./HomeQuickActionsRow";

type Props = {
  onSchedule: () => void;
  onSessions: () => void;
  onClips: () => void;
};

/** Trainer home quick actions — Availability · Sessions · Clips */
export function TrainerQuickChipsRow({ onSchedule, onSessions, onClips }: Props) {
  const { t } = useAppTranslation();

  const actions = useMemo<HomeQuickAction[]>(
    () => [
      {
        id: "schedule",
        label: t("discoverHome.quickAvailability", { defaultValue: "Availability" }),
        subtitle: t("discoverHome.quickAvailabilitySub", { defaultValue: "Open slots" }),
        icon: "calendar-outline",
        onPress: onSchedule,
      },
      {
        id: "sessions",
        label: t("discoverHome.quickMySessions", { defaultValue: "Sessions" }),
        subtitle: t("discoverHome.quickMySessionsSub", { defaultValue: "Upcoming" }),
        icon: "time-outline",
        onPress: onSessions,
      },
      {
        id: "clips",
        label: t("discoverHome.quickClips", { defaultValue: "Clips" }),
        subtitle: t("discoverHome.quickClipsSubTrainer", { defaultValue: "Trainee media" }),
        icon: "film-outline",
        onPress: onClips,
      },
    ],
    [onClips, onSchedule, onSessions, t]
  );

  return <HomeQuickActionsRow actions={actions} compact />;
}
