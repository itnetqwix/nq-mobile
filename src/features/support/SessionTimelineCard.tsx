import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { DateTime } from "luxon";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Pill } from "../../components/ui";
import { fetchSessionTimeline } from "../calling/sessionLiveApi";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../theme";

type Props = {
  bookingId: string | undefined | null;
  title?: string;
};

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const dt = DateTime.fromISO(String(iso));
  return dt.isValid ? dt.toFormat("MMM d, yyyy · h:mm a") : String(iso);
}

export function SessionTimelineCard({ bookingId, title = "Session timeline" }: Props) {
  const c = useThemeColors();
  const styles = useStyles();

  const q = useQuery({
    queryKey: ["sessionTimeline", bookingId],
    queryFn: () => fetchSessionTimeline(bookingId!),
    enabled: !!bookingId,
    staleTime: 20_000,
  });

  if (!bookingId) return null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="time-outline" size={18} color={c.brandNavy} />
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.sub}>
        Join times, extensions, and live timer state — helpful when reporting an issue.
      </Text>

      {q.isLoading ? (
        <ActivityIndicator color={c.brandNavy} style={{ marginVertical: space.sm }} />
      ) : q.isError || !q.data ? (
        <Text style={styles.muted}>Timeline unavailable for this session.</Text>
      ) : (
        <View style={styles.body}>
          <View style={styles.chips}>
            <Pill label={q.data.status} tone="neutral" />
            {q.data.isInstant ? <Pill label="Instant" tone="info" /> : null}
            {q.data.instantPhase ? (
              <Pill label={`Phase: ${q.data.instantPhase}`} tone="neutral" />
            ) : null}
            {q.data.timer?.status ? (
              <Pill label={`Timer: ${q.data.timer.status}`} tone="neutral" />
            ) : null}
          </View>

          <Row label="Accepted" value={fmt(q.data.acceptedAt)} />
          <Row label="Join deadline" value={fmt(q.data.joinDeadlineAt)} />
          <Row label="Both joined" value={fmt(q.data.bothJoinedAt)} />
          <Row label="Start (UTC)" value={fmt(q.data.startTimeUtc)} />
          <Row label="End (UTC)" value={fmt(q.data.endTimeUtc)} />

          {q.data.extensionRequests?.length ? (
            <>
              <Text style={styles.sectionLabel}>Extension requests</Text>
              {q.data.extensionRequests.map((r) => (
                <Text key={r.requestId} style={styles.eventLine}>
                  {r.status} · +{r.minutes} min · ${Number(r.amount).toFixed(2)}
                </Text>
              ))}
            </>
          ) : null}

          {q.data.extensions?.length ? (
            <>
              <Text style={styles.sectionLabel}>Applied extensions</Text>
              {q.data.extensions.map((e, i) => (
                <Text key={`ext-${i}`} style={styles.eventLine}>
                  +{e.minutes} min · ${Number(e.amount).toFixed(2)} · {fmt(e.appliedAt)}
                </Text>
              ))}
            </>
          ) : null}
        </View>
      )}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      card: {
        backgroundColor: palette.surfaceMuted,
        borderRadius: radii.md,
        padding: space.md,
        borderWidth: 1,
        borderColor: palette.border,
        gap: space.xs,
      },
      headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
      title: { ...typography.subtitle, color: palette.brandNavy },
      sub: { ...typography.caption, color: palette.textMuted, marginBottom: space.xs },
      body: { gap: 6 },
      chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 4 },
      row: { flexDirection: "row", gap: space.sm },
      rowLabel: {
        ...typography.caption,
        color: palette.textMuted,
        fontWeight: "600",
        minWidth: 108,
      },
      rowValue: { ...typography.caption, color: palette.text, flex: 1 },
      sectionLabel: {
        ...typography.caption,
        fontWeight: "700",
        color: palette.text,
        marginTop: space.xs,
      },
      eventLine: { ...typography.caption, color: palette.textSecondary },
      muted: { ...typography.caption, color: palette.textMuted },
    })
  );
}
