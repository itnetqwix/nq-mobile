import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NetqwixLogo } from "../../../components/brand/NetqwixLogo";
import { space, typography, useThemeColors } from "../../../theme";
import { getSystemStatePreset } from "../presets/systemStateRegistry";
import type { SystemStateId } from "../presets/types";
import type { ActionContext } from "../navigation/linkActions";
import { SystemStateActions } from "./SystemStateActions";
import { SystemStateHero } from "./SystemStateHero";

export type SystemStateLayoutProps = {
  stateId: SystemStateId;
  title?: string;
  description?: string;
  showBrand?: boolean;
  actionContext?: ActionContext;
  busy?: boolean;
  testID?: string;
};

export function SystemStateLayout({
  stateId,
  title: titleOverride,
  description: descriptionOverride,
  showBrand = true,
  actionContext,
  busy,
  testID,
}: SystemStateLayoutProps) {
  const preset = getSystemStatePreset(stateId);
  const title = titleOverride ?? preset.title;
  const description = descriptionOverride ?? preset.description;
  const insets = useSafeAreaInsets();
  const c = useThemeColors();

  return (
    <ScrollView
      testID={testID ?? `system-state-${stateId}`}
      contentContainerStyle={[
        styles.scroll,
        {
          paddingTop: insets.top + space.xl,
          paddingBottom: insets.bottom + space.xl,
          backgroundColor: c.background,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.inner}>
        {showBrand ? (
          <NetqwixLogo maxWidth={160} height={40} compact />
        ) : null}
        <SystemStateHero icon={preset.icon} variant={preset.variant} />
        <Text style={[typography.titleMd, styles.title, { color: c.text }]}>
          {title}
        </Text>
        {description ? (
          <Text
            style={[typography.bodyMd, styles.description, { color: c.textMuted }]}
          >
            {description}
          </Text>
        ) : null}
        <SystemStateActions
          primary={preset.primary}
          secondary={preset.secondary}
          supportLink={preset.supportLink}
          actionContext={actionContext}
          busy={busy}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: space.lg,
  },
  inner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 400,
  },
  title: {
    textAlign: "center",
    marginBottom: space.sm,
  },
  description: {
    textAlign: "center",
    maxWidth: 340,
    lineHeight: 22,
  },
});
