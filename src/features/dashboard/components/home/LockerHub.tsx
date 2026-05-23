import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { UtilitySurfaceId } from "../../config/shellSurfaces";
import { space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
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
      hint: {
        ...typography.caption,
        color: palette.textMuted,
        paddingBottom: space.sm,
      },
      scrollContent: {
        paddingBottom: space.md,
        gap: space.sm,
      },
    })
  );

  if (tiles.length === 0) return null;

  return (
    <HomeSection
      title="Locker"
      subtitle="Clips, game plans & saved lessons"
      testID="home-locker-hub"
      bare
    >
      <Text style={styles.hint}>Swipe for more →</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
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
      <View style={{ paddingBottom: space.xs }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="lock-closed" size={14} color={c.textMuted} />
          <Text style={[typography.caption, { color: c.textMuted, flex: 1 }]}>
            Synced with your web locker
          </Text>
        </View>
      </View>
    </HomeSection>
  );
}
