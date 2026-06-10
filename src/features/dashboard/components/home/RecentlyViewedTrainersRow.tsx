import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import type { RecentTrainerRow } from "../../lib/recentlyViewedTrainers";
import { HomeUserAvatar } from "./HomeUserAvatar";

const TILE_WIDTH = 136;
const AVATAR_SIZE = 58;

type Props = {
  rows: RecentTrainerRow[];
  onSelectTrainer: (trainer: Record<string, unknown>) => void;
};

export function RecentlyViewedTrainersRow({ rows, onSelectTrainer }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();

  if (rows.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Ionicons name="eye-outline" size={15} color={c.textSecondary} />
        <Text style={styles.title}>{t("traineeDiscover.recentlyViewed")}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {rows.map((trainer, idx) => (
          <Pressable
            key={`rv-${trainer?._id ?? "row"}-${idx}`}
            onPress={() => onSelectTrainer(trainer as unknown as Record<string, unknown>)}
            style={({ pressed }) => [
              styles.tile,
              pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("traineeDiscover.viewCoachA11y", { name: trainer.name })}
          >
            <HomeUserAvatar
              uri={trainer.profile_picture ?? undefined}
              name={trainer.name}
              size={AVATAR_SIZE}
            />
            <Text style={styles.name} numberOfLines={2}>{trainer.name}</Text>
            {trainer.hourly_rate != null ? (
              <Text style={styles.rate}>
                {t("traineeDiscover.fromRate", { rate: trainer.hourly_rate.toFixed(0) })}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      wrap: {},
      headerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.xs,
        marginBottom: space.sm,
      },
      title: { ...typography.titleSm, color: palette.text, fontWeight: "700" },
      strip: { gap: space.sm, paddingVertical: space.xs },
      tile: {
        width: TILE_WIDTH,
        padding: space.sm,
        borderRadius: radii.lg,
        backgroundColor: palette.surfaceElevated,
        borderWidth: 1,
        borderColor: palette.border,
        alignItems: "center",
        gap: 4,
      },
      name: {
        ...typography.bodySm,
        color: palette.text,
        fontWeight: "700",
        textAlign: "center",
        marginTop: 2,
        minHeight: 34,
      },
      rate: { ...typography.caption, color: palette.textMuted, fontWeight: "600", textAlign: "center" },
    })
  );
}
