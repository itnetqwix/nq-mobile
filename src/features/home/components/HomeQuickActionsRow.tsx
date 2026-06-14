import { Ionicons } from "@expo/vector-icons";
import type { Ionicons as IconSet } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";

export type HomeQuickAction = {
  id: string;
  label: string;
  subtitle?: string;
  icon: keyof typeof IconSet.glyphMap;
  onPress: () => void;
  /** Highlights instant / go-live style actions. */
  variant?: "default" | "instant";
};

type Props = {
  actions: HomeQuickAction[];
  /** Shorter tiles for scrollable quick-action rows. */
  compact?: boolean;
};

/**
 * Three-up quick navigation tiles under the marketplace profile band.
 */
export function HomeQuickActionsRow({ actions, compact = false }: Props) {
  const c = useThemeColors();
  const styles = useStyles();

  if (!actions.length) return null;

  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      {actions.slice(0, 3).map((action) => {
        const instant = action.variant === "instant";
        return (
          <Pressable
            key={action.id}
            onPress={action.onPress}
            style={({ pressed }) => [
              styles.tile,
              compact && styles.tileCompact,
              instant ? styles.tileInstant : styles.tileDefault,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel={action.subtitle ? `${action.label}. ${action.subtitle}` : action.label}
          >
            <View
              style={[
                styles.iconWrap,
                compact && styles.iconWrapCompact,
                instant
                  ? { backgroundColor: `${c.warning}22` }
                  : { backgroundColor: c.brandSubtle },
              ]}
            >
              <Ionicons
                name={action.icon}
                size={compact ? 16 : 18}
                color={instant ? c.warning : c.brandNavy}
              />
            </View>
            <Text
              style={[styles.label, compact && styles.labelCompact, instant && { color: c.brandNavy }]}
              numberOfLines={1}
            >
              {action.label}
            </Text>
            {action.subtitle ? (
              <Text style={[styles.subtitle, compact && styles.subtitleCompact]} numberOfLines={1}>
                {action.subtitle}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function useStyles() {
  const c = useThemeColors();
  return useThemedStyles((palette) =>
    StyleSheet.create({
      row: {
        flexDirection: "row",
        gap: space.sm,
        paddingHorizontal: space.md,
        paddingBottom: space.sm,
      },
      rowCompact: {
        paddingBottom: space.xs,
      },
      tile: {
        flex: 1,
        minWidth: 0,
        borderRadius: radii.md,
        borderWidth: 1,
        paddingVertical: space.sm,
        paddingHorizontal: space.xs,
        alignItems: "center",
        gap: 4,
      },
      tileCompact: {
        paddingVertical: 6,
        gap: 2,
      },
      tileDefault: {
        backgroundColor: palette.surfaceElevated,
        borderColor: palette.border,
      },
      tileInstant: {
        backgroundColor: palette.warningSubtle ?? palette.surfaceElevated,
        borderColor: `${c.warning}55`,
      },
      iconWrap: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
      },
      iconWrapCompact: {
        width: 28,
        height: 28,
        borderRadius: 14,
      },
      label: {
        ...typography.caption,
        fontSize: 11,
        fontWeight: "700",
        color: palette.text,
        textAlign: "center",
      },
      labelCompact: {
        fontSize: 10,
      },
      subtitle: {
        ...typography.caption,
        fontSize: 10,
        color: palette.textMuted,
        textAlign: "center",
      },
      subtitleCompact: {
        fontSize: 9,
      },
    })
  );
}
