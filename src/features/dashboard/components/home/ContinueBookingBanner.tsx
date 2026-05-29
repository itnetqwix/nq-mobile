import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getTrainerName } from "../../../bookexpert/lib/trainerUtils";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../../theme";

type Props = {
  trainer: Record<string, unknown>;
  mode: "instant" | "schedule";
  onContinue: () => void;
  onDismiss: () => void;
};

export function ContinueBookingBanner({ trainer, mode, onContinue, onDismiss }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();
  const name = getTrainerName(trainer) || t("continueBooking.coachFallback", { defaultValue: "your coach" });

  return (
    <View
      style={[styles.wrap, { backgroundColor: c.brandAccentSubtle, borderColor: c.brandAccent }]}
      accessibilityRole="summary"
    >
      <View style={styles.row}>
        <Ionicons name="calendar" size={22} color={c.brandNavy} />
        <View style={styles.copy}>
          <Text style={[styles.title, { color: c.text }]}>
            {t("continueBooking.title", { defaultValue: "Finish your booking" })}
          </Text>
          <Text style={[styles.body, { color: c.textMuted }]}>
            {mode === "schedule"
              ? t("continueBooking.bodySchedule", {
                  name,
                  defaultValue: "You were scheduling with {{name}} before signing in.",
                })
              : t("continueBooking.bodyInstant", {
                  name,
                  defaultValue: "You were booking an instant lesson with {{name}}.",
                })}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={onDismiss}
          style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel={t("continueBooking.dismissA11y", { defaultValue: "Dismiss" })}
        >
          <Text style={[styles.btnGhostText, { color: c.textMuted }]}>
            {t("common.notNow", { defaultValue: "Not now" })}
          </Text>
        </Pressable>
        <Pressable
          onPress={onContinue}
          style={({ pressed }) => [styles.btnPrimary, { backgroundColor: c.brandNavy }, pressed && { opacity: 0.9 }]}
          accessibilityRole="button"
          accessibilityLabel={t("continueBooking.continueA11y", { defaultValue: "Continue booking" })}
        >
          <Text style={styles.btnPrimaryText}>
            {t("continueBooking.continue", { defaultValue: "Continue" })}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      wrap: {
        marginHorizontal: space.md,
        marginTop: space.sm,
        padding: space.md,
        borderRadius: radii.md,
        borderWidth: 1,
      },
      row: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
      copy: { flex: 1 },
      title: { ...typography.subtitle, fontWeight: "700" },
      body: { ...typography.bodySm, marginTop: 4, lineHeight: 20 },
      actions: { flexDirection: "row", justifyContent: "flex-end", gap: space.sm, marginTop: space.md },
      btnGhost: { paddingVertical: 10, paddingHorizontal: space.md },
      btnGhostText: { ...typography.bodySm, fontWeight: "600" },
      btnPrimary: {
        paddingVertical: 10,
        paddingHorizontal: space.lg,
        borderRadius: radii.sm,
      },
      btnPrimaryText: { ...typography.bodySm, color: palette.brandTextOn, fontWeight: "700" },
    })
  );
}
