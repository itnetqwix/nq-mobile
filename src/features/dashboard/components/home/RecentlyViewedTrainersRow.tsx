import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { radii, space, typography, useThemeColors } from "../../../../theme";
import type { RecentTrainerRow } from "../../lib/recentlyViewedTrainers";

type Props = {
  rows: RecentTrainerRow[];
  onSelectTrainer: (trainer: Record<string, unknown>) => void;
};

/**
 * Horizontal "Recently viewed" coaches strip. Renders nothing if there is
 * no history yet — we don't want an empty placeholder cluttering the home
 * screen on day-one accounts.
 */
export function RecentlyViewedTrainersRow({ rows, onSelectTrainer }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();

  if (rows.length === 0) return null;

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Ionicons name="time-outline" size={16} color={c.textSecondary} />
        <Text style={[typography.titleSm, { color: c.text }]}>
          {t("traineeDiscover.recentlyViewed")}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {rows.map((trainer, idx) => (
          <Pressable
            key={`rv-${trainer?._id ?? "row"}-${idx}`}
            onPress={() => onSelectTrainer(trainer as unknown as Record<string, unknown>)}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: c.surfaceElevated, borderColor: c.borderSubtle },
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("traineeDiscover.viewCoachA11y", { name: trainer.name })}
          >
            <View
              style={[
                styles.avatar,
                { backgroundColor: c.brandAccentSubtle, borderColor: c.brandAccent },
              ]}
            >
              {trainer.profile_picture ? (
                <Image
                  source={{ uri: trainer.profile_picture }}
                  style={styles.avatarImg}
                  contentFit="cover"
                />
              ) : (
                <Text style={[styles.avatarLetter, { color: c.brandAccent }]}>
                  {trainer.name.slice(0, 1).toUpperCase()}
                </Text>
              )}
            </View>
            <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
              {trainer.name}
            </Text>
            {trainer.hourly_rate != null ? (
              <Text style={[styles.rate, { color: c.textMuted }]}>
                {t("traineeDiscover.fromRate", { rate: trainer.hourly_rate.toFixed(0) })}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginBottom: space.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.md,
    marginBottom: space.xs,
  },
  scroll: {
    paddingHorizontal: space.md,
    gap: space.sm,
  },
  card: {
    width: 116,
    paddingVertical: space.sm,
    paddingHorizontal: space.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: "center",
    gap: 6,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarLetter: { fontSize: 22, fontWeight: "800" },
  name: { fontSize: 13, fontWeight: "700", textAlign: "center" },
  rate: { fontSize: 11, fontWeight: "600" },
});
