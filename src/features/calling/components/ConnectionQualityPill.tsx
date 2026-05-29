import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useCall } from "../CallContext";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { radii, useThemedStyles } from "../../../theme";

type Quality = "good" | "fair" | "poor" | "unknown";

/**
 * Tiny pill that overlays the in-call chrome and surfaces real-time
 * network quality. Pulls stats from the call engine every two seconds,
 * collapses them into a red/yellow/green bucket, and lets the user tap
 * for the raw RTT/packet-loss numbers in a tooltip. The pill should
 * never fight for screen real estate — single line, slim, and
 * dismissable visually by tapping (just toggles the tooltip).
 */
export function ConnectionQualityPill() {
  const { t } = useAppTranslation();
  const { getNetworkStats } = useCall();
  const styles = useStyles();
  const [quality, setQuality] = useState<Quality>("unknown");
  const [showDetail, setShowDetail] = useState(false);
  const [stats, setStats] = useState<{
    rttMs: number | null;
    jitterMs: number | null;
    packetLossPct: number | null;
    iceConnectionState: string;
  }>({
    rttMs: null,
    jitterMs: null,
    packetLossPct: null,
    iceConnectionState: "unknown",
  });

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const next = await getNetworkStats();
      if (cancelled) return;
      setStats(next);
      setQuality(bucketize(next));
    };
    void poll();
    const id = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [getNetworkStats]);

  const { dot, label, icon } = qualityVisual(quality, t);

  return (
    <Pressable
      onPress={() => setShowDetail((v) => !v)}
      style={[
        styles.pill,
        {
          backgroundColor: showDetail ? "#000000cc" : "#00000099",
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={t("callQuality.a11y", { label })}
    >
      <Ionicons name={icon} size={11} color="#fff" />
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Text style={styles.label}>{label}</Text>
      {showDetail ? (
        <View style={styles.detailRow}>
          <Text style={styles.detailText}>
            {t("callQuality.detail", {
              rtt: stats.rttMs ?? "—",
              loss:
                stats.packetLossPct != null
                  ? stats.packetLossPct.toFixed(1)
                  : "—",
            })}
            {stats.jitterMs != null ? ` · jitter ${Math.round(stats.jitterMs)}ms` : ""}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function bucketize(stats: {
  rttMs: number | null;
  packetLossPct: number | null;
  iceConnectionState: string;
}): Quality {
  if (stats.iceConnectionState === "failed") return "poor";
  if (stats.iceConnectionState === "disconnected") return "poor";
  if (stats.rttMs == null && stats.packetLossPct == null) {
    return stats.iceConnectionState === "connected" ? "good" : "unknown";
  }
  const rtt = stats.rttMs ?? 0;
  const loss = stats.packetLossPct ?? 0;
  if (rtt > 280 || loss > 5) return "poor";
  if (rtt > 140 || loss > 1.5) return "fair";
  return "good";
}

function qualityVisual(
  quality: Quality,
  t: (k: string) => string
): { dot: string; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] } {
  switch (quality) {
    case "good":
      return { dot: "#22c55e", label: t("callQuality.good"), icon: "cellular" };
    case "fair":
      return { dot: "#eab308", label: t("callQuality.fair"), icon: "cellular" };
    case "poor":
      return { dot: "#ef4444", label: t("callQuality.poor"), icon: "warning" };
    case "unknown":
    default:
      return {
        dot: "#9ca3af",
        label: t("callQuality.unknown"),
        icon: "help-circle-outline",
      };
  }
}

function useStyles() {
  return useThemedStyles(() =>
    StyleSheet.create({
      pill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: radii.pill,
      },
      dot: { width: 6, height: 6, borderRadius: 3 },
      label: { fontSize: 10, fontWeight: "800", color: "#fff", letterSpacing: 0.4 },
      detailRow: { marginLeft: 4 },
      detailText: { fontSize: 9, fontWeight: "700", color: "#ffffffd0" },
    })
  );
}
