import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Button, Pill } from "../../../components/ui";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import type { MenuStackParamList } from "../../../navigation/types";
import { fetchBookingDetail, fetchWalletTransactionDetail } from "../../wallet/walletApi";

type Props = NativeStackScreenProps<MenuStackParamList, "TransactionDetail">;

export function TransactionDetailScreen({ navigation, route }: Props) {
  const c = useThemeColors();
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

  const { data, isLoading, error } = useQuery({
    queryKey: ["transaction-detail", bookingId, ledgerEntryId],
    queryFn: async () => {
      if (ledgerEntryId) return fetchWalletTransactionDetail(ledgerEntryId);
      if (bookingId) return fetchBookingDetail(bookingId);
      throw new Error("Missing transaction reference");
    },
    enabled: !!(bookingId || ledgerEntryId),
  });

  const supportBookingId =
    data?.support?.booking_id ?? bookingId ?? data?.booking_id ?? undefined;
  const amount =
    data?.amounts?.amount ??
    data?.summary?.amount ??
  undefined;
  const status = data?.status ?? data?.summary?.status;
  const paymentMethod = data?.payment?.method;

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
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.brandNavy} />
      </View>
    );
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
        <Text style={styles.amountLabel}>Amount</Text>
        <Text style={styles.amountValue}>
          ${typeof amount === "number" ? amount.toFixed(2) : amount ?? "0.00"}
        </Text>
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

      <Text style={styles.sectionTitle}>Payment</Text>
      <View style={styles.card}>
        <DetailRow label="Method" value={paymentMethod ? String(paymentMethod) : undefined} />
        <DetailRow label="Payment intent" value={data.payment?.payment_intent_id} />
        <Pressable onPress={copyId} style={styles.copyRow}>
          <DetailRow label="Transaction ID" value={data.payment?.transaction_id ?? supportBookingId} />
          <Ionicons name="copy-outline" size={18} color={c.brandNavy} />
        </Pressable>
      </View>

      {data.timeline ? (
        <>
          <Text style={styles.sectionTitle}>Timeline</Text>
          <View style={styles.card}>
            <DetailRow
              label="Created"
              value={
                data.timeline.createdAt
                  ? new Date(data.timeline.createdAt).toLocaleString()
                  : undefined
              }
            />
            <DetailRow label="Refund status" value={data.timeline.refund_status} />
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


