import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { UtilitySurfaceId } from "../../config/shellSurfaces";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { lockerTilesForRole } from "./lockerConfig";
import { HomeSection } from "./HomeSection";
import { LockerTile } from "./LockerTile";
import type { LockerTileId } from "./types";

type Props = {
  accountType: string | null;
  onOpenSurface: (id: UtilitySurfaceId) => void;
};

const TILE_TO_SURFACE: Record<LockerTileId, UtilitySurfaceId> = {
  clips: "clips",
  gamePlans: "gamePlans",
  savedLessons: "savedLessons",
  invite: "invite",
};

export function LockerHub({ accountType, onOpenSurface }: Props) {
  const c = useThemeColors();
  const tiles = lockerTilesForRole(accountType);
  const styles = useThemedStyles((palette) =>
    StyleSheet.create({
      hero: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        paddingHorizontal: space.md,
        paddingVertical: space.md,
        backgroundColor: `${palette.brandNavy}0D`,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: palette.border,
      },
      heroIcon: {
        width: 48,
        height: 48,
        borderRadius: radii.md,
        backgroundColor: palette.brandNavy,
        alignItems: "center",
        justifyContent: "center",
      },
      heroTitle: {
        ...typography.subtitle,
        color: palette.text,
        fontWeight: "700",
      },
      heroSubtitle: {
        ...typography.caption,
        color: palette.textMuted,
        marginTop: 2,
        lineHeight: 18,
      },
      grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: space.sm,
        padding: space.md,
      },
    })
  );

  if (tiles.length === 0) return null;

  return (
    <HomeSection
      title="Locker"
      subtitle="Your training library — synced with the web"
      testID="home-locker-hub"
    >
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="lock-closed" size={22} color={c.brandTextOn} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.heroTitle}>Everything in one place</Text>
          <Text style={styles.heroSubtitle}>
            Clips, game plans, saved lessons, and invites — pick up where you left off.
          </Text>
        </View>
      </View>
      <View style={styles.grid}>
        {tiles.map((tile) => (
          <LockerTile
            key={tile.id}
            tile={tile}
            onPress={() => onOpenSurface(TILE_TO_SURFACE[tile.id])}
          />
        ))}
      </View>
    </HomeSection>
  );
}
