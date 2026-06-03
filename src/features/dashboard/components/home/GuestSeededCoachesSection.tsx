import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { CoachCarouselSkeleton, Skeleton } from "../../../../components/ui";
import { fetchGuestSeededTrainers } from "../../../home/api/homeApi";
import { getTrainerName } from "../../../bookexpert/lib/trainerUtils";
import { trainerListItemKey } from "../../../../lib/lists/trainerListUtils";
import { queryKeys } from "../../../../lib/queryKeys";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { HomeUserAvatar } from "./HomeUserAvatar";

type Props = {
  onSelectTrainer: (trainer: Record<string, unknown>) => void;
};

/**
 * Coaches the user browsed as a guest — ranked server-side from
 * `GET /trainee/guest-activity/seeded-trainers` after signup replay.
 */
export function GuestSeededCoachesSection({ onSelectTrainer }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();

  const { data: trainers = [], isLoading } = useQuery({
    queryKey: queryKeys.trainee.guestSeededTrainers,
    queryFn: () => fetchGuestSeededTrainers(12),
    staleTime: 300_000,
  });

  if (isLoading) {
    return (
      <View style={styles.wrap}>
        <Skeleton width={160} height={16} style={{ marginBottom: space.sm }} />
        <CoachCarouselSkeleton count={3} variant="guestSeeded" showHeader={false} />
      </View>
    );
  }

  if (!trainers.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("traineeDiscover.guestSeededTitle")}</Text>
      <Text style={styles.sub}>{t("traineeDiscover.guestSeededSub")}</Text>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {trainers.map((item, i) => {
          const name = getTrainerName(item);
          return (
            <Pressable
              key={trainerListItemKey(item, i, "seeded-")}
              style={({ pressed }) => [styles.tile, pressed && { opacity: 0.9 }]}
              onPress={() => onSelectTrainer(item)}
              accessibilityRole="button"
              accessibilityLabel={t("traineeDiscover.guestSeededA11y", { name })}
            >
              <HomeUserAvatar uri={item?.profile_picture as string} name={name} size={56} />
              <Text style={styles.name} numberOfLines={2}>
                {name}
              </Text>
              <View style={styles.bookAgainRow}>
                <Ionicons name="eye-outline" size={14} color={c.brandNavy} />
                <Text style={styles.cta}>{t("traineeDiscover.guestSeededCta")}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      wrap: { marginBottom: space.sm },
      title: { ...typography.titleSm, color: palette.text, fontWeight: "700" },
      sub: { ...typography.caption, color: palette.textMuted, marginTop: 4, marginBottom: space.sm },
      strip: { gap: space.sm, paddingVertical: 4 },
      tile: {
        width: 108,
        alignItems: "center",
        padding: space.sm,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surfaceElevated,
      },
      name: {
        ...typography.caption,
        color: palette.text,
        fontWeight: "600",
        marginTop: space.xs,
        textAlign: "center",
        minHeight: 32,
      },
      bookAgainRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
      cta: { ...typography.caption, color: palette.brandNavy, fontWeight: "700" },
    })
  );
}
