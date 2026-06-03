import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "../../../../components/ui";
import { queryKeys } from "../../../../lib/queryKeys";
import { fetchMyTrainerStats } from "../../../home/api/homeApi";
import { mapTrainerStatsReviews } from "../../lib/mapTrainerStatsReviews";
import { DashboardSection } from "../shared/DashboardSection";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";

type Props = {
  onOpenReviews?: () => void;
};

export function RatingFeedbackPulse({ onOpenReviews }: Props) {
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
      <DashboardSection embedded title={t("trainerDashboard.ratingPulse")}>
        <Skeleton width="100%" height={72} radius={radii.lg} />
      </DashboardSection>
    );
  }

  const avg = q.data?.avgRating;
  const count = q.data?.reviewCount ?? 0;
  const reviews = mapTrainerStatsReviews(q.data?.reviews);
  const latest = reviews[0];
  const snippet = latest?.remarks
    ? String(latest.remarks).slice(0, 120)
    : latest?.title
      ? String(latest.title).slice(0, 120)
      : "";

  return (
    <DashboardSection embedded title={t("trainerDashboard.ratingPulse")}>
      <Pressable
        style={({ pressed }) => [styles.card, pressed && onOpenReviews && { opacity: 0.92 }]}
        onPress={onOpenReviews}
        disabled={!onOpenReviews}
      >
        <View style={styles.row}>
          <Ionicons name="star" size={22} color={c.warning} />
          <Text style={styles.rating}>
            {avg != null && avg > 0 ? avg.toFixed(1) : "—"}
          </Text>
          <Text style={styles.sub}>
            {count > 0
              ? t("traineeDiscover.reviewCount", { count })
              : t("trainerDashboard.noReviewsYet")}
          </Text>
          {onOpenReviews ? (
            <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
          ) : null}
        </View>
        {snippet ? (
          <Text style={styles.quote} numberOfLines={3}>
            {t("trainerDashboard.latestReview")}: “{snippet}”
          </Text>
        ) : null}
      </Pressable>
    </DashboardSection>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      card: {
        padding: space.md,
        borderRadius: radii.lg,
        backgroundColor: palette.surfaceElevated,
        borderWidth: 1,
        borderColor: palette.border,
      },
      row: { flexDirection: "row", alignItems: "center", gap: space.sm },
      rating: { ...typography.titleMd, color: palette.text, fontWeight: "800" },
      sub: { ...typography.caption, color: palette.textMuted, flex: 1 },
      quote: { ...typography.bodySm, color: palette.textMuted, marginTop: space.sm, fontStyle: "italic" },
    })
  );
}
