import React from "react";
import type { UtilitySurfaceId } from "../../config/shellSurfaces";
import { lockerTilesForRole } from "../home/lockerConfig";
import { LockerGrid } from "../home/LockerGrid";
import { DashboardSection } from "../shared/DashboardSection";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";

type Props = {
  accountType: string | null;
  onOpenSurface: (id: UtilitySurfaceId) => void;
};

export function TrainerLockerSection({ accountType, onOpenSurface }: Props) {
  const { t } = useAppTranslation();
  const tiles = lockerTilesForRole(accountType);
  if (!tiles.length) return null;

  return (
    <DashboardSection
      embedded
      title={t("trainerDashboard.lockerTitle")}
      subtitle={t("trainerDashboard.lockerSubtitle")}
      testID="home-locker-hub"
    >
      <LockerGrid accountType={accountType} onOpenSurface={onOpenSurface} />
    </DashboardSection>
  );
}
