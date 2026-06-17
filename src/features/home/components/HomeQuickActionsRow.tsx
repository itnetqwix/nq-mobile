import { Ionicons } from "@expo/vector-icons";
import type { Ionicons as IconSet } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
  /** Shorter chips for scrollable quick-action rows. */
  compact?: boolean;
};

/**
 * Horizontal pill chips for quick navigation under the marketplace profile band.
 */
export function HomeQuickActionsRow({ actions, compact = false }: Props) {
  const c = useThemeColors();
  const styles = useStyles();

  if (!actions.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, compact && styles.rowCompact]}
    >
      {actions.map((action) => {
        const instant = action.variant === "instant";
        return (
          <Pressable
            key={action.id}
            onPress={action.onPress}
            style={({ pressed }) => [
              styles.chip,
              compact && styles.chipCompact,
              instant ? styles.chipInstant : styles.chipDefault,
              pressed && { opacity: 0.88 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={action.subtitle ? `${action.label}. ${action.subtitle}` : action.label}
          >
            <Ionicons
              name={action.icon}
              size={compact ? 14 : 15}
              color={instant ? c.warning : c.brandNavy}
            />
            <Text
              style={[styles.label, compact && styles.labelCompact, instant && { color: c.brandNavy }]}
              numberOfLines={1}
            >
              {action.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function useStyles() {
  const c = useThemeColors();
  return useThemedStyles((palette) =>
    StyleSheet.create({
      row: {
        flexDirection: "row",
        gap: space.xs,
        paddingHorizontal: space.md,
        paddingBottom: space.xs,
      },
      rowCompact: {
        paddingBottom: 4,
      },
      chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        borderRadius: radii.pill,
        borderWidth: 1,
        paddingVertical: 6,
        paddingHorizontal: 10,
      },
      chipCompact: {
        paddingVertical: 5,
        paddingHorizontal: 8,
        gap: 4,
      },
      chipDefault: {
        backgroundColor: palette.surfaceElevated,
        borderColor: palette.border,
      },
      chipInstant: {
        backgroundColor: palette.warningSubtle ?? palette.surfaceElevated,
        borderColor: `${c.warning}55`,
      },
      label: {
        ...typography.caption,
        fontSize: 12,
        fontWeight: "700",
        color: palette.text,
      },
      labelCompact: {
        fontSize: 11,
      },
    })
  );
}
