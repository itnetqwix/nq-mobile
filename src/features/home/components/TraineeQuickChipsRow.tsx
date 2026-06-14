import React, { useMemo } from "react";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { HomeQuickActionsRow, type HomeQuickAction } from "./HomeQuickActionsRow";

type Props = {
  onInstant: () => void;
  onBookNow: () => void;
  onClips: () => void;
};

/** Trainee home quick actions — Instant · Book now · Clips (no availability management). */
export function TraineeQuickChipsRow({ onInstant, onBookNow, onClips }: Props) {
  const { t } = useAppTranslation();

  const actions = useMemo<HomeQuickAction[]>(
    () => [
      {
        id: "instant",
        label: t("discoverHome.quickInstant", { defaultValue: "Instant" }),
        subtitle: t("discoverHome.quickInstantSub", { defaultValue: "Live coaches" }),
        icon: "flash-outline",
        variant: "instant",
        onPress: onInstant,
      },
      {
        id: "book",
        label: t("discoverHome.quickBookNow", { defaultValue: "Book now" }),
        subtitle: t("discoverHome.quickBookNowSub", { defaultValue: "All coaches" }),
        icon: "search-outline",
        onPress: onBookNow,
      },
      {
        id: "clips",
        label: t("discoverHome.quickClips", { defaultValue: "Clips" }),
        subtitle: t("discoverHome.quickClipsSub", { defaultValue: "Your library" }),
        icon: "film-outline",
        onPress: onClips,
      },
    ],
    [onBookNow, onClips, onInstant, t]
  );

  return <HomeQuickActionsRow actions={actions} compact />;
}
