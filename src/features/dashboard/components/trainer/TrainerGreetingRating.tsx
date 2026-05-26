import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "../../../../components/ui";
import { queryKeys } from "../../../../lib/queryKeys";
import { space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { fetchMyTrainerStats } from "../../../home/api/homeApi";

type Props = {
  onPress: () => void;
};

/**
 * Compact star + average rating chip embedded in the trainer welcome card.
 * Tapping opens the full reviews sheet.
 */
export function TrainerGreetingRating({ onPress }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();

  const q = useQuery({
    queryKey: queryKeys.trainer.myStats,
    queryFn: fetchMyTrainerStats,
    staleTime: 60_000,
  });

  if (q.isLoading) {
    return (
      <View style={styles.wrap}>
        <Skeleton width={88} height={28} radius={14} />
      </View>
    );
  }

  const avg = q.data?.avgRating;
  const count = q.data?.reviewCount ?? 0;
  const hasRating = avg != null && avg > 0 && count > 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && { opacity: 0.88 }]}
      accessibilityRole="button"
      accessibilityLabel={
        hasRating
          ? t("trainerDashboard.openReviewsA11y", {
              defaultValue: "Your rating {{rating}}, {{count}} reviews. Tap to see all.",
              rating: avg!.toFixed(1),
              count,
            })
          : t("trainerDashboard.noReviewsYet")
      }
    >
      <Ionicons name="star" size={16} color={c.warning} />
      <Text style={styles.rating}>{hasRating ? avg!.toFixed(1) : "—"}</Text>
      <Text style={styles.count}>
        {count > 0
          ? t("traineeDiscover.reviewCount", { count })
          : t("trainerDashboard.noReviewsYet")}
      </Text>
      <Ionicons name="chevron-forward" size={14} color={c.textMuted} />
    </Pressable>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      wrap: { marginTop: space.xs },
      chip: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 6,
        marginTop: space.xs,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: palette.surfaceMuted,
        borderWidth: 1,
        borderColor: palette.borderSubtle,
      },
      rating: {
        ...typography.label,
        fontWeight: "800",
        color: palette.text,
      },
      count: {
        ...typography.caption,
        color: palette.textMuted,
        flexShrink: 1,
      },
    })
  );
}
