import React from "react";
import type { UtilitySurfaceId } from "../../config/shellSurfaces";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { lockerTilesForRole } from "./lockerConfig";
import { HomeSection } from "./HomeSection";
import { LockerGrid } from "./LockerGrid";

type Props = {
  accountType: string | null;
  onOpenSurface: (id: UtilitySurfaceId) => void;
};

export function LockerHub({ accountType, onOpenSurface }: Props) {
  const { t } = useAppTranslation();
  const tiles = lockerTilesForRole(accountType);

  if (tiles.length === 0) return null;

  return (
    <HomeSection
      title={t("trainerDashboard.lockerTitle", { defaultValue: "Locker" })}
      subtitle={t("trainerDashboard.lockerSubtitle", {
        defaultValue: "Clips, game plans & saved lessons",
      })}
      testID="home-locker-hub"
      bare
    >
      <LockerGrid accountType={accountType} onOpenSurface={onOpenSurface} />
    </HomeSection>
  );
}
