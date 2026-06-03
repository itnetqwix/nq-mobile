import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { radii, space, typography, useThemeColors } from "../../../theme";

const TIP_KEYS = ["tipWifi", "tipAirplane", "tipRetry"] as const;
const TIP_ICONS: Record<(typeof TIP_KEYS)[number], keyof typeof Ionicons.glyphMap> = {
  tipWifi: "wifi-outline",
  tipAirplane: "airplane-outline",
  tipRetry: "refresh-outline",
};

export function SystemOfflineTips() {
  const { t } = useAppTranslation();
  const c = useThemeColors();

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: c.surfaceElevated,
          borderColor: c.border,
        },
      ]}
      accessibilityRole="summary"
    >
      {TIP_KEYS.map((key) => (
        <View key={key} style={styles.row}>
          <View style={[styles.iconWrap, { backgroundColor: c.brandAccentSubtle }]}>
            <Ionicons name={TIP_ICONS[key]} size={18} color={c.brandNavy} />
          </View>
          <Text style={[typography.bodySm, styles.tipText, { color: c.textSecondary }]}>
            {t(`systemStates.offline.${key}`, {
              defaultValue:
                key === "tipWifi"
                  ? "Turn on Wi‑Fi or mobile data"
                  : key === "tipAirplane"
                    ? "Turn off airplane mode"
                    : "Tap Try again when your connection is back",
            })}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    maxWidth: 340,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: space.md,
    gap: space.sm,
    marginBottom: space.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  tipText: {
    flex: 1,
    lineHeight: 20,
  },
});
