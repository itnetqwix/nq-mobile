import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radii, shadows, space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import type { LockerTileConfig } from "./types";

type Props = {
  tile: LockerTileConfig;
  onPress: () => void;
  variant?: "grid" | "compact";
};

export function LockerTile({ tile, onPress, variant = "grid" }: Props) {
  const c = useThemeColors();
  const compact = variant === "compact";

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
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surfaceElevated,
        padding: compact ? space.xs : space.sm,
        justifyContent: "space-between",
        gap: compact ? space.xxs : space.xs,
        ...shadows.sm,
        ...(compact
          ? { width: 156, minHeight: 108 }
          : { width: "48%", minHeight: 100 }),
      },
      row: { flexDirection: "row", alignItems: "center", gap: space.sm },
      iconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: accent.bg,
        alignItems: "center",
        justifyContent: "center",
      },
      textBlock: { flex: 1, minWidth: 0 },
      title: {
        fontSize: 14,
        lineHeight: 18,
        color: palette.text,
        fontWeight: "700",
      },
      subtitle: {
        fontSize: 11,
        lineHeight: 14,
        color: palette.textMuted,
        marginTop: 1,
      },
      ctaRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginTop: compact ? space.xxs : space.xs,
      },
      cta: {
        fontSize: 11,
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
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons name={tile.icon} size={compact ? 16 : 18} color={accentFg} />
        </View>
        {compact ? (
          <View style={styles.textBlock}>
            <Text style={styles.title} numberOfLines={1}>
              {tile.title}
            </Text>
          </View>
        ) : null}
      </View>
      {!compact ? (
        <View style={styles.textBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {tile.title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {tile.subtitle}
          </Text>
        </View>
      ) : (
        <Text style={styles.subtitle} numberOfLines={2}>
          {tile.subtitle}
        </Text>
      )}
      <View style={styles.ctaRow}>
        <Text style={styles.cta}>Open</Text>
        <Ionicons name="arrow-forward" size={11} color={accentFg} />
      </View>
    </Pressable>
  );
}
