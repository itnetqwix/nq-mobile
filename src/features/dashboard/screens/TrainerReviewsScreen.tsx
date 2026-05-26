import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { Header, ScreenContainer } from "../../../components/ui";
import { NetQwixLoader } from "../../../components/brand/NetQwixLoader";
import { queryKeys } from "../../../lib/queryKeys";
import { space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { fetchMyTrainerStats } from "../../home/api/homeApi";
import { mapTrainerStatsReviews } from "../lib/mapTrainerStatsReviews";

/**
 * Full-screen trainer reviews list (replaces the bottom sheet).
 * Opened from the rating chip on the dashboard greeting card.
 */
export function TrainerReviewsScreen() {
  const navigation = useNavigation();
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();

  const q = useQuery({
    queryKey: queryKeys.trainer.myStats,
    queryFn: fetchMyTrainerStats,
    staleTime: 30_000,
  });

  const reviews = mapTrainerStatsReviews(q.data?.reviews);
  const avg = q.data?.avgRating;
  const count = q.data?.reviewCount ?? 0;

  return (
    <ScreenContainer>
      <Header
        title={t("trainerDashboard.reviewsSheetTitle", { defaultValue: "Your reviews" })}
        subtitle={
          count > 0 && avg != null
            ? t("trainerDashboard.reviewsSheetSubtitle", {
                defaultValue: "{{rating}} average · {{count}} reviews from trainees",
                rating: avg.toFixed(1),
                count,
              })
            : t("trainerDashboard.noReviewsYet")
        }
        onBack={() => navigation.goBack()}
      />

      {q.isLoading ? (
        <View style={styles.centered}>
          <NetQwixLoader variant="inline" size="md" motion="quick" message={t("common.loading", { defaultValue: "Loading…" })} />
        </View>
      ) : reviews.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubble-ellipses-outline" size={48} color={c.textMuted} />
          <Text style={styles.emptyTitle}>
            {t("trainerDashboard.reviewsEmptyTitle", { defaultValue: "No reviews yet" })}
          </Text>
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
    </ScreenContainer>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      centered: { flex: 1, alignItems: "center", justifyContent: "center" },
      empty: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: space.xl,
        gap: space.md,
      },
      emptyTitle: { ...typography.titleSm, color: palette.text, textAlign: "center" },
      emptyText: {
        ...typography.bodyMd,
        color: palette.textMuted,
        textAlign: "center",
      },
      list: { padding: space.md, paddingBottom: space.xxl, gap: space.sm },
      card: {
        padding: space.md,
        borderRadius: 14,
        backgroundColor: palette.surfaceElevated,
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
