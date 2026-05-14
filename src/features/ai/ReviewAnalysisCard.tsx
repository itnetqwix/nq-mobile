import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors, space, radii, typography } from "../../theme";
import { apiClient } from "../../api/client";
import { API_ROUTES } from "../../config/apiRoutes";

export default function ReviewAnalysisCard() {
  const colors = useThemeColors();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get(API_ROUTES.ai.reviewAnalysis)
      .then((res) => setData(res.data?.result || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!loading && !data) return null;

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
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: colors.brandAccentSubtle }]}>
          <Ionicons name="sparkles" size={16} color={colors.brandAccent} />
        </View>
        <Text style={[typography.subtitle, { color: colors.text, flex: 1 }]}>
          AI Review Insights
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.brandAccent} />
          <Text style={[typography.bodySm, { color: colors.textMuted, marginLeft: 8 }]}>
            Analyzing your reviews...
          </Text>
        </View>
      ) : data?.overallSentiment === "insufficient" ? (
        <Text style={[typography.bodySm, { color: colors.textMuted, paddingHorizontal: space.md, paddingBottom: space.md }]}>
          {data.summary}
        </Text>
      ) : (
        <View style={styles.content}>
          <View style={styles.sentimentRow}>
            <Ionicons name={sentimentIcon as any} size={24} color={sentimentColor} />
            <Text style={[typography.bodyMd, { color: sentimentColor, fontWeight: "600", marginLeft: 8 }]}>
              {data.overallSentiment?.charAt(0).toUpperCase() + data.overallSentiment?.slice(1)} sentiment
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginLeft: "auto" }]}>
              {data.reviewCount} reviews analyzed
            </Text>
          </View>

          <Text style={[typography.bodySm, { color: colors.text, marginVertical: 10 }]}>
            {data.summary}
          </Text>

          {data.strengths?.length > 0 && (
            <View style={styles.section}>
              <Text style={[typography.label, { color: colors.success, marginBottom: 4 }]}>
                Strengths
              </Text>
              {data.strengths.map((s: string, i: number) => (
                <View key={i} style={styles.bulletRow}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                  <Text style={[typography.bodySm, { color: colors.text, flex: 1, marginLeft: 6 }]}>
                    {s}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {data.improvements?.length > 0 && (
            <View style={styles.section}>
              <Text style={[typography.label, { color: colors.warning, marginBottom: 4 }]}>
                Areas to improve
              </Text>
              {data.improvements.map((s: string, i: number) => (
                <View key={i} style={styles.bulletRow}>
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
