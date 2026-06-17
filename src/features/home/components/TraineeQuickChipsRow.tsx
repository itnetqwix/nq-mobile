import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { radii, space, typography, useThemeColors } from "../../../theme";

type Props = {
  onInstant: () => void;
  onBookNow: () => void;
  onClips: () => void;
};

/** Trainee home quick actions — Instant · Book now · Clips (no availability management). */
export function TraineeQuickChipsRow({ onInstant, onBookNow, onClips }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();

  const actions = useMemo(
    () => [
      {
        id: "instant",
        label: t("discoverHome.quickInstant", { defaultValue: "Instant" }),
        subtitle: t("discoverHome.quickInstantSub", { defaultValue: "Live coaches" }),
        icon: "flash-outline",
        onPress: onInstant,
        tone: "instant" as const,
      },
      {
        id: "book",
        label: t("discoverHome.quickBookNow", { defaultValue: "Book now" }),
        subtitle: t("discoverHome.quickBookNowSub", { defaultValue: "All coaches" }),
        icon: "search-outline",
        onPress: onBookNow,
        tone: "default" as const,
      },
      {
        id: "clips",
        label: t("discoverHome.quickClips", { defaultValue: "Clips" }),
        subtitle: t("discoverHome.quickClipsSub", { defaultValue: "Your library" }),
        icon: "film-outline",
        onPress: onClips,
        tone: "default" as const,
      },
    ],
    [onBookNow, onClips, onInstant, t]
  );

  return (
    <View style={[styles.row, { paddingHorizontal: space.md }]}>
      {actions.map((a) => {
        const instant = a.tone === "instant";
        const bg = instant ? c.warningSubtle : c.surfaceElevated;
        const border = instant ? `${c.warning}55` : c.border;
        const iconBg = instant ? "rgba(245, 158, 11, 0.14)" : c.brandSubtle;
        const iconColor = instant ? c.warning : c.brandNavy;
        return (
          <Pressable
            key={a.id}
            onPress={a.onPress}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: bg, borderColor: border },
              pressed && { opacity: 0.9 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={a.subtitle ? `${a.label}. ${a.subtitle}` : a.label}
          >
            <View style={[styles.icon, { backgroundColor: iconBg }]}>
              <Ionicons name={a.icon} size={18} color={iconColor} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
                {a.label}
              </Text>
              <Text style={[styles.sub, { color: c.textMuted }]} numberOfLines={1}>
                {a.subtitle}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: space.sm,
    paddingTop: space.sm,
    paddingBottom: space.sm,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    minHeight: 56,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...typography.subtitle, fontWeight: "800" },
  sub: { ...typography.caption, marginTop: 1, fontWeight: "600" },
});
