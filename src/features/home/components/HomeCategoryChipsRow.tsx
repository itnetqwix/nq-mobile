import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Ionicons as IconSet } from "@expo/vector-icons";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";

export type HomeCategoryChip = {
  id: string;
  label: string;
  icon?: keyof typeof IconSet.glyphMap;
};

type Props = {
  items: HomeCategoryChip[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** @deprecated Underline removed — active chip uses filled pill style. */
  showTabUnderline?: boolean;
};

/**
 * Horizontal sport/category filter — compact pills with icon + label inline.
 */
export function HomeCategoryChipsRow({ items, selectedId, onSelect }: Props) {
  const c = useThemeColors();
  const styles = useStyles();

  return (
    <View style={styles.shell}>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
        decelerationRate="fast"
      >
        {items.map((item) => {
          const active =
            item.id === "__all__"
              ? selectedId === null || selectedId === "__all__"
              : selectedId === item.id;
          return (
            <Pressable
              key={item.id}
              style={({ pressed }) => [
                styles.chip,
                active ? styles.chipActive : styles.chipIdle,
                pressed && { opacity: 0.9 },
              ]}
              onPress={() => {
                if (item.id === "__all__") onSelect(null);
                else onSelect(item.id);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <View
                style={[
                  styles.iconBadge,
                  active ? styles.iconBadgeActive : styles.iconBadgeIdle,
                ]}
              >
                <Ionicons
                  name={item.icon ?? "ellipse-outline"}
                  size={14}
                  color={active ? c.brandTextOn : c.brandNavy}
                />
              </View>
              <Text
                style={[styles.label, active && styles.labelActive]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function useStyles() {
  const c = useThemeColors();
  return useThemedStyles((palette) =>
    StyleSheet.create({
      shell: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: palette.border,
        backgroundColor: palette.surface,
      },
      strip: {
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        gap: space.xs,
        alignItems: "center",
      },
      chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radii.pill,
        minHeight: 36,
        maxWidth: 148,
      },
      chipIdle: {
        backgroundColor: palette.surfaceElevated,
        borderWidth: 1,
        borderColor: palette.border,
      },
      chipActive: {
        backgroundColor: c.brandNavy,
        borderWidth: 1,
        borderColor: c.brandNavy,
      },
      iconBadge: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center",
      },
      iconBadgeIdle: {
        backgroundColor: palette.brandSubtle,
      },
      iconBadgeActive: {
        backgroundColor: "rgba(255,255,255,0.18)",
      },
      label: {
        ...typography.caption,
        fontSize: 12,
        fontWeight: "600",
        color: palette.textSecondary,
        flexShrink: 1,
      },
      labelActive: {
        color: c.brandTextOn,
        fontWeight: "700",
      },
    })
  );
}
