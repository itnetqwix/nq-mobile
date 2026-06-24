import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { UtilitySurfaceId } from "../../config/shellSurfaces";
import { space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { lockerTilesForRole } from "./lockerConfig";
import { LockerTile } from "./LockerTile";
import type { LockerTileId } from "./types";

const TILE_TO_SURFACE: Record<LockerTileId, UtilitySurfaceId> = {
  clips: "clips",
  gamePlans: "gamePlans",
  savedLessons: "savedLessons",
  invite: "invite",
};

type Props = {
  accountType: string | null;
  onOpenSurface: (id: UtilitySurfaceId) => void;
};

/** Two-column locker shortcuts — shared by trainee home and trainer hub. */
export function LockerGrid({ accountType, onOpenSurface }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const tiles = lockerTilesForRole(accountType);
  const styles = useStyles();

  if (!tiles.length) return null;

  return (
    <View style={styles.root}>
      <View style={styles.grid}>
        {tiles.map((tile) => (
          <LockerTile
            key={tile.id}
            tile={tile}
            variant="grid"
            onPress={() => onOpenSurface(TILE_TO_SURFACE[tile.id])}
          />
        ))}
      </View>
      <View style={styles.footer}>
        <Ionicons name="lock-closed" size={14} color={c.textMuted} />
        <Text style={styles.footerText}>
          {t("trainerDashboard.lockerSynced", {
            defaultValue: "Synced with your web locker",
          })}
        </Text>
      </View>
    </View>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      root: { gap: space.sm },
      grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        rowGap: space.sm,
      },
      footer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingTop: space.xs,
      },
      footerText: { ...typography.caption, color: palette.textMuted, flex: 1 },
    })
  );
}
