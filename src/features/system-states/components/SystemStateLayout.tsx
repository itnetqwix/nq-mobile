import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NetqwixLogo } from "../../../components/brand/NetqwixLogo";
import { space, typography, useThemeColors } from "../../../theme";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { getLocalizedSystemStatePreset } from "../../../i18n/systemStateI18n";
import type { SystemStateId } from "../presets/types";
import type { ActionContext } from "../navigation/linkActions";
import { RememberDeviceCheckbox } from "./RememberDeviceCheckbox";
import { SystemStateActions } from "./SystemStateActions";
import { SystemStateHero } from "./SystemStateHero";
import { SystemOfflineTips } from "./SystemOfflineTips";

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
  const { t } = useAppTranslation();
  const preset = getLocalizedSystemStatePreset(stateId, t);
  const title = titleOverride ?? preset.title;
  const description = descriptionOverride ?? preset.description;
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const rememberDeviceAction = preset.secondary?.action === "toggle_remember_device";
  const actionsSecondary = rememberDeviceAction ? undefined : preset.secondary;

  return (
    <ScrollView
      testID={testID ?? `system-state-${stateId}`}
      contentContainerStyle={[
        styles.scroll,
        {
          paddingTop: insets.top + space.md,
          paddingBottom: insets.bottom + space.lg,
          backgroundColor: c.background,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.inner}>
        {showBrand ? (
          <NetqwixLogo
            variant={stateId === "session_expired" ? "wordmark" : "pin"}
            fullWidth={stateId === "session_expired"}
            maxWidth={stateId === "session_expired" ? 340 : 56}
            height={stateId === "session_expired" ? 88 : 56}
            compact={stateId !== "session_expired"}
          />
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
        {stateId === "offline" ? <SystemOfflineTips /> : null}
        {rememberDeviceAction && preset.secondary ? (
          <RememberDeviceCheckbox
            label={preset.secondary.label || t("systemActions.rememberDevice")}
          />
        ) : null}
        <SystemStateActions
          primary={preset.primary}
          secondary={actionsSecondary}
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
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    alignItems: "center",
  },
  title: {
    textAlign: "center",
    marginBottom: space.xs,
    marginTop: space.sm,
  },
  description: {
    textAlign: "center",
    maxWidth: 340,
    lineHeight: 22,
    marginBottom: space.sm,
  },
});
