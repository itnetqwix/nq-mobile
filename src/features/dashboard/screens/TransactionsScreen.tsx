import React from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { radii, space } from "../../../theme/tokens";
import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";

const NAVY = "#000080";

async function fetchTransactions(): Promise<any[]> {
  try {
    const res = await apiClient.get(API_ROUTES.transaction.getPaymentIntent);
    return res.data?.result ?? res.data ?? [];
  } catch {
    return [];
  }
}

function timeLabel(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function TransactionRow({ item }: { item: any }) {
  const amount = item?.amount ?? item?.amount_total ?? 0;
  const currency = (item?.currency ?? "usd").toUpperCase();
  const status = item?.status ?? "unknown";
  const date = timeLabel(item?.created_at ?? item?.createdAt);
  const desc = item?.description ?? item?.metadata?.description ?? "Session payment";
  const isCredit = item?.type === "credit" || item?.amount > 0;

  return (
    <View style={styles.row}>
      <View style={[styles.iconBox, isCredit ? styles.iconCredit : styles.iconDebit]}>
        <Ionicons
          name={isCredit ? "arrow-down-outline" : "arrow-up-outline"}
          size={18}
          color={isCredit ? "#15803d" : "#b91c1c"}
        />
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowDesc} numberOfLines={1}>{desc}</Text>
        <Text style={styles.rowDate}>{date}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowAmount, isCredit ? styles.amountCredit : styles.amountDebit]}>
          {isCredit ? "+" : "-"}{currency} {(amount / 100).toFixed(2)}
        </Text>
        <View style={[styles.statusBadge, getStatusStyle(status)]}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>
    </View>
  );
}

function getStatusStyle(status: string) {
  switch (status) {
    case "succeeded": return { backgroundColor: "#dcfce7" };
    case "pending": return { backgroundColor: "#fef3c7" };
    case "failed": return { backgroundColor: "#fee2e2" };
    default: return { backgroundColor: "#f3f4f6" };
  }
}

export function TransactionsScreen() {
  const { data: transactions = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["transactions"],
    queryFn: fetchTransactions,
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
      data={transactions}
      keyExtractor={(item, i) => item?._id ?? item?.id ?? String(i)}
      renderItem={({ item }) => <TransactionRow item={item} />}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={NAVY} />
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="wallet-outline" size={48} color="#d1d5db" />
          <Text style={styles.emptyTitle}>No transactions yet</Text>
          <Text style={styles.emptyBody}>
            Your payment history will appear here after you complete session bookings.
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
    alignItems: "center",
    justifyContent: "center",
  },
  iconCredit: { backgroundColor: "#dcfce7" },
  iconDebit: { backgroundColor: "#fee2e2" },
  rowInfo: { flex: 1 },
  rowDesc: { fontSize: 14, fontWeight: "600", color: "#111827" },
  rowDate: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  rowRight: { alignItems: "flex-end", gap: 4 },
  rowAmount: { fontSize: 15, fontWeight: "700" },
  amountCredit: { color: "#15803d" },
  amountDebit: { color: "#b91c1c" },
  statusBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  statusText: { fontSize: 11, fontWeight: "600", color: "#374151", textTransform: "capitalize" },

  empty: { alignItems: "center", paddingVertical: space.xl * 2, gap: space.sm, paddingHorizontal: space.lg },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#374151" },
  emptyBody: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20 },
});
