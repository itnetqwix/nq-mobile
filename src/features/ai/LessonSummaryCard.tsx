import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors, space, radii, typography } from "../../theme";
import { apiClient } from "../../api/client";
import { API_ROUTES } from "../../config/apiRoutes";

type Props = {
  sessionId: string;
  compact?: boolean;
};

export default function LessonSummaryCard({ sessionId, compact = false }: Props) {
  const colors = useThemeColors();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(!compact);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    apiClient
      .get(API_ROUTES.ai.lessonSummary(sessionId))
      .then((res) => setData(res.data?.result || null))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (error || (!loading && !data)) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable style={styles.header} onPress={() => setExpanded((v) => !v)}>
        <View style={[styles.iconWrap, { backgroundColor: colors.brandAccentSubtle }]}>
          <Ionicons name="sparkles" size={16} color={colors.brandAccent} />
        </View>
        <Text style={[typography.subtitle, { color: colors.text, flex: 1 }]}>
          AI Lesson Summary
        </Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.textMuted}
        />
      </Pressable>

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.brandAccent} />
          <Text style={[typography.bodySm, { color: colors.textMuted, marginLeft: 8 }]}>
            Generating summary...
          </Text>
        </View>
      )}

      {expanded && data && !loading && (
        <View style={styles.content}>
          <Text style={[typography.bodyMd, { color: colors.text, marginBottom: 12 }]}>
            {data.summary}
          </Text>

          {data.keyTakeaways?.length > 0 && (
            <>
              <Text style={[typography.label, { color: colors.brandAccent, marginBottom: 6 }]}>
                Key Takeaways
              </Text>
              {data.keyTakeaways.map((item: string, idx: number) => (
                <View key={idx} style={styles.takeawayRow}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={[typography.bodySm, { color: colors.text, flex: 1, marginLeft: 8 }]}>
                    {item}
                  </Text>
                </View>
              ))}
            </>
          )}

          {data.followUpPlan && (
            <>
              <Text
                style={[
                  typography.label,
                  { color: colors.brandAccent, marginTop: 12, marginBottom: 6 },
                ]}
              >
                Follow-up Plan
              </Text>
              <Text style={[typography.bodySm, { color: colors.textSecondary }]}>
                {data.followUpPlan}
              </Text>
            </>
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
  takeawayRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },
});
