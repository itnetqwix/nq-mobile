import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { space, typography, useThemeColors } from "../../theme";

type Props = {
  label: string | null;
  loading?: boolean;
};

/** Shown above card Payment Sheet CTAs when a default saved card exists on file. */
export function SavedCardHint({ label, loading }: Props) {
  const c = useThemeColors();
  if (loading || !label) return null;
  return (
    <View style={styles.row}>
      <Ionicons name="card-outline" size={16} color={c.iconPrimary} />
      <Text style={[styles.text, { color: c.textMuted }]}>
        Default card on file: {label}. You can pick another in the payment sheet.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.xs,
    marginBottom: space.sm,
  },
  text: {
    ...typography.caption,
    flex: 1,
    lineHeight: 18,
  },
});
