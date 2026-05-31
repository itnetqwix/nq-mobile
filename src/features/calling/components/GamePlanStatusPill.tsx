import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radii, space, typography, useThemedStyles, useThemeColors } from "../../../theme";

type Props = {
  title: string;
  subtitle: string;
  onPress?: () => void;
  onDismiss?: () => void;
};

/** In-call banner when the coach shares or updates a game plan. */
export function GamePlanStatusPill({ title, subtitle, onPress, onDismiss }: Props) {
  const c = useThemeColors();
  const styles = useStyles();

  return (
    <View style={[styles.wrap, { backgroundColor: c.brandSubtle, borderColor: c.border }]}>
      <Ionicons name="document-text-outline" size={20} color={c.brandNavy} />
      <Pressable style={styles.copy} onPress={onPress} disabled={!onPress}>
        <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.sub, { color: c.textMuted }]} numberOfLines={2}>
          {subtitle}
        </Text>
      </Pressable>
      {onDismiss ? (
        <Pressable onPress={onDismiss} hitSlop={8} accessibilityLabel="Dismiss">
          <Ionicons name="close" size={18} color={c.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

function useStyles() {
  return useThemedStyles(() =>
    StyleSheet.create({
      wrap: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        marginHorizontal: space.md,
        marginBottom: space.sm,
        paddingVertical: space.sm,
        paddingHorizontal: space.md,
        borderRadius: radii.md,
        borderWidth: StyleSheet.hairlineWidth,
      },
      copy: { flex: 1, gap: 2 },
      title: { ...typography.label, fontWeight: "800" },
      sub: { ...typography.caption, lineHeight: 16 },
    })
  );
}
