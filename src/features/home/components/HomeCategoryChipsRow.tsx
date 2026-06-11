import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Ionicons as IconSet } from "@expo/vector-icons";
import { space, typography, useThemeColors, useThemedStyles } from "../../../theme";

export type HomeCategoryChip = {
  id: string;
  label: string;
  icon?: keyof typeof IconSet.glyphMap;
};

type Props = {
  items: HomeCategoryChip[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Underline on active chip (Blinkit category tabs). */
  showTabUnderline?: boolean;
};

/**
 * Horizontal category / quick-action chips (Blinkit-style).
 */
export function HomeCategoryChipsRow({
  items,
  selectedId,
  onSelect,
  showTabUnderline = true,
}: Props) {
  const c = useThemeColors();
  const styles = useStyles();

  return (
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
            style={styles.chipWrap}
            onPress={() => {
              if (item.id === "__all__") onSelect(null);
              else onSelect(item.id);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <Ionicons
                name={item.icon ?? "ellipse-outline"}
                size={16}
                color={active ? c.brandTextOn : c.brandNavy}
              />
            </View>
            <Text
              style={[styles.label, active && styles.labelActive]}
              numberOfLines={1}
            >
              {item.label}
            </Text>
            {showTabUnderline && active ? (
              <View style={[styles.underline, { backgroundColor: c.brandNavy }]} />
            ) : null}
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
      strip: {
        paddingHorizontal: space.md,
        paddingBottom: space.xs,
        paddingTop: space.xs,
        gap: space.sm,
      },
      chipWrap: {
        alignItems: "center",
        width: 54,
        minHeight: 52,
      },
      iconWrap: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: palette.brandSubtle,
        borderWidth: 1,
        borderColor: palette.brandAccentSubtle,
        alignItems: "center",
        justifyContent: "center",
      },
      iconWrapActive: {
        backgroundColor: c.brandNavy,
        borderColor: c.brandNavy,
      },
      label: {
        fontSize: 10,
        fontWeight: "600",
        color: palette.textMuted,
        textAlign: "center",
        marginTop: 3,
        lineHeight: 13,
      },
      labelActive: {
        color: palette.brandNavy,
        fontWeight: "700",
      },
      underline: {
        marginTop: 4,
        height: 2,
        width: 20,
        borderRadius: 1,
      },
    })
  );
}
