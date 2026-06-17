import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, radii, space, typography } from "../../theme";

export type SegmentOption<T extends string> = {
  key: T;
  label: string;
  badge?: number | string;
};

type SegmentedControlProps<T extends string> = {
  options: SegmentOption<T>[];
  value: T | null;
  onChange: (key: T) => void;
  style?: StyleProp<ViewStyle>;
  /** Allow horizontal scroll when many segments (friends secondary row). */
  scrollable?: boolean;
  compact?: boolean;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  style,
  scrollable = false,
  compact = false,
}: SegmentedControlProps<T>) {
  const row = (
    <View style={[styles.row, compact && styles.rowCompact, style]}>
      {options.map((opt) => {
        const active = value != null && opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[
              styles.segment,
              scrollable && styles.segmentScrollable,
              compact && styles.segmentCompact,
              active && styles.segmentActive,
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[styles.segmentText, compact && styles.segmentTextCompact, active && styles.segmentTextActive]}
              numberOfLines={1}
            >
              {opt.label}
              {opt.badge != null && opt.badge !== 0 ? (
                <Text style={styles.badge}> {opt.badge}</Text>
              ) : null}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {row}
      </ScrollView>
    );
  }

  return row;
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: space.md },
  row: {
    flexDirection: "row",
    marginHorizontal: space.md,
    marginVertical: space.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    gap: 4,
  },
  rowCompact: {
    marginHorizontal: space.sm,
    marginVertical: 0,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
  },
  segmentCompact: {
    flex: 0,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    minHeight: 32,
  },
  segmentScrollable: { flex: 0, minWidth: 88 },
  segmentActive: { backgroundColor: colors.brandNavy },
  segmentText: {
    ...typography.label,
    color: colors.textMuted,
    fontWeight: "600",
    fontSize: 13,
  },
  segmentTextCompact: { fontSize: 12 },
  segmentTextActive: { color: colors.brandTextOn },
  badge: { fontSize: 12, color: colors.danger, fontWeight: "700" },
});
