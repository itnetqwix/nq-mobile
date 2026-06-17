import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { UtilitySurfaceId } from "../../config/shellSurfaces";
import { lockerTilesForRole } from "../home/lockerConfig";
import { LockerTile } from "../home/LockerTile";
import type { LockerTileId } from "../home/types";
import { DashboardSection } from "../shared/DashboardSection";
import { TrainerRecentTraineesSection } from "./TrainerRecentTraineesSection";
import { space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";

type Props = {
  accountType: string | null;
  onOpenSurface: (id: UtilitySurfaceId) => void;
  recentTrainees?: Record<string, unknown>[];
  onSelectTrainee?: (trainee: Record<string, unknown>) => void;
};

const TILE_TO_SURFACE: Record<LockerTileId, UtilitySurfaceId> = {
  clips: "clips",
  gamePlans: "gamePlans",
  savedLessons: "savedLessons",
  invite: "invite",
};

export function TrainerLockerSection({
  accountType,
  onOpenSurface,
  recentTrainees = [],
  onSelectTrainee,
}: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const tiles = lockerTilesForRole(accountType);
  const styles = useStyles();
  if (!tiles.length && !recentTrainees.length) return null;

  return (
    <DashboardSection
      embedded
      title={t("trainerDashboard.lockerTitle")}
      subtitle={t("trainerDashboard.lockerSubtitle")}
      testID="home-locker-hub"
    >
      {recentTrainees.length > 0 ? (
        <TrainerRecentTraineesSection
          trainees={recentTrainees}
          onSelectTrainee={onSelectTrainee}
        />
      ) : null}

      {tiles.length > 0 ? (
        <>
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.strip}
            decelerationRate="fast"
            snapToInterval={168}
          >
            {tiles.map((tile) => (
              <LockerTile
                key={tile.id}
                tile={tile}
                variant="compact"
                onPress={() => onOpenSurface(TILE_TO_SURFACE[tile.id])}
              />
            ))}
          </ScrollView>
          <View style={styles.footer}>
            <Ionicons name="lock-closed" size={14} color={c.textMuted} />
            <Text style={styles.footerText}>{t("trainerDashboard.lockerSynced")}</Text>
          </View>
        </>
      ) : null}
    </DashboardSection>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      strip: { gap: space.sm, paddingVertical: space.xs },
      footer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginTop: space.sm,
      },
      footerText: { ...typography.caption, color: palette.textMuted, flex: 1 },
    })
  );
}
