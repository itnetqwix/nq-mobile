import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";

type Props = {
  count: number;
  onPress: () => void;
};

export function PendingRequestsBanner({ count, onPress }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();
  if (count <= 0) return null;

  return (
    <Pressable
      style={({ pressed }) => [styles.banner, pressed && { opacity: 0.92 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("trainerDashboard.pendingA11y", { count })}
    >
      <Ionicons name="alert-circle" size={22} color={c.warning} />
      <View style={styles.textCol}>
        <Text style={styles.title}>
          {t("trainerDashboard.pendingRequests", { count })}
        </Text>
        <Text style={styles.sub}>{t("trainerDashboard.pendingRequestsSub")}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
    </Pressable>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      banner: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        padding: space.md,
        borderRadius: radii.lg,
        backgroundColor: `${palette.warning}18`,
        borderWidth: 1,
        borderColor: palette.warning,
      },
      textCol: { flex: 1, minWidth: 0 },
      title: { ...typography.subtitle, color: palette.text, fontWeight: "700" },
      sub: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
    })
  );
}
