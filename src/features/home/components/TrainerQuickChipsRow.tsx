import React, { useMemo } from "react";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import {
  HomeCategoryChipsRow,
  type HomeCategoryChip,
} from "./HomeCategoryChipsRow";

type Props = {
  onSchedule: () => void;
  onSessions: () => void;
  onClips: () => void;
};

/** Trainer home quick actions — Schedule (→ Availability) · Sessions (→ My Sessions) · Clips */
export function TrainerQuickChipsRow({ onSchedule, onSessions, onClips }: Props) {
  const { t } = useAppTranslation();

  const items = useMemo<HomeCategoryChip[]>(
    () => [
      {
        id: "schedule",
        label: t("trainerDashboard.quickAvailability", { defaultValue: "Availability" }),
        icon: "calendar-outline",
      },
      {
        id: "sessions",
        label: t("trainerDashboard.quickMySessions", { defaultValue: "My Sessions" }),
        icon: "time-outline",
      },
      {
        id: "clips",
        label: t("trainerDashboard.quickClips", { defaultValue: "Clips" }),
        icon: "film-outline",
      },
    ],
    [t]
  );

  const handleSelect = (id: string | null) => {
    if (!id) return;
    switch (id) {
      case "schedule":
        onSchedule();
        break;
      case "sessions":
        onSessions();
        break;
      case "clips":
        onClips();
        break;
    }
  };

  return (
    <HomeCategoryChipsRow
      items={items}
      selectedId={null}
      onSelect={handleSelect}
      showTabUnderline={false}
    />
  );
}
