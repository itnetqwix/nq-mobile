/**
 * Trainee in-call payment / escrow summary (session-detail API).
 */

import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { fetchSessionDetail } from "../../home/api/homeApi";
import { queryKeys } from "../../../lib/queryKeys";
import {
  escrowMilestoneCopy,
  type EscrowMilestone,
} from "../escrowMilestone";
import { meetingTheme } from "../meetingTheme";

type Props = {
  sessionId: string;
  enabled: boolean;
  topOffset: number;
  /** Optional UX milestone override (timer warnings, departure, post-call). */
  escrowMilestone?: EscrowMilestone | null;
};

function fmtMoneyMinor(minor: unknown): string {
  const n = Number(minor);
  if (!Number.isFinite(n)) return "—";
  return `$${(n / 100).toFixed(2)}`;
}

function escrowStatusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === "held") return "Held in escrow";
  if (s === "releasing") return "Releasing to coach";
  if (s === "released") return "Released";
  if (s === "refunded") return "Refunded";
  if (s === "disputed") return "Disputed";
  return status;
}

export function MeetingPaymentSummaryChip({
  sessionId,
  enabled,
  topOffset,
  escrowMilestone = "session_active",
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.sessions.detail(sessionId),
    queryFn: () => fetchSessionDetail(sessionId),
    enabled: enabled && !!sessionId,
    staleTime: 30_000,
    refetchInterval: enabled ? 45_000 : false,
  });

  const escrow = data?.escrow as Record<string, unknown> | null | undefined;
  const hasEscrow = !!escrow && Number(escrow.charge_total_minor ?? 0) > 0;

  const lines = useMemo(() => {
    if (!escrow) return [];
    const rows: { label: string; value: string }[] = [];
    if (Number(escrow.session_subtotal_minor) > 0) {
      rows.push({
        label: "Session",
        value: fmtMoneyMinor(escrow.session_subtotal_minor),
      });
    }
    if (Number(escrow.surge_minor) > 0) {
      rows.push({
        label: "Peak pricing",
        value: fmtMoneyMinor(escrow.surge_minor),
      });
    }
    if (Number(escrow.trainee_platform_fee_minor) > 0) {
      rows.push({
        label: "Platform fee",
        value: fmtMoneyMinor(escrow.trainee_platform_fee_minor),
      });
    }
    if (Number(escrow.processing_fee_minor) > 0) {
      rows.push({
        label: "Processing",
        value: fmtMoneyMinor(escrow.processing_fee_minor),
      });
    }
    if (Number(escrow.tax_minor) > 0) {
      rows.push({ label: "Tax", value: fmtMoneyMinor(escrow.tax_minor) });
    }
    return rows;
  }, [escrow]);

  if (!enabled) return null;
  if (isLoading) {
    return (
      <View style={[styles.wrap, { top: topOffset }]} pointerEvents="box-none">
        <View style={styles.chip}>
          <ActivityIndicator size="small" color="#fff" />
        </View>
      </View>
    );
  }
  if (!hasEscrow) return null;

  const total = fmtMoneyMinor(escrow!.charge_total_minor);
  const status = String(escrow!.status ?? "held");
  const milestoneCopy =
    escrowMilestone != null ? escrowMilestoneCopy(escrowMilestone) : null;

  return (
    <View style={[styles.wrap, { top: topOffset }]} pointerEvents="box-none">
      <Pressable
        style={styles.chip}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel="Payment summary"
      >
        <Ionicons name="card-outline" size={14} color="#fff" />
        <Text style={styles.chipText}>{total}</Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={14}
          color="rgba(255,255,255,0.85)"
        />
      </Pressable>
      {expanded ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>
            {milestoneCopy?.title ?? "Payment held in escrow"}
          </Text>
          {milestoneCopy?.body ? (
            <Text style={styles.panelMilestone}>{milestoneCopy.body}</Text>
          ) : null}
          <Text style={styles.panelStatus}>
            Status: {escrowStatusLabel(status)}
          </Text>
          {lines.map((row) => (
            <View key={row.label} style={styles.row}>
              <Text style={styles.rowKey}>{row.label}</Text>
              <Text style={styles.rowVal}>{row.value}</Text>
            </View>
          ))}
          <View style={[styles.row, styles.rowTotal]}>
            <Text style={styles.rowKeyBold}>Total charged</Text>
            <Text style={styles.rowValBold}>{total}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 12,
    zIndex: 24,
    maxWidth: "72%",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0, 0, 128, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  chipText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  panel: {
    marginTop: 6,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.78)",
    borderWidth: 1,
    borderColor: meetingTheme.border,
    gap: 4,
  },
  panelTitle: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
  },
  panelMilestone: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 4,
  },
  panelStatus: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  rowTotal: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.25)",
  },
  rowKey: { color: "rgba(255,255,255,0.7)", fontSize: 11 },
  rowVal: { color: "#fff", fontSize: 11, fontWeight: "600" },
  rowKeyBold: { color: "#fff", fontSize: 11, fontWeight: "700" },
  rowValBold: { color: "#fff", fontSize: 12, fontWeight: "800" },
});
