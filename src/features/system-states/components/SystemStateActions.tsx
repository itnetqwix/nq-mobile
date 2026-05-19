import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { Button } from "../../../components/ui/Button";
import { space, typography, useThemeColors } from "../../../theme";
import type { SystemStateActionId, SystemStatePreset } from "../presets/types";
import { runSystemStateAction, type ActionContext } from "../navigation/linkActions";

type Props = {
  primary?: SystemStatePreset["primary"];
  secondary?: SystemStatePreset["secondary"];
  supportLink?: boolean;
  actionContext?: ActionContext;
  busy?: boolean;
};

export function SystemStateActions({
  primary,
  secondary,
  supportLink,
  actionContext,
  busy,
}: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();

  const run = (action: SystemStateActionId) => {
    void runSystemStateAction(action, actionContext);
  };

  return (
    <View style={styles.wrap}>
      {primary ? (
        <Button
          label={primary.label}
          onPress={() => run(primary.action)}
          loading={busy && primary.action === "retry"}
          fullWidth
        />
      ) : null}
      {secondary ? (
        <Button
          label={secondary.label}
          variant="secondary"
          onPress={() => run(secondary.action)}
          fullWidth
          style={styles.secondaryBtn}
        />
      ) : null}
      {supportLink ? (
        <Pressable
          onPress={() => run("contact_support")}
          style={styles.supportLink}
          accessibilityRole="link"
        >
          <Text style={[typography.bodySm, { color: c.brandAccent }]}>
            {t("systemActions.contactSupport")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    maxWidth: 320,
    gap: space.sm,
    marginTop: space.lg,
  },
  secondaryBtn: {
    marginTop: space.xs,
  },
  supportLink: {
    alignItems: "center",
    paddingVertical: space.sm,
  },
});
