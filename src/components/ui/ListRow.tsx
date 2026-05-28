/**
 * ListRow — settings/menu row with optional icon, subtitle, and adornment.
 * Used everywhere a tap routes to another screen.
 */

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { layout, radii, space, typography, useThemeColors, useThemedStyles } from "../../theme";

export type ListRowProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  iconTint?: string;
  title: string;
  subtitle?: string;
  /** Render any custom adornment on the right (e.g. a switch). Defaults to a
   *  chevron when `onPress` is provided. */
  rightAdornment?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  /** Hide the trailing chevron even when `onPress` is set. */
  hideChevron?: boolean;
  accessibilityLabel?: string;
};

export function ListRow({
  icon,
  iconTint,
  title,
  subtitle,
  rightAdornment,
  onPress,
  destructive,
  hideChevron,
  accessibilityLabel,
}: ListRowProps) {
  const c = useThemeColors();
  const styles = useThemedStyles((colors) =>
    StyleSheet.create({
      row: {
        flexDirection: "row",
        alignItems: "center",
        minHeight: layout.minTapTarget,
        paddingHorizontal: space.md,
        paddingVertical: 10,
        gap: space.md,
      },
      iconBox: {
        width: 36,
        height: 36,
        borderRadius: radii.sm,
        backgroundColor: colors.brandSubtle,
        alignItems: "center",
        justifyContent: "center",
      },
      text: { flex: 1, gap: 2 },
      right: { marginLeft: "auto", flexShrink: 0 },
    })
  );

  const titleColor = destructive ? c.danger : c.text;
  const tint = iconTint ?? (destructive ? c.danger : c.brandNavy);

  const content = (
    <>
      {icon ? (
        <View style={[styles.iconBox, destructive && { backgroundColor: c.dangerSubtle }]}>
          <Ionicons name={icon} size={20} color={tint} />
        </View>
      ) : null}
      <View style={[styles.text, { minWidth: 0 }]}>
        <Text
          style={[typography.subtitle, { color: titleColor, flexShrink: 1 }]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[typography.bodySm, { color: c.textMuted, flexShrink: 1 }]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightAdornment ? (
        <View style={styles.right}>{rightAdornment}</View>
      ) : onPress && !hideChevron ? (
        <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.surface }]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.row}>{content}</View>;
}
