import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useThemeColors, space, radii, typography } from "../../theme";
import { queryKeys } from "../../lib/queryKeys";
import { useAuth } from "../auth/context/AuthContext";
import { AccountType } from "../../constants/accountType";
import { fetchReviewAnalysis } from "./reviewAnalysisApi";
import { REVIEW_INSIGHT_STALE_MS } from "./parseAiEnvelope";

type Props = {
  /** Fits trainer dashboard stack (no extra outer margins). */
  embedded?: boolean;
};

function formatInsightDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function ReviewAnalysisCard({ embedded }: Props) {
  const colors = useThemeColors();
  const { user, accountType } = useAuth();
  const trainerId = String(user?._id ?? user?.id ?? "");
  const isTrainer = accountType === AccountType.TRAINER;

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.ai.reviewAnalysis(trainerId),
    queryFn: fetchReviewAnalysis,
    enabled: isTrainer && trainerId.length > 0,
    staleTime: REVIEW_INSIGHT_STALE_MS,
    gcTime: REVIEW_INSIGHT_STALE_MS,
    retry: 1,
  });

  if (!isLoading && !data && isError) {
    return (
      <View
        style={[
          styles.card,
          embedded && styles.cardEmbedded,
          {
            backgroundColor: embedded ? colors.surfaceElevated : colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: colors.brandAccentSubtle }]}>
            <Ionicons name="sparkles" size={16} color={colors.brandAccent} />
          </View>
          <Text style={[typography.subtitle, { color: colors.text, flex: 1 }]}>
            AI Review Insights
          </Text>
        </View>
        <Text
          style={[
            typography.bodySm,
            { color: colors.textMuted, paddingHorizontal: space.md, paddingBottom: space.md },
          ]}
        >
          Insights are temporarily unavailable. Pull to refresh your dashboard or try again
          later.
        </Text>
      </View>
    );
  }

  if (!isLoading && !data) return null;

  const sentimentColor =
    data?.overallSentiment === "positive"
      ? colors.success
      : data?.overallSentiment === "negative"
        ? colors.danger
        : colors.warning;

  const sentimentIcon =
    data?.overallSentiment === "positive"
      ? "happy"
      : data?.overallSentiment === "negative"
        ? "sad"
        : "help-circle";

  return (
    <View
      style={[
        styles.card,
        embedded && styles.cardEmbedded,
        {
          backgroundColor: embedded ? colors.surfaceElevated : colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: colors.brandAccentSubtle }]}>
          <Ionicons name="sparkles" size={16} color={colors.brandAccent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.subtitle, { color: colors.text }]}>AI Review Insights</Text>
          {data?.generatedAt && !isLoading ? (
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
              {data.cached ? "Cached" : "Updated"} {formatInsightDate(data.generatedAt)}
              {data.insightVariant === 1 ? " · alternate insight" : ""}
              {data.nextRefreshAt
                ? ` · refreshes ${formatInsightDate(data.nextRefreshAt) ?? "in ~3 days"}`
                : ""}
            </Text>
          ) : null}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.brandAccent} />
          <Text style={[typography.bodySm, { color: colors.textMuted, marginLeft: 8 }]}>
            Analyzing your reviews...
          </Text>
        </View>
      ) : data?.overallSentiment === "insufficient" ? (
        <Text
          style={[
            typography.bodySm,
            { color: colors.textMuted, paddingHorizontal: space.md, paddingBottom: space.md },
          ]}
        >
          {data.summary}
        </Text>
      ) : (
        <View style={styles.content}>
          {data?.degraded ? (
            <Text
              style={[
                typography.caption,
                { color: colors.textMuted, marginBottom: space.xs },
              ]}
            >
              Showing a quick summary (AI service offline).
            </Text>
          ) : null}
          <View style={styles.sentimentRow}>
            <Ionicons name={sentimentIcon as any} size={24} color={sentimentColor} />
            <Text
              style={[
                typography.bodyMd,
                { color: sentimentColor, fontWeight: "600", marginLeft: 8 },
              ]}
            >
              {data?.overallSentiment
                ? data.overallSentiment.charAt(0).toUpperCase() +
                  data.overallSentiment.slice(1)
                : "Mixed"}{" "}
              sentiment
            </Text>
            {data?.reviewCount != null ? (
              <Text
                style={[typography.caption, { color: colors.textMuted, marginLeft: "auto" }]}
              >
                {data.reviewCount} reviews analyzed
              </Text>
            ) : null}
          </View>

          {data?.summary ? (
            <Text style={[typography.bodySm, { color: colors.text, marginVertical: 10 }]}>
              {data.summary}
            </Text>
          ) : null}

          {(data?.strengths?.length ?? 0) > 0 && (
            <View style={styles.section}>
              <Text style={[typography.label, { color: colors.success, marginBottom: 4 }]}>
                Strengths
              </Text>
              {data!.strengths!.map((s, i) => (
                <View key={`str-${i}`} style={styles.bulletRow}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                  <Text style={[typography.bodySm, { color: colors.text, flex: 1, marginLeft: 6 }]}>
                    {s}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {(data?.improvements?.length ?? 0) > 0 && (
            <View style={styles.section}>
              <Text style={[typography.label, { color: colors.warning, marginBottom: 4 }]}>
                Areas to improve
              </Text>
              {data!.improvements!.map((s, i) => (
                <View key={`imp-${i}`} style={styles.bulletRow}>
                  <Ionicons name="arrow-up-circle" size={14} color={colors.warning} />
                  <Text style={[typography.bodySm, { color: colors.text, flex: 1, marginLeft: 6 }]}>
                    {s}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    marginVertical: space.sm,
    overflow: "hidden",
  },
  cardEmbedded: {
    borderRadius: radii.lg,
    marginVertical: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: space.md,
    gap: 10,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingBottom: space.md,
  },
  content: {
    paddingHorizontal: space.md,
    paddingBottom: space.md,
  },
  sentimentRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  section: { marginTop: 8 },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
});
