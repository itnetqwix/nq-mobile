import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { EmptyState } from "../../../components/ui";
import { space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import type { MenuStackParamList } from "../../../navigation/types";
import { fetchWalletLedger } from "../walletApi";
import { formatLedgerAmount, ledgerReferenceLabel } from "../lib/ledgerLabels";

const PAGE_SIZE = 25;

export function WalletActivityScreen() {
  const c = useThemeColors();
  const styles = useThemedStyles((c) => StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingBottom: space.xl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSubtle,
    backgroundColor: c.surfaceElevated,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.brandSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...typography.bodyMd, fontWeight: "600", color: c.text },
  date: { ...typography.caption, color: c.textMuted, marginTop: 2 },
  amount: { ...typography.bodyMd, fontWeight: "700" },
  credit: { color: c.success },
  debit: { color: c.text },
}));

  const navigation = useNavigation<NativeStackNavigationProp<MenuStackParamList>>();

  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["wallet", "ledger"],
    queryFn: ({ pageParam }) => fetchWalletLedger(pageParam, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _all, lastPageParam) => {
      const items = lastPage?.items ?? [];
      return items.length >= PAGE_SIZE ? lastPageParam + 1 : undefined;
    },
    staleTime: 30_000,
  });

  const rows = data?.pages.flatMap((p) => p?.items ?? []) ?? [];

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.brandNavy} />
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(item, i) => item?.entry_id ?? String(i)}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.brandNavy} />
      }
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
      }}
      onEndReachedThreshold={0.4}
      ListFooterComponent={
        isFetchingNextPage ? (
          <ActivityIndicator style={{ padding: space.md }} color={c.brandNavy} />
        ) : null
      }
      renderItem={({ item }) => (
        <Pressable
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
          onPress={() =>
            item?.entry_id &&
            navigation.navigate("TransactionDetail", { ledgerEntryId: String(item.entry_id) })
          }
        >
          <View style={styles.iconBox}>
            <Ionicons name="swap-horizontal" size={18} color={c.brandNavy} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{ledgerReferenceLabel(item.reference_type)}</Text>
            <Text style={styles.date}>
              {item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}
            </Text>
          </View>
          <Text
            style={[
              styles.amount,
              item.entry_type === "credit" ? styles.credit : styles.debit,
            ]}
          >
            {formatLedgerAmount(item.entry_type, item.amount_minor)}
          </Text>
        </Pressable>
      )}
      ListEmptyComponent={
        <EmptyState
          icon="time-outline"
          title="No activity yet"
          description="Top-ups and wallet payments will show here."
        />
      }
    />
  );
}


