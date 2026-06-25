import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import React, { useMemo } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Button, Pill, TransactionDetailSkeleton } from "../../../components/ui";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import type { MenuStackParamList } from "../../../navigation/types";
import {
  fetchBookingDetail,
  fetchRefundTimeline,
  fetchWalletTransactionDetail,
  type RefundTimelineEvent,
} from "../../wallet/walletApi";
import { useCurrencyFormatter } from "../../../lib/intl";
import { queryKeys } from "../../../lib/queryKeys";
import { SessionTimelineCard } from "../../support/SessionTimelineCard";
import { TrainerEarningsBreakdown } from "../../payments/TrainerEarningsBreakdown";
import { TraineeChargeBreakdown } from "../../payments/TraineeChargeBreakdown";
import { useAuth } from "../../auth/context/AuthContext";
import { AccountType } from "../../../constants/accountType";

type Props = NativeStackScreenProps<MenuStackParamList, "TransactionDetail">;

/**
 * Friendly label for a timeline event `type`. Adding a new event server-side
 * means a single line here; missing types still render the raw token so
 * we never blank-out a section while waiting on copy.
 */
function timelineLabel(type: string): string {
  switch (type) {
    case "charge":
      return "Payment charged";
    case "refund-initiated":
      return "Refund initiated";
    case "refund-bank":
      return "At bank";
    case "refund-completed":
      return "Refund received";
    case "withdrawal-bank":
      return "Sent to bank";
    case "payout-paid":
      return "Payout completed";
    case "topup-pending":
      return "Top-up pending";
    case "topup-succeeded":
      return "Top-up succeeded";
    default:
      return type.replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  }
}

/**
 * Step in the visible refund/payment progress strip. Each step renders
 * as a dot with a label and (optional) timestamp; completed steps are
 * filled in brand colour, active is outlined, pending is muted.
 *
 * Backend `type` strings drive which step group we belong to — we treat
 * anything starting with `refund-` as a refund event so future granular
 * states (`refund-rejected`, `refund-partial`) automatically appear in
 * the strip without a frontend deploy.
 */
type TimelineStepStatus = "completed" | "active" | "pending" | "failed";

export function TransactionDetailScreen({ navigation, route }: Props) {
  const c = useThemeColors();
  const { accountType } = useAuth();
  const isTrainer = accountType === AccountType.TRAINER;
  const fmt = useCurrencyFormatter();
  const styles = useThemedStyles((palette) => StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.lg },
  errorText: { ...typography.bodyMd, color: palette.textMuted },
  content: { padding: space.md, paddingBottom: space.xl, gap: space.sm },
  summaryCard: {
    backgroundColor: palette.brandNavy,
    borderRadius: radii.lg,
    padding: space.lg,
    alignItems: "center",
    gap: space.sm,
    marginBottom: space.sm,
  },
  amountLabel: { color: "rgba(255,255,255,0.75)", fontSize: 14 },
  amountValue: { color: "#fff", fontSize: 32, fontWeight: "700" },
  amountSub: { color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: -4 },
  sectionTitle: { ...typography.subtitle, fontWeight: "700", color: palette.text, marginTop: space.sm },
  card: {
    backgroundColor: palette.surfaceElevated,
    borderRadius: radii.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: palette.border,
    gap: space.sm,
  },
  row: { gap: 2 },
  rowLabel: { ...typography.caption, color: palette.textMuted },
  rowValue: { ...typography.bodyMd, color: palette.text, fontWeight: "500" },
  copyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  actions: { marginTop: space.lg, gap: space.sm },
  timelineCard: {
    backgroundColor: palette.surfaceElevated,
    borderRadius: radii.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: palette.border,
    gap: space.sm,
  },
  timelineRow: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  /** Dot column (24px wide); the vertical connector line is drawn as a
   *  taller view that hides under the next dot — that keeps each row a
   *  single component and avoids a SVG dependency. */
  timelineDotCol: { width: 24, alignItems: "center" },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  timelineDotCompleted: { backgroundColor: palette.success, borderColor: palette.success },
  timelineDotActive: { borderColor: palette.brandNavy, backgroundColor: palette.brandNavy },
  timelineDotFailed: { backgroundColor: palette.danger, borderColor: palette.danger },
  timelineConnector: {
    flex: 1,
    width: 2,
    backgroundColor: palette.border,
    marginVertical: 2,
  },
  timelineConnectorCompleted: { backgroundColor: palette.success },
  timelineBody: { flex: 1, paddingBottom: space.md },
  timelineLabel: { ...typography.bodyMd, fontWeight: "600", color: palette.text },
  timelineMeta: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
}));

  function DetailRow({ label, value }: { label: string; value?: string | null }) {
    if (!value) return null;
    return (
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    );
  }

  const { bookingId, ledgerEntryId } = route.params;
  const timelineKey = ledgerEntryId ?? bookingId ?? "";

  const { data, isLoading, error } = useQuery({
    queryKey: ["transaction-detail", bookingId, ledgerEntryId],
    queryFn: async () => {
      if (ledgerEntryId) return fetchWalletTransactionDetail(ledgerEntryId);
      if (bookingId) return fetchBookingDetail(bookingId);
      throw new Error("Missing transaction reference");
    },
    enabled: !!(bookingId || ledgerEntryId),
  });

  /**
   * Refund / payment timeline. Tolerates a 404 / network failure by
   * returning `events: []` — the UI hides the section when empty so a
   * missing endpoint doesn't break the rest of the screen.
   */
  const { data: timelineData } = useQuery({
    queryKey: queryKeys.wallet.refundTimeline(timelineKey),
    queryFn: () => fetchRefundTimeline(timelineKey),
    enabled: !!timelineKey,
    staleTime: 30_000,
  });

  /**
   * Synthesise a fallback timeline from the booking / ledger payload when
   * the dedicated endpoint hasn't returned events. This lets us show a
   * useful "charged → refund initiated → received" strip even on
   * backends that haven't shipped `/wallet/transactions/:id/timeline`.
   */
  const synthesizedTimeline = useMemo<RefundTimelineEvent[]>(() => {
    if (!data) return [];
    const events: RefundTimelineEvent[] = [];
    const createdAt =
      data.timeline?.createdAt ?? data.createdAt ?? data.session?.booked_date;
    if (createdAt) {
      events.push({ type: "charge", timestamp: createdAt, status: "completed" });
    }
    const refundStatus = String(
      data.timeline?.refund_status ?? data.refund_status ?? ""
    ).toLowerCase();
    if (refundStatus) {
      const refundInitiatedAt = data.timeline?.refund_initiated_at ?? data.refund_initiated_at;
      if (refundInitiatedAt || refundStatus.includes("init") || refundStatus.includes("pending")) {
        events.push({
          type: "refund-initiated",
          timestamp: refundInitiatedAt ?? null,
          status: refundStatus.includes("complete") ? "completed" : "pending",
        });
      }
      if (refundStatus.includes("bank") || refundStatus.includes("processing")) {
        events.push({ type: "refund-bank", timestamp: null, status: "active" });
      }
      if (refundStatus.includes("complete") || refundStatus.includes("received") || refundStatus.includes("succeeded")) {
        const completedAt = data.timeline?.refund_completed_at ?? data.refund_completed_at;
        events.push({ type: "refund-completed", timestamp: completedAt ?? null, status: "completed" });
      }
    }
    return events;
  }, [data]);

  const events = (timelineData?.events && timelineData.events.length > 0)
    ? timelineData.events
    : synthesizedTimeline;

  const supportBookingId =
    data?.support?.booking_id ?? bookingId ?? data?.booking_id ?? undefined;

  const chargeTotal =
    data?.amounts?.charge_total ??
    data?.summary?.charge_total ??
    data?.payment_summary?.displayAmountTrainee;
  const sessionSubtotal =
    data?.amounts?.session_subtotal ?? data?.summary?.session_subtotal;
  const amount =
    data?.amounts?.amount ??
    data?.summary?.amount ??
    (isTrainer
      ? data?.amounts?.trainer_net ?? data?.summary?.trainer_net
      : chargeTotal);
  const status = data?.status ?? data?.summary?.status;
  const paymentMethod =
    data?.payment?.method_label ??
    data?.payment_summary?.methodLabel ??
    data?.payment?.method;
  const showSessionSubtotal =
    !isTrainer &&
    typeof sessionSubtotal === "number" &&
    typeof chargeTotal === "number" &&
    Math.abs(sessionSubtotal - chargeTotal) > 0.009;

  const copyId = async () => {
    const id = data?.payment?.transaction_id ?? supportBookingId;
    if (!id) return;
    await Share.share({ message: String(id) });
  };

  const reportIssue = () => {
    const subject = `Issue with transaction ${supportBookingId ?? ""}`.trim();
    const description = [
      `Transaction ID: ${data?.payment?.transaction_id ?? supportBookingId ?? "—"}`,
      `Amount: $${amount?.toFixed?.(2) ?? amount ?? "—"}`,
      `Status: ${status ?? "—"}`,
      `Payment method: ${paymentMethod ?? "—"}`,
    ].join("\n");
    navigation.navigate("ReportIssue", {
      bookingId: supportBookingId,
      prefillSubject: subject,
      prefillDescription: description,
    });
  };

  if (isLoading) {
    return <TransactionDetailSkeleton />;
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Could not load transaction details.</Text>
      </View>
    );
  }

  const session = data.session;
  const parties = data.parties;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.summaryCard}>
        <Text style={styles.amountLabel}>
          {isTrainer ? "You earn" : "Total paid"}
        </Text>
        <Text style={styles.amountValue}>
          {fmt(typeof amount === "number" ? amount : Number(amount ?? 0), {
            currency: data?.currency ?? data?.amounts?.currency ?? data?.payment_summary?.currency,
          })}
        </Text>
        {showSessionSubtotal ? (
          <Text style={styles.amountSub}>
            Session price{" "}
            {fmt(sessionSubtotal!, {
              currency: data?.currency ?? data?.amounts?.currency ?? data?.payment_summary?.currency,
            })}
          </Text>
        ) : null}
        {status ? <Pill label={String(status)} tone="neutral" /> : null}
      </View>

      <Text style={styles.sectionTitle}>Session</Text>
      <View style={styles.card}>
        <DetailRow
          label="Date"
          value={
            session?.booked_date
              ? new Date(session.booked_date).toLocaleDateString()
              : undefined
          }
        />
        <DetailRow
          label="Time"
          value={
            session?.session_start_time && session?.session_end_time
              ? `${session.session_start_time} – ${session.session_end_time}`
              : undefined
          }
        />
        <DetailRow label="Trainer" value={parties?.trainer_name} />
        <DetailRow label="Trainee" value={parties?.trainee_name} />
        <DetailRow label="Status" value={session?.status ? String(session.status) : undefined} />
      </View>

      {supportBookingId ? (
        <SessionTimelineCard bookingId={String(supportBookingId)} />
      ) : null}

      <Text style={styles.sectionTitle}>Payment</Text>
      <View style={styles.card}>
        <DetailRow label="Method" value={paymentMethod ? String(paymentMethod) : undefined} />
        <DetailRow label="Payment intent" value={data.payment?.payment_intent_id} />
        <Pressable onPress={copyId} style={styles.copyRow}>
          <DetailRow label="Transaction ID" value={data.payment?.transaction_id ?? supportBookingId} />
          <Ionicons name="copy-outline" size={18} color={c.iconPrimary} />
        </Pressable>
      </View>

      {isTrainer && (data.trainer_earnings_breakdown || data.escrow) ? (
        <TrainerEarningsBreakdown
          data={
            data.trainer_earnings_breakdown ??
            (data.escrow
              ? {
                  sessionSubtotalCents: data.escrow.session_subtotal_minor,
                  surgeCents: data.escrow.surge_minor,
                  commissionRate: data.escrow.commission_rate,
                  commissionCents: data.escrow.platform_fee_minor,
                  trainerPlatformFeeCents: data.escrow.trainer_platform_fee_minor,
                  trainerNetCents: data.escrow.trainer_net_minor,
                  escrowStatus: data.escrow.status,
                  holdCount: data.escrow.hold_count,
                }
              : null)
          }
          holds={data.escrow_holds}
          currency={data?.amounts?.currency ?? data?.payment_summary?.currency}
        />
      ) : null}

      {!isTrainer && data.payment_summary ? (
        <TraineeChargeBreakdown
          data={{
            sessionSubtotalMinor: data.payment_summary.sessionSubtotalMinor,
            surgeMinor: data.payment_summary.surgeMinor,
            traineePlatformFeeMinor: data.payment_summary.traineePlatformFeeMinor,
            processingFeeMinor: data.payment_summary.processingFeeMinor,
            taxMinor: data.payment_summary.taxMinor,
            chargeTotalMinor: data.payment_summary.chargeTotalMinor,
          }}
          currency={data?.amounts?.currency ?? data?.payment_summary?.currency}
        />
      ) : null}

      {events.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Timeline</Text>
          <View style={styles.timelineCard}>
            {events.map((event, idx) => {
              const status: TimelineStepStatus =
                event.status === "completed"
                  ? "completed"
                  : event.status === "failed"
                    ? "failed"
                    : event.status === "active" || event.status === "pending"
                      ? "active"
                      : "pending";
              const isLast = idx === events.length - 1;
              const dotStyle = [
                styles.timelineDot,
                status === "completed" && styles.timelineDotCompleted,
                status === "active" && styles.timelineDotActive,
                status === "failed" && styles.timelineDotFailed,
              ];
              return (
                <View key={event.id ?? `${event.type}-${idx}`} style={styles.timelineRow}>
                  <View style={styles.timelineDotCol}>
                    <View style={dotStyle} />
                    {!isLast ? (
                      <View
                        style={[
                          styles.timelineConnector,
                          status === "completed" && styles.timelineConnectorCompleted,
                        ]}
                      />
                    ) : null}
                  </View>
                  <View style={styles.timelineBody}>
                    <Text style={styles.timelineLabel}>
                      {event.label ??
                        timelineLabel(event.type)}
                    </Text>
                    <Text style={styles.timelineMeta}>
                      {event.timestamp
                        ? new Date(event.timestamp).toLocaleString()
                        : status === "active"
                          ? "In progress"
                          : status === "pending"
                            ? "Not yet"
                            : "—"}
                      {event.reference ? ` · Ref ${event.reference}` : ""}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      ) : null}

      <View style={styles.actions}>
        {data.support?.reportAllowed !== false ? (
          <Button label="Report an issue" onPress={reportIssue} variant="secondary" fullWidth />
        ) : null}
        <Button label="Copy transaction ID" onPress={copyId} variant="secondary" fullWidth />
      </View>
    </ScrollView>
  );
}


