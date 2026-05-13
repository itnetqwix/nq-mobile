import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, space, typography } from "../../theme";
import { Button } from "./Button";

export type EmptyStateProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Universal empty-state for lists. Drop in wherever a screen shows nothing. */
export function EmptyState({
  icon = "leaf-outline",
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconHalo}>
        <Ionicons name={icon} size={36} color={colors.brandAccent} />
      </View>
      <Text style={[typography.titleSm, { color: colors.text, textAlign: "center" }]}>
        {title}
      </Text>
      {description ? (
        <Text
          style={[
            typography.bodyMd,
            { color: colors.textMuted, textAlign: "center" },
          ]}
        >
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} fullWidth={false} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
  },
  iconHalo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brandAccentSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.sm,
  },
});
