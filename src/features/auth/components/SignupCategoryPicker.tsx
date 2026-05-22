import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getCategoryIcon } from "../../../lib/categoryIcons";
import { colors, radii, space, typography } from "../../../theme";

const SKIP = new Set(["choose category"]);

type Props = {
  categories: string[];
  selected: string | null;
  onSelect: (category: string) => void;
  loading?: boolean;
};

export function SignupCategoryPicker({
  categories,
  selected,
  onSelect,
  loading,
}: Props) {
  const items = useMemo(
    () =>
      categories
        .map((c) => c.trim())
        .filter((c) => c.length > 0 && !SKIP.has(c.toLowerCase())),
    [categories]
  );

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brandNavy} />
      </View>
    );
  }

  if (!items.length) {
    return (
      <Text style={styles.empty}>
        Categories could not be loaded. Check your connection and try again.
      </Text>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item}
      numColumns={3}
      scrollEnabled
      nestedScrollEnabled
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.grid}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => {
        const active = selected === item;
        const icon = getCategoryIcon(item);
        return (
          <Pressable
            onPress={() => onSelect(item)}
            style={[styles.tile, active && styles.tileActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item}
          >
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <Ionicons
                name={icon}
                size={22}
                color={active ? colors.brandTextOn : colors.brandNavy}
              />
            </View>
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={2}>
              {item}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  grid: { paddingBottom: space.md, gap: space.sm },
  row: { gap: space.sm },
  tile: {
    flex: 1,
    minWidth: "30%",
    maxWidth: "33%",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  tileActive: {
    borderColor: colors.brandAccent,
    backgroundColor: colors.brandAccentSubtle,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
    marginBottom: 6,
  },
  iconWrapActive: {
    backgroundColor: colors.brandNavy,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "600",
    textAlign: "center",
    fontSize: 11,
    lineHeight: 14,
  },
  labelActive: { color: colors.brandNavy },
  loading: { paddingVertical: space.xl, alignItems: "center" },
  empty: { ...typography.bodySm, color: colors.textMuted, textAlign: "center" },
});
