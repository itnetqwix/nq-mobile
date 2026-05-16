import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radii, shadows, space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import type { LockerTileConfig } from "./types";

type Props = {
  tile: LockerTileConfig;
  onPress: () => void;
};

export function LockerTile({ tile, onPress }: Props) {
  const c = useThemeColors();
  const styles = useThemedStyles((palette) => {
    const accents = {
      navy: { bg: `${palette.brandNavy}12`, fg: palette.brandNavy },
      sky: { bg: "#0ea5e912", fg: "#0369a1" },
      amber: { bg: "#f59e0b18", fg: "#b45309" },
      violet: { bg: "#8b5cf618", fg: "#6d28d9" },
    };
    const accent = accents[tile.accent];
    return StyleSheet.create({
      tile: {
        flex: 1,
        minWidth: "47%",
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surfaceElevated,
        padding: space.md,
        minHeight: 140,
        justifyContent: "space-between",
        ...shadows.sm,
      },
      top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
      iconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: accent.bg,
        alignItems: "center",
        justifyContent: "center",
      },
      title: {
        ...typography.subtitle,
        color: palette.text,
        fontWeight: "700",
        marginTop: space.sm,
      },
      subtitle: {
        ...typography.caption,
        color: palette.textMuted,
        marginTop: 4,
        lineHeight: 16,
      },
      ctaRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginTop: space.sm,
      },
      cta: {
        ...typography.caption,
        color: accent.fg,
        fontWeight: "700",
      },
    });
  });

  const accentFg =
    tile.accent === "navy"
      ? c.brandNavy
      : tile.accent === "sky"
        ? "#0369a1"
        : tile.accent === "amber"
          ? "#b45309"
          : "#6d28d9";

  return (
    <Pressable
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={tile.title}
    >
      <View>
        <View style={styles.top}>
          <View style={styles.iconWrap}>
            <Ionicons name={tile.icon} size={22} color={accentFg} />
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
        </View>
        <Text style={styles.title}>{tile.title}</Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {tile.subtitle}
        </Text>
      </View>
      <View style={styles.ctaRow}>
        <Text style={styles.cta}>Open</Text>
        <Ionicons name="arrow-forward" size={14} color={accentFg} />
      </View>
    </Pressable>
  );
}
