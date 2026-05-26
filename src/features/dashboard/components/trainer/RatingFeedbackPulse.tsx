import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { Skeleton } from "../../../../components/ui";
import { DashboardSection } from "../shared/DashboardSection";
import {
  radii,
  space,
  typography,
  useThemeColors,
  useThemedStyles,
} from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { fetchMyTrainerStats } from "../../../home/api/homeApi";
import { queryKeys } from "../../../../lib/queryKeys";

type Props = {
  /**
   * Kept for backwards compatibility — older callers seed the initial avg
   * from the cached `user` doc so the tile doesn't flash empty before the
   * query resolves. Not the source of truth; the dedicated trainer-stats
   * query is.
   */
  user?: Record<string, unknown> | null;
  onOpenReviews?: () => void;
};

/**
 * Dashboard "rating pulse" tile. Backed by `GET /trainer/my-stats`
 * (`fetchMyTrainerStats`) so it reflects the freshest aggregate even when
 * the cached `useAuth().user` object is stale.
 *
 * UX:
 *  - On initial load shows a Skeleton row (no "—" placeholder).
 *  - On success shows star + avg rating + review count + latest snippet.
 *  - 60s stale time matches the rest of the trainer dashboard.
 */
export function RatingFeedbackPulse({ user: _user, onOpenReviews }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();

  const q = useQuery({
    queryKey: queryKeys.trainer.myStats,
    queryFn: fetchMyTrainerStats,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const stats = q.data;
  const avgVal = stats?.avgRating ?? null;
  const reviewCount = stats?.reviewCount ?? 0;
  const latest = stats?.reviews?.[0];
  const snippet = useMemo(() => {
    if (!latest) return "";
    const trainee = latest.ratings?.trainee;
    return String(trainee?.comment ?? "").slice(0, 120);
  }, [latest]);

  return (
    <DashboardSection embedded title={t("trainerDashboard.ratingPulse")}>
      <Pressable
        style={({ pressed }) => [styles.card, pressed && onOpenReviews && { opacity: 0.92 }]}
        onPress={onOpenReviews}
        disabled={!onOpenReviews}
      >
        {q.isLoading ? (
          <View style={styles.row}>
            <Skeleton width={22} height={22} radius={11} />
            <Skeleton width={48} height={22} radius={6} />
            <Skeleton width={120} height={14} radius={6} />
          </View>
        ) : (
          <>
            <View style={styles.row}>
              <Ionicons name="star" size={22} color={c.warning} />
              <Text style={styles.rating}>
                {avgVal != null && avgVal > 0 ? avgVal.toFixed(1) : "—"}
              </Text>
              <Text style={styles.sub}>
                {reviewCount > 0
                  ? t("traineeDiscover.reviewCount", { count: reviewCount })
                  : t("trainerDashboard.noReviewsYet")}
              </Text>
            </View>
            {snippet ? (
              <Text style={styles.quote} numberOfLines={3}>
                {t("trainerDashboard.latestReview")}: "{snippet}"
              </Text>
            ) : null}
          </>
        )}
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
