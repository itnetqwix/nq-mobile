import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { radii, space, typography, useThemeColors } from "../../../../theme";

/**
 * Compact banner on guest home — browsing mode + what unlocks after sign-in.
 */
export function GuestExploreBanner() {
  const { t } = useAppTranslation();
  const c = useThemeColors();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: c.brandAccentSubtle,
          borderColor: c.brandAccent,
        },
      ]}
      accessibilityRole="summary"
    >
      <Ionicons name="compass-outline" size={22} color={c.brandAccent} />
      <View style={styles.copy}>
        <Text style={[styles.title, { color: c.brandNavy }]}>
          {t("guest.exploreBannerTitle")}
        </Text>
        <Text style={[styles.body, { color: c.textMuted }]}>
          {t("guest.exploreBannerBody")}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    padding: space.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: space.sm,
  },
  copy: { flex: 1, gap: 4 },
  title: { ...typography.label, fontWeight: "800" },
  body: { ...typography.bodySm, lineHeight: 18 },
});
