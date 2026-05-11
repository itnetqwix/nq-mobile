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
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { radii, space } from "../../../theme/tokens";
import { fetchNotifications } from "../../home/api/homeApi";

const NAVY = "#000080";

function getNotificationIcon(title?: string): keyof typeof Ionicons.glyphMap {
  const t = (title ?? "").toLowerCase();
  if (t.includes("book") || t.includes("session")) return "calendar-outline";
  if (t.includes("message") || t.includes("chat")) return "chatbubble-outline";
  if (t.includes("accept") || t.includes("confirm")) return "checkmark-circle-outline";
  if (t.includes("cancel") || t.includes("reject")) return "close-circle-outline";
  if (t.includes("payment") || t.includes("transaction")) return "wallet-outline";
  return "notifications-outline";
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return "";
  }
}

function NotificationItem({ item }: { item: any }) {
  const icon = getNotificationIcon(item?.title);
  const isRead = item?.isRead ?? item?.is_read ?? false;

  return (
    <View style={[styles.item, !isRead && styles.itemUnread]}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={22} color={NAVY} />
      </View>
      <View style={styles.itemContent}>
        {!!item?.title && (
          <Text style={[styles.itemTitle, !isRead && styles.itemTitleBold]}>
            {item.title}
          </Text>
        )}
        {!!item?.body && (
          <Text style={styles.itemBody} numberOfLines={2}>
            {item.body}
          </Text>
        )}
        {!!item?.createdAt && (
          <Text style={styles.itemTime}>{timeAgo(item.createdAt)}</Text>
        )}
      </View>
      {!isRead && <View style={styles.unreadDot} />}
    </View>
  );
}

export function NotificationsScreen() {
  const { data: notifications = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(1, 50),
    staleTime: 30_000,
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
      data={notifications}
      keyExtractor={(item, i) => item?._id ?? String(i)}
      renderItem={({ item }) => <NotificationItem item={item} />}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={NAVY} />
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="notifications-off-outline" size={48} color="#d1d5db" />
          <Text style={styles.emptyTitle}>No notifications</Text>
          <Text style={styles.emptyBody}>
            Booking updates, messages, and alerts will appear here.
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingBottom: space.xl },

  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    gap: space.sm,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f3f4f6",
  },
  itemUnread: { backgroundColor: "#eff6ff" },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f0f4ff",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  itemContent: { flex: 1 },
  itemTitle: { fontSize: 14, color: "#374151", lineHeight: 20 },
  itemTitleBold: { fontWeight: "700", color: "#111827" },
  itemBody: { fontSize: 13, color: "#6b7280", marginTop: 2, lineHeight: 18 },
  itemTime: { fontSize: 12, color: "#9ca3af", marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: NAVY, marginTop: 6 },

  empty: { alignItems: "center", paddingVertical: space.xl * 2, gap: space.sm },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#374151" },
  emptyBody: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20, paddingHorizontal: space.lg },
});
