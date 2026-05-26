import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Sheet } from "../../../../components/ui";
import { queryKeys } from "../../../../lib/queryKeys";
import { space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { fetchMyTrainerStats } from "../../../home/api/homeApi";
import { mapTrainerStatsReviews } from "../../lib/mapTrainerStatsReviews";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function TrainerReviewsSheet({ visible, onClose }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();

  const q = useQuery({
    queryKey: queryKeys.trainer.myStats,
    queryFn: fetchMyTrainerStats,
    enabled: visible,
    staleTime: 30_000,
  });

  const reviews = mapTrainerStatsReviews(q.data?.reviews);
  const avg = q.data?.avgRating;
  const count = q.data?.reviewCount ?? 0;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      showClose
      fullHeight
      title={t("trainerDashboard.reviewsSheetTitle", { defaultValue: "Your reviews" })}
      description={
        count > 0 && avg != null
          ? t("trainerDashboard.reviewsSheetSubtitle", {
              defaultValue: "{{rating}} average · {{count}} reviews from trainees",
              rating: avg.toFixed(1),
              count,
            })
          : t("trainerDashboard.noReviewsYet")
      }
    >
      {q.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={c.brandAccent} />
        </View>
      ) : reviews.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubble-ellipses-outline" size={40} color={c.textMuted} />
          <Text style={styles.emptyText}>
            {t("trainerDashboard.reviewsEmpty", {
              defaultValue:
                "When trainees rate a session, their stars and written feedback show up here.",
            })}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {reviews.map((r) => (
            <View key={r.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.name}>{r.traineeName}</Text>
                <View style={styles.stars}>
                  <Ionicons name="star" size={14} color={c.warning} />
                  <Text style={styles.score}>{r.sessionRating.toFixed(1)}</Text>
                </View>
              </View>
              {r.title ? <Text style={styles.title}>{r.title}</Text> : null}
              {r.remarks ? <Text style={styles.body}>{r.remarks}</Text> : null}
              {!r.title && !r.remarks ? (
                <Text style={styles.muted}>
                  {t("trainerDashboard.reviewStarsOnly", {
                    defaultValue: "Rated the session — no written comment.",
                  })}
                </Text>
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}
    </Sheet>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      centered: { paddingVertical: space.xl, alignItems: "center" },
      empty: {
        alignItems: "center",
        paddingVertical: space.xl,
        paddingHorizontal: space.lg,
        gap: space.md,
      },
      emptyText: {
        ...typography.bodyMd,
        color: palette.textMuted,
        textAlign: "center",
      },
      list: { paddingBottom: space.xl, gap: space.sm },
      card: {
        padding: space.md,
        borderRadius: 14,
        backgroundColor: palette.surfaceMuted,
        borderWidth: 1,
        borderColor: palette.borderSubtle,
      },
      cardTop: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: space.sm,
      },
      name: { ...typography.label, color: palette.text, fontWeight: "700", flex: 1 },
      stars: { flexDirection: "row", alignItems: "center", gap: 4 },
      score: { ...typography.label, color: palette.text, fontWeight: "700" },
      title: {
        ...typography.label,
        color: palette.text,
        marginTop: space.xs,
        fontWeight: "600",
      },
      body: {
        ...typography.bodySm,
        color: palette.textSecondary,
        marginTop: space.xs,
        lineHeight: 20,
      },
      muted: {
        ...typography.caption,
        color: palette.textMuted,
        marginTop: space.xs,
        fontStyle: "italic",
      },
    })
  );
}
