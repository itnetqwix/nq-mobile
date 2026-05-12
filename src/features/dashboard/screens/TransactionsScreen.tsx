import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { space } from "../../../theme/tokens";
import { AccountType } from "../../../constants/accountType";
import { useAuth } from "../../auth/context/AuthContext";
import { fetchBookingTransactions } from "../../home/api/homeApi";

const NAVY = "#000080";

function formatBookedDate(d?: string): string {
  if (!d) return "";
  try {
    const dt = new Date(d);
    if (!Number.isNaN(dt.getTime())) {
      return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    }
  } catch {
    /* fall through */
  }
  return String(d);
}

function bookingAmountDisplay(booking: any, isTrainer: boolean): string {
  const amount = Number(booking?.amount ?? 0);
  const fee = Number(booking?.application_fee_amount ?? 0);
  const usd = isTrainer ? amount - fee : amount;
  return `${usd.toFixed(2)} USD`;
}

function TransactionRow({ booking, isTrainer }: { booking: any; isTrainer: boolean }) {
  const other = isTrainer ? booking?.trainee_info : booking?.trainer_info;
  const name = other?.fullName ?? other?.fullname ?? "Session";
  const status = booking?.refund_status ?? booking?.status ?? "—";
  const dateLabel = formatBookedDate(booking?.booked_date);
  const timeRange =
    booking?.session_start_time && booking?.session_end_time
      ? `${booking.session_start_time} – ${booking.session_end_time}`
      : "";

  return (
    <View style={styles.row}>
      <View style={styles.iconBox}>
        <Ionicons name="receipt-outline" size={18} color={NAVY} />
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowDesc} numberOfLines={2}>
          Session with {name}
        </Text>
        <Text style={styles.rowDate}>
          {[dateLabel, timeRange].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowAmount}>{bookingAmountDisplay(booking, isTrainer)}</Text>
        <View style={[styles.statusBadge, getStatusStyle(status)]}>
          <Text style={styles.statusText}>{String(status)}</Text>
        </View>
      </View>
    </View>
  );
}

function getStatusStyle(status: string) {
  const s = String(status).toLowerCase();
  if (s.includes("success") || s.includes("confirm") || s.includes("paid")) {
    return { backgroundColor: "#dcfce7" };
  }
  if (s.includes("pending") || s.includes("process")) {
    return { backgroundColor: "#fef3c7" };
  }
  if (s.includes("fail") || s.includes("cancel") || s.includes("refund")) {
    return { backgroundColor: "#fee2e2" };
  }
  return { backgroundColor: "#f3f4f6" };
}

export function TransactionsScreen() {
  const { accountType } = useAuth();
  const isTrainer = accountType === AccountType.TRAINER;

  const { data: rows = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["transactions", "booking-list-by-id"],
    queryFn: () => fetchBookingTransactions({ page: 1, limit: 500 }),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={NAVY} />
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(item, i) => item?._id ?? String(i)}
      renderItem={({ item }) => <TransactionRow booking={item} isTrainer={isTrainer} />}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={NAVY} />
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="wallet-outline" size={48} color="#d1d5db" />
          <Text style={styles.emptyTitle}>No bookings in this window</Text>
          <Text style={styles.emptyBody}>
            Same data as the website transactions panel: sessions from the last few days onward
            with amounts and status (your booking list API).
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingBottom: space.xl },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f3f4f6",
    backgroundColor: "#fff",
    gap: space.sm,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f0f4ff",
    alignItems: "center",
    justifyContent: "center",
  },
  rowInfo: { flex: 1 },
  rowDesc: { fontSize: 14, fontWeight: "600", color: "#111827" },
  rowDate: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  rowRight: { alignItems: "flex-end", gap: 4 },
  rowAmount: { fontSize: 14, fontWeight: "700", color: "#111827" },
  statusBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  statusText: { fontSize: 11, fontWeight: "600", color: "#374151", textTransform: "capitalize" },

  empty: { alignItems: "center", paddingVertical: space.xl * 2, gap: space.sm, paddingHorizontal: space.lg },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#374151" },
  emptyBody: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20 },
});
