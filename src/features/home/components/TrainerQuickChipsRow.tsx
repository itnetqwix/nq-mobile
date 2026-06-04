import React, { useMemo } from "react";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import {
  HomeCategoryChipsRow,
  type HomeCategoryChip,
} from "./HomeCategoryChipsRow";

type Props = {
  onSchedule: () => void;
  onSessions: () => void;
  onWallet?: () => void;
  onClips: () => void;
  onGoLive?: () => void;
};

/** Trainer home quick actions as Blinkit-style chips. */
export function TrainerQuickChipsRow({
  onSchedule,
  onSessions,
  onWallet,
  onClips,
  onGoLive,
}: Props) {
  const { t } = useAppTranslation();

  const items = useMemo<HomeCategoryChip[]>(() => {
    const row: HomeCategoryChip[] = [
      {
        id: "schedule",
        label: t("trainerDashboard.quickSchedule", { defaultValue: "Schedule" }),
        icon: "calendar-outline",
      },
      {
        id: "sessions",
        label: t("trainerDashboard.quickSessions", { defaultValue: "Sessions" }),
        icon: "time-outline",
      },
    ];
    if (onWallet) {
      row.push({
        id: "wallet",
        label: t("trainerDashboard.quickWallet", { defaultValue: "Wallet" }),
        icon: "wallet-outline",
      });
    }
    row.push({
      id: "clips",
      label: t("trainerDashboard.quickClips", { defaultValue: "Clips" }),
      icon: "film-outline",
    });
    if (onGoLive) {
      row.push({
        id: "live",
        label: t("trainerDashboard.quickGoLive", { defaultValue: "Go live" }),
        icon: "radio-outline",
      });
    }
    return row;
  }, [t, onWallet, onGoLive]);

  const handleSelect = (id: string | null) => {
    if (!id) return;
    switch (id) {
      case "schedule":
        onSchedule();
        break;
      case "sessions":
        onSessions();
        break;
      case "wallet":
        onWallet?.();
        break;
      case "clips":
        onClips();
        break;
      case "live":
        onGoLive?.();
        break;
      default:
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
