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

async function fetchClips(): Promise<any[]> {
  const res = await apiClient.get(API_ROUTES.common.getClips);
  return res.data?.result ?? res.data ?? [];
}

function ClipRow({ item }: { item: any }) {
  const name = item?.file_name ?? item?.name ?? "Clip";
  const size = item?.size ? `${(item.size / 1024 / 1024).toFixed(1)} MB` : "";
  const date = item?.createdAt
    ? new Date(item.createdAt).toLocaleDateString()
    : "";

  return (
    <View style={styles.row}>
      <View style={styles.iconBox}>
        <Ionicons name="videocam-outline" size={22} color={NAVY} />
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={1}>{name}</Text>
        <Text style={styles.rowMeta}>
          {[size, date].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <Ionicons name="ellipsis-vertical" size={18} color="#9ca3af" />
    </View>
  );
}

export function UploadsScreen() {
  const { data: clips = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["clips"],
    queryFn: fetchClips,
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
      data={clips}
      keyExtractor={(item, i) => item?._id ?? String(i)}
      renderItem={({ item }) => <ClipRow item={item} />}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={NAVY} />
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="cloud-upload-outline" size={48} color="#d1d5db" />
          <Text style={styles.emptyTitle}>No uploads yet</Text>
          <Text style={styles.emptyBody}>
            Training clips and files you upload will appear here.
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
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: "#f0f4ff",
    alignItems: "center",
    justifyContent: "center",
  },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: "600", color: "#111827" },
  rowMeta: { fontSize: 12, color: "#9ca3af", marginTop: 2 },

  empty: { alignItems: "center", paddingVertical: space.xl * 2, gap: space.sm, paddingHorizontal: space.lg },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#374151" },
  emptyBody: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20 },
});
