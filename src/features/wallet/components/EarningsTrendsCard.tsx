import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as FileSystem from "expo-file-system/legacy";
import React, { useMemo, useState } from "react";
import { Alert, Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { apiClient } from "../../../api/client";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { queryKeys } from "../../../lib/queryKeys";
import { radii, space, typography, useThemedStyles, useThemeColors } from "../../../theme";
import { HelpBubble } from "../../../components/ui";
import {
  buildTrainerEarningsCsvUrl,
  fetchTrainerEarningsSeries,
} from "../walletApi";

type Range = "weekly" | "monthly";

/**
 * Trainer-side earnings trends with a lightweight bar chart and a CSV
 * export button. We render bars with pure `<View />` blocks instead of
 * pulling in a chart library — keeps the bundle lean and the visuals
 * consistent with the rest of the app.
 */
export function EarningsTrendsCard() {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();
  const [range, setRange] = useState<Range>("weekly");
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.wallet.trainerEarningsSeries(range),
    queryFn: () => fetchTrainerEarningsSeries(range),
    staleTime: 5 * 60_000,
  });

  const series = data?.series ?? [];
  const maxTotal = useMemo(
    () => Math.max(1, ...series.map((s) => s.total)),
    [series]
  );

  const handleExport = async () => {
    try {
      setDownloading(true);
      const csvPath = buildTrainerEarningsCsvUrl(range);
      const fileUri = `${FileSystem.cacheDirectory}netqwix-earnings-${range}-${Date.now()}.csv`;
      const baseURL = (apiClient.defaults?.baseURL as string | undefined) ?? "";
      const csvUrl = `${baseURL}${csvPath}`;
      const auth = (apiClient.defaults?.headers as any)?.common?.Authorization ?? "";
      const downloaded = await FileSystem.downloadAsync(csvUrl, fileUri, {
        headers: auth ? { Authorization: String(auth) } : undefined,
      });
      if (!downloaded?.uri) {
        throw new Error("CSV download failed");
      }
      try {
        await Share.share(
          Platform.OS === "ios"
            ? { url: downloaded.uri, title: t("earningsTrends.exportTitle") }
            : { message: downloaded.uri, title: t("earningsTrends.exportTitle") }
        );
      } catch {
        Alert.alert(
          t("earningsTrends.exportTitle"),
          t("earningsTrends.exportSavedTo", { uri: downloaded.uri })
        );
      }
    } catch (err) {
      Alert.alert(
        t("earningsTrends.exportErrorTitle"),
        err instanceof Error ? err.message : "Could not export earnings."
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: c.text }]}>
            {t("earningsTrends.title")}
          </Text>
          <HelpBubble
            topic={t("help.commission.topic", { defaultValue: "How commission works" })}
          >
            {t("help.commission.body", {
              defaultValue:
                "NetQwix charges a small platform commission (usually 15%) on each booking. The amounts you see in this card are your earnings after commission and refunds. Payouts move to your bank or Stripe account on the platform schedule.",
            })}
          </HelpBubble>
        </View>
        <Pressable
          onPress={handleExport}
          disabled={downloading || isLoading}
          style={[
            styles.exportBtn,
            { borderColor: c.brandNavy, opacity: downloading ? 0.5 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t("earningsTrends.exportA11y")}
        >
          <Ionicons name="download-outline" size={14} color={c.brandNavy} />
          <Text style={[styles.exportText, { color: c.brandNavy }]}>
            {downloading ? t("earningsTrends.exporting") : t("earningsTrends.export")}
          </Text>
        </Pressable>
      </View>

      <View style={styles.segments}>
        {(["weekly", "monthly"] as const).map((opt) => {
          const active = range === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => setRange(opt)}
              style={[
                styles.segment,
                {
                  backgroundColor: active ? c.brandNavy : "transparent",
                  borderColor: active ? c.brandNavy : c.border,
                },
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: active ? c.brandTextOn : c.text },
                ]}
              >
                {opt === "weekly"
                  ? t("earningsTrends.segWeekly")
                  : t("earningsTrends.segMonthly")}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.chartArea}>
        {series.map((point) => {
          const heightPct = (point.total / maxTotal) * 100;
          return (
            <View key={point.key} style={styles.chartCol}>
              <View style={[styles.barTrack, { backgroundColor: c.surfaceMuted }]}>
                <View
                  style={[
                    styles.barFill,
                    {
                      height: `${Math.max(2, heightPct)}%`,
                      backgroundColor:
                        point.total > 0 ? c.brandAccent : c.borderSubtle,
                    },
                  ]}
                />
              </View>
              <Text
                style={[styles.barAmount, { color: c.textMuted }]}
                numberOfLines={1}
              >
                ${formatCompact(point.total)}
              </Text>
              <Text
                style={[styles.barLabel, { color: c.textMuted }]}
                numberOfLines={1}
              >
                {point.label}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.totalRow}>
        <Text style={[styles.totalLabel, { color: c.textMuted }]}>
          {t("earningsTrends.total")}
        </Text>
        <Text style={[styles.totalValue, { color: c.text }]}>
          ${(data?.total ?? 0).toFixed(2)}
        </Text>
      </View>
    </View>
  );
}

function formatCompact(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toFixed(0);
}

function useStyles() {
  return useThemedStyles(() =>
    StyleSheet.create({
      card: {
        borderRadius: radii.lg,
        borderWidth: 1,
        padding: space.md,
        gap: space.sm,
      },
      headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      },
      titleRow: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
      title: { ...typography.titleSm, fontWeight: "800" },
      exportBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: radii.pill,
        borderWidth: 1,
      },
      exportText: { fontSize: 12, fontWeight: "700" },
      segments: { flexDirection: "row", gap: 6 },
      segment: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: radii.pill,
        borderWidth: 1,
      },
      segmentText: { fontSize: 12, fontWeight: "700" },
      chartArea: {
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 6,
        height: 160,
        marginTop: 4,
      },
      chartCol: {
        flex: 1,
        alignItems: "center",
        gap: 4,
        justifyContent: "flex-end",
      },
      barTrack: {
        width: "100%",
        flex: 1,
        borderRadius: 6,
        justifyContent: "flex-end",
        overflow: "hidden",
      },
      barFill: {
        width: "100%",
        borderTopLeftRadius: 4,
        borderTopRightRadius: 4,
      },
      barAmount: { fontSize: 10, fontWeight: "700" },
      barLabel: { fontSize: 9, fontWeight: "600" },
      totalRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 4,
      },
      totalLabel: {
        fontSize: 11,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 0.6,
      },
      totalValue: { ...typography.titleSm, fontWeight: "800" },
    })
  );
}
