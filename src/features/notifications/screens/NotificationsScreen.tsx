import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { EmptyState, Skeleton } from "../../../components/ui";
import type { RootStackParamList, ShellSurfaceRouteId } from "../../../navigation/types";
import { colors, radii, space, typography } from "../../../theme";
import { fetchNotifications } from "../../home/api/homeApi";
import { useNotifications } from "../NotificationContext";

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

function NotificationItem({
  item,
  onPress,
}: {
  item: any;
  onPress: () => void;
}) {
  const icon = getNotificationIcon(item?.title);
  const isRead = item?.isRead ?? item?.is_read ?? false;
  const bodyText = item?.body ?? item?.description ?? "";

  return (
    <Pressable
      style={({ pressed }) => [
        styles.item,
        !isRead && styles.itemUnread,
        pressed && styles.itemPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item?.title ?? "notification"}`}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={22} color={colors.brand} />
      </View>
      <View style={styles.itemContent}>
        {!!item?.title && (
          <Text style={[styles.itemTitle, !isRead && styles.itemTitleBold]}>
            {item.title}
          </Text>
        )}
        {!!bodyText && (
          <Text style={styles.itemBody} numberOfLines={3}>
            {bodyText}
          </Text>
        )}
        {!!item?.createdAt && (
          <Text style={styles.itemTime}>{timeAgo(item.createdAt)}</Text>
        )}
      </View>
      {!isRead && <View style={styles.unreadDot} />}
      <Ionicons name="chevron-forward" size={16} color={colors.borderStrong} style={styles.chev} />
    </Pressable>
  );
}

type ShellNav = NativeStackNavigationProp<RootStackParamList>;

/** Map a notification (title + bookingInfo) onto a navigation action. The
 *  same title-based routing the toast uses, plus bookingInfo deep-linking
 *  when the backend supplies it. */
function buildNotificationRoute(item: any) {
  const title = String(item?.title ?? "").toLowerCase();
  const booking = item?.bookingInfo ?? item?.booking_info ?? null;

  if (
    title.includes("book") ||
    title.includes("session") ||
    title.includes("confirm") ||
    title.includes("reminder") ||
    title.includes("minute") ||
    title.includes("ended") ||
    title.includes("cancel") ||
    booking?.lessonId
  ) {
    return { kind: "feature", featureId: "upcoming-sessions" } as const;
  }
  if (title.includes("friend")) {
    return { kind: "feature", featureId: "friends" } as const;
  }
  if (title.includes("clip")) {
    return { kind: "shell", surfaceId: "clips" as ShellSurfaceRouteId } as const;
  }
  if (title.includes("plan")) {
    return { kind: "shell", surfaceId: "gamePlans" as ShellSurfaceRouteId } as const;
  }
  if (title.includes("payment") || title.includes("transaction")) {
    return { kind: "shell", surfaceId: "transactions" as ShellSurfaceRouteId } as const;
  }
  if (title.includes("message") || title.includes("chat")) {
    return { kind: "tab", tab: "Chats" as const } as const;
  }
  return null;
}

export function NotificationsScreen() {
  const navigation = useNavigation<ShellNav>();
  const { markFirstPageRead, refreshInbox } = useNotifications();

  const { data: notifications = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(1, 50),
    staleTime: 30_000,
  });

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          await markFirstPageRead();
          if (!cancelled) await refreshInbox();
        } catch {
          /* non-blocking */
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [markFirstPageRead, refreshInbox])
  );

  const handleNotificationPress = useCallback(
    (item: any) => {
      const route = buildNotificationRoute(item);
      if (!route) return;
      /**
       * We are already inside Main → Menu → ShellSurface (Notifications). Use
       * relative navigation so we stay in the same tab stack when possible.
       */
      try {
        if (route.kind === "shell") {
          (navigation as any).push("ShellSurface", { surfaceId: route.surfaceId });
        } else if (route.kind === "feature") {
          (navigation as any).push("DashboardFeature", {
            featureId: route.featureId,
          });
        } else if (route.kind === "tab") {
          (navigation as any).navigate("Main", {
            screen: "Tabs",
            params: { screen: route.tab },
          });
        }
      } catch {
        /* swallow — non-blocking */
      }
    },
    [navigation]
  );

  if (isLoading) {
    return (
      <View style={{ padding: space.md }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={{ marginBottom: space.sm, flexDirection: "row", gap: space.sm, alignItems: "center" }}
          >
            <Skeleton width={36} height={36} radius={18} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="55%" height={12} />
              <Skeleton width="85%" height={10} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <FlatList
      data={notifications}
      keyExtractor={(item, i) => item?._id ?? String(i)}
      renderItem={({ item }) => (
        <NotificationItem
          item={item}
          onPress={() => handleNotificationPress(item)}
        />
      )}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand} />
      }
      ListEmptyComponent={
        <EmptyState
          icon="notifications-off-outline"
          title="No notifications"
          description="Booking updates, messages, and alerts will appear here."
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingBottom: space.xl, backgroundColor: colors.background },

  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    gap: space.sm,
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemUnread: { backgroundColor: colors.brandAccentSubtle },
  itemPressed: { opacity: 0.85 },
  chev: { marginLeft: 4 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandSubtle,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  itemContent: { flex: 1 },
  itemTitle: { ...typography.bodyMd, color: colors.textSecondary },
  itemTitleBold: { fontWeight: "700", color: colors.text },
  itemBody: { ...typography.bodySm, color: colors.textMuted, marginTop: 2 },
  itemTime: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand,
    marginTop: 6,
  },
});
