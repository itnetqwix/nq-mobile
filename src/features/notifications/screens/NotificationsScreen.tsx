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
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { queryKeys } from "../../../lib/queryKeys";
import { flatListKeyExtractor } from "../../../lib/lists/trainerListUtils";
import { fetchNotifications } from "../../home/api/homeApi";
import { useNotifications } from "../NotificationContext";
import { useAppTranslation } from "../../../i18n/useAppTranslation";

function getNotificationIcon(title?: string): keyof typeof Ionicons.glyphMap {
  const t = (title ?? "").toLowerCase();
  if (t.includes("book") || t.includes("session")) return "calendar-outline";
  if (t.includes("message") || t.includes("chat")) return "chatbubble-outline";
  if (t.includes("accept") || t.includes("confirm")) return "checkmark-circle-outline";
  if (t.includes("cancel") || t.includes("reject")) return "close-circle-outline";
  if (t.includes("payment") || t.includes("transaction")) return "wallet-outline";
  return "notifications-outline";
}

function timeAgo(
  dateStr: string | undefined,
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  if (!dateStr) return "";
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return t("notifications.justNow");
    if (minutes < 60) return t("notifications.minutesAgo", { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t("notifications.hoursAgo", { count: hours });
    const days = Math.floor(hours / 24);
    return t("notifications.daysAgo", { count: days });
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
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useNotificationItemStyles();
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
      accessibilityLabel={t("notifications.openA11y", {
        title: item?.title ?? t("notifications.notificationDefault"),
      })}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={22} color={c.iconPrimary} />
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
          <Text style={styles.itemTime}>{timeAgo(item.createdAt, t)}</Text>
        )}
      </View>
      {!isRead && <View style={styles.unreadDot} />}
      <Ionicons name="chevron-forward" size={16} color={c.textMuted} style={styles.chev} />
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
  const c = useThemeColors();
  const styles = useNotificationListStyles();
  const navigation = useNavigation<ShellNav>();
  const { markFirstPageRead, refreshInbox } = useNotifications();

  const { data: notifications = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: queryKeys.notifications.inbox,
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
      keyExtractor={flatListKeyExtractor}
      renderItem={({ item }) => (
        <NotificationItem
          item={item}
          onPress={() => handleNotificationPress(item)}
        />
      )}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.iconPrimary} />
      }
      ListEmptyComponent={<EmptyState preset="no_notifications" />}
    />
  );
}

function useNotificationItemStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      item: {
        flexDirection: "row",
        alignItems: "flex-start",
        paddingHorizontal: space.md,
        paddingVertical: space.md,
        gap: space.sm,
        backgroundColor: palette.surfaceElevated,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: palette.border,
      },
      itemUnread: { backgroundColor: palette.brandAccentSubtle },
      itemPressed: { opacity: 0.85 },
      chev: { marginLeft: 4 },
      iconWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: palette.brandSubtle,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      },
      itemContent: { flex: 1 },
      itemTitle: { ...typography.bodyMd, color: palette.textSecondary },
      itemTitleBold: { fontWeight: "700", color: palette.text },
      itemBody: { ...typography.bodySm, color: palette.textMuted, marginTop: 2 },
      itemTime: { ...typography.caption, color: palette.textMuted, marginTop: 4 },
      unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: palette.iconPrimary,
        marginTop: 6,
      },
    })
  );
}

function useNotificationListStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      center: { flex: 1, alignItems: "center", justifyContent: "center" },
      list: { paddingBottom: space.xl, backgroundColor: palette.background },
    })
  );
}
