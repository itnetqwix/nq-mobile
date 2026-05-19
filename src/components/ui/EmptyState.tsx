import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { getSystemStatePreset } from "../../features/system-states/presets/systemStateRegistry";
import type { SystemStateId } from "../../features/system-states/presets/types";
import { runSystemStateAction } from "../../features/system-states/navigation/linkActions";
import { space, typography, useThemeColors, useThemedStyles } from "../../theme";
import { Button } from "./Button";

export type EmptyStateProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  title?: string;
  description?: string;
  /** Shorthand for list/search empty copy from the system-state registry. */
  preset?: SystemStateId;
  actionLabel?: string;
  onAction?: () => void;
};

/** Universal empty-state for lists. Drop in wherever a screen shows nothing. */
export function EmptyState({
  icon: iconProp,
  title: titleProp,
  description: descriptionProp,
  preset,
  actionLabel: actionLabelProp,
  onAction: onActionProp,
}: EmptyStateProps) {
  const presetConfig = preset ? getSystemStatePreset(preset) : null;
  const icon = iconProp ?? presetConfig?.icon ?? "leaf-outline";
  const title =
    (titleProp && titleProp.length > 0 ? titleProp : undefined) ??
    presetConfig?.title ??
    "Nothing here";
  const description =
    descriptionProp !== undefined && descriptionProp !== ""
      ? descriptionProp
      : presetConfig?.description;
  const actionLabel =
    actionLabelProp ?? presetConfig?.primary?.label;
  const onAction =
    onActionProp ??
    (presetConfig?.primary
      ? () => void runSystemStateAction(presetConfig.primary!.action)
      : undefined);

  const c = useThemeColors();
  const styles = useThemedStyles((colors) =>
    StyleSheet.create({
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
    })
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.iconHalo}>
        <Ionicons name={icon} size={36} color={c.brandAccent} />
      </View>
      <Text style={[typography.titleSm, { color: c.text, textAlign: "center" }]}>
        {title}
      </Text>
      {description ? (
        <Text
          style={[
            typography.bodyMd,
            { color: c.textMuted, textAlign: "center" },
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
