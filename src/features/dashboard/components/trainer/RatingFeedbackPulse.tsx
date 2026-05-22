import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  extractTrainerReviews,
  getTrainerAvgRating,
} from "../../../bookexpert/lib/trainerUtils";
import { DashboardSection } from "../shared/DashboardSection";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";

type Props = {
  user: Record<string, unknown> | null | undefined;
  onOpenReviews?: () => void;
};

export function RatingFeedbackPulse({ user, onOpenReviews }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();
  const avgVal = getTrainerAvgRating(user);
  const reviews = useMemo(() => extractTrainerReviews(user), [user]);
  const latest = reviews[0] as Record<string, unknown> | undefined;
  const snippet = latest
    ? String(latest.comment ?? latest.feedback ?? latest.review ?? "").slice(0, 120)
    : "";

  return (
    <DashboardSection title={t("trainerDashboard.ratingPulse")}>
      <Pressable
        style={({ pressed }) => [styles.card, pressed && onOpenReviews && { opacity: 0.92 }]}
        onPress={onOpenReviews}
        disabled={!onOpenReviews}
      >
        <View style={styles.row}>
          <Ionicons name="star" size={22} color={c.warning} />
          <Text style={styles.rating}>
            {avgVal != null && avgVal > 0 ? avgVal.toFixed(1) : "—"}
          </Text>
          <Text style={styles.sub}>
            {reviews.length > 0
              ? t("traineeDiscover.reviewCount", { count: reviews.length })
              : t("trainerDashboard.noReviewsYet")}
          </Text>
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
