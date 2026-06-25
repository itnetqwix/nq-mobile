import React, { useCallback, useMemo, useState } from "react";
import { FlashList } from "@shopify/flash-list";
import { useDebouncedValue, SEARCH_API_DEBOUNCE_MS } from "../../../lib/timing";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState, ImageWithSkeleton, MorphRefreshScrollSurface, Skeleton } from "../../../components/ui";
import { FLASHLIST_PERF_DEFAULTS } from "../../../lib/lists/flatListPerf";
import { FadeInView } from "../../../lib/motion/FadeInView";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { queryKeys } from "../../../lib/queryKeys";
import { flatListKeyExtractor } from "../../../lib/lists/trainerListUtils";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { useHorizontalGutter } from "../../../lib/layout/useHorizontalGutter";
import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { useAuth } from "../../auth/context/AuthContext";
import { useOnlinePresence } from "../../socket/useOnlinePresence";
import {
  fetchFriends,
  fetchFriendRequests,
  postAcceptFriendRequest,
  postSendFriendRequest,
  postCancelFriendRequest,
  postRemoveFriend,
} from "../../home/api/homeApi";
import {
  NOTIFICATION_TITLES,
  NOTIFICATION_TYPES,
  useNotifications,
} from "../../notifications/NotificationContext";
import { useChatRoomChrome } from "../../chats/hooks/useChatRoomChrome";
import { ChatRoomScreen } from "../../chats/screens/ChatRoomScreen";
import { useAppTranslation } from "../../../i18n/useAppTranslation";

type CommunityFilter = "all" | "trainers" | "trainees" | "online" | "friends";

const FILTERS: { key: CommunityFilter; icon: keyof typeof Ionicons.glyphMap; labelKey: string }[] = [
  { key: "all", icon: "people-outline", labelKey: "community.filterAll" },
  { key: "trainers", icon: "school-outline", labelKey: "community.filterTrainers" },
  { key: "trainees", icon: "fitness-outline", labelKey: "community.filterTrainees" },
  { key: "online", icon: "radio-button-on", labelKey: "community.filterOnline" },
  { key: "friends", icon: "heart-outline", labelKey: "community.filterFriends" },
];

async function fetchCommunityUsers(search?: string): Promise<any[]> {
  const res = await apiClient.get(API_ROUTES.user.getAllUsers, {
    params: search ? { search } : undefined,
  });
  const body = res.data;
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object") {
    const nested = (body as Record<string, unknown>).data ?? (body as Record<string, unknown>).result;
    if (Array.isArray(nested)) return nested;
  }
  return [];
}

function Avatar({ uri, name, size = 52 }: { uri?: string; name?: string; size?: number }) {
  const c = useThemeColors();
  const [failed, setFailed] = React.useState(false);
  const url = getS3ImageUrl(uri);
  React.useEffect(() => {
    setFailed(false);
  }, [uri]);
  if (!url || failed) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: c.brandNavy,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: c.brandTextOn, fontWeight: "700", fontSize: size * 0.38 }}>
          {(name ?? "?")[0]?.toUpperCase()}
        </Text>
      </View>
    );
  }
  return (
    <ImageWithSkeleton
      uri={url}
      width={size}
      height={size}
      borderRadius={size / 2}
      resizeMode="cover"
      onLoadError={() => setFailed(true)}
    />
  );
}

type FriendStatus = "none" | "friends" | "request_sent" | "request_received";

function MemberCard({
  user,
  status,
  index,
  onAction,
  onMessage,
  actionBusy,
  messageBusy,
}: {
  user: any;
  status: FriendStatus;
  index: number;
  onAction: (userId: string, action: string) => void;
  onMessage: (userId: string, name: string, picture?: string) => void;
  actionBusy: boolean;
  messageBusy: boolean;
}) {
  const { t } = useAppTranslation();
  const { isOnline } = useOnlinePresence();
  const styles = useMemberStyles();
  const c = useThemeColors();
  const name = user?.fullname || user?.fullName || t("community.memberDefault");
  const role = String(user?.account_type || user?.accountType || "");
  const userId = String(user?._id ?? "");
  const showOnline = isOnline(userId) || !!user?.is_online;
  const isTrainer = role === "Trainer";

  return (
    <FadeInView index={index}>
      <View style={styles.card}>
        <View style={styles.avatarWrap}>
          <Avatar uri={user?.profile_picture} name={name} size={52} />
          {showOnline ? <View style={styles.onlineDot} /> : null}
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {!!role ? (
            <View style={[styles.rolePill, isTrainer ? styles.roleTrainer : styles.roleTrainee]}>
              <Text style={[styles.roleText, isTrainer ? styles.roleTrainerText : styles.roleTraineeText]}>
                {isTrainer ? t("community.roleTrainer", { defaultValue: "Expert" }) : t("community.roleTrainee", { defaultValue: "Enthusiast" })}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.actions}>
          {status === "none" ? (
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
              onPress={() => onAction(userId, "add")}
              disabled={actionBusy}
            >
              <Ionicons name="person-add-outline" size={16} color={c.brandTextOn} />
            </Pressable>
          ) : null}
          {status === "request_sent" ? (
            <Pressable
              style={({ pressed }) => [styles.pendingBtn, pressed && { opacity: 0.9 }]}
              onPress={() => onAction(userId, "cancel")}
              disabled={actionBusy}
            >
              <Ionicons name="time-outline" size={16} color={c.warning} />
            </Pressable>
          ) : null}
          {status === "request_received" ? (
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
              onPress={() => onAction(userId, "accept")}
              disabled={actionBusy}
            >
              <Ionicons name="checkmark" size={16} color={c.brandTextOn} />
            </Pressable>
          ) : null}
          {status === "friends" ? (
            <>
              <Pressable
                style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}
                onPress={() => onMessage(userId, name, user?.profile_picture)}
                disabled={messageBusy}
              >
                {messageBusy ? (
                  <ActivityIndicator size="small" color={c.brandNavy} />
                ) : (
                  <Ionicons name="chatbubble-outline" size={16} color={c.brandNavy} />
                )}
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.iconGhostBtn, pressed && { opacity: 0.9 }]}
                onPress={() => onAction(userId, "remove")}
                disabled={actionBusy}
              >
                <Ionicons name="person-remove-outline" size={16} color={c.textMuted} />
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
    </FadeInView>
  );
}

export function CommunityScreen() {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const gutter = useHorizontalGutter("md");
  const styles = useScreenStyles();
  const c = useThemeColors();
  const { user } = useAuth();
  const { emitNotification } = useNotifications();
  const queryClient = useQueryClient();
  const { isOnline } = useOnlinePresence();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CommunityFilter>("all");
  const trimmedSearch = useDebouncedValue(search.trim(), SEARCH_API_DEBOUNCE_MS);
  const [actionBusy, setActionBusy] = useState(false);
  const [messageBusy, setMessageBusy] = useState(false);
  const [activeChat, setActiveChat] = useState<{
    conversationId: string;
    partner: { _id: string; fullname?: string; profile_picture?: string };
  } | null>(null);
  useChatRoomChrome(!!activeChat);
  const currentUserId = String((user as any)?._id ?? (user as any)?.id ?? "");

  const listPad = useMemo(
    () => ({
      ...gutter,
      paddingTop: space.sm,
      paddingBottom: space.xl + insets.bottom,
      gap: space.sm,
    }),
    [gutter, insets.bottom]
  );

  const { data: members = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: queryKeys.presence.community(trimmedSearch),
    queryFn: () => fetchCommunityUsers(trimmedSearch || undefined),
    staleTime: 120_000,
  });

  const { data: friends = [] } = useQuery({
    queryKey: queryKeys.friends.all,
    queryFn: fetchFriends,
    staleTime: 120_000,
  });

  const { data: incomingRequests = [] } = useQuery({
    queryKey: queryKeys.friends.requests,
    queryFn: fetchFriendRequests,
    staleTime: 60_000,
  });

  const friendIds = useMemo(() => {
    const ids = new Set<string>();
    for (const f of friends) {
      const rid = f?.receiverId?._id ?? f?.receiverId ?? f?._id;
      const sid = f?.senderId?._id ?? f?.senderId;
      if (rid) ids.add(String(rid));
      if (sid) ids.add(String(sid));
    }
    ids.delete(currentUserId);
    return ids;
  }, [friends, currentUserId]);

  const sentRequestIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of incomingRequests) {
      const sid = r?.senderId?._id ?? r?.senderId;
      if (sid && String(sid) === currentUserId) {
        const rid = r?.receiverId?._id ?? r?.receiverId;
        if (rid) ids.add(String(rid));
      }
    }
    return ids;
  }, [incomingRequests, currentUserId]);

  const receivedRequestByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of incomingRequests) {
      const sid = r?.senderId?._id ?? r?.senderId;
      const rid = r?.receiverId?._id ?? r?.receiverId;
      if (sid && rid && String(rid) === currentUserId) {
        map.set(String(sid), String(r._id ?? r.id ?? ""));
      }
    }
    return map;
  }, [incomingRequests, currentUserId]);

  const getStatus = useCallback(
    (userId: string): FriendStatus => {
      if (friendIds.has(userId)) return "friends";
      if (sentRequestIds.has(userId)) return "request_sent";
      if (receivedRequestByUserId.has(userId)) return "request_received";
      return "none";
    },
    [friendIds, sentRequestIds, receivedRequestByUserId]
  );

  const filteredMembers = useMemo(() => {
    let rows = members.filter((m: any) => String(m._id) !== currentUserId);
    if (filter === "trainers") {
      rows = rows.filter((m) => String(m.account_type ?? m.accountType) === "Trainer");
    } else if (filter === "trainees") {
      rows = rows.filter((m) => String(m.account_type ?? m.accountType) === "Trainee");
    } else if (filter === "online") {
      rows = rows.filter((m) => isOnline(String(m._id)) || !!m.is_online);
    } else if (filter === "friends") {
      rows = rows.filter((m) => friendIds.has(String(m._id)));
    }
    return rows;
  }, [members, currentUserId, filter, friendIds, isOnline]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.friends.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.friends.requests });
    queryClient.invalidateQueries({ queryKey: queryKeys.presence.communityAll });
  };

  const handleAction = useCallback(
    async (userId: string, action: string) => {
      setActionBusy(true);
      try {
        if (action === "add") {
          await postSendFriendRequest(userId);
          emitNotification({
            title: NOTIFICATION_TITLES.friendRequest ?? "Friend Request",
            description: "You have a new friend request.",
            receiverId: userId,
            type: NOTIFICATION_TYPES.TRANSCATIONAL,
          });
          Alert.alert(t("community.sentTitle"), t("community.sentBody"));
        } else if (action === "cancel") {
          await postCancelFriendRequest(userId);
          Alert.alert(t("community.cancelledTitle"), t("community.cancelledBody"));
        } else if (action === "accept") {
          const requestId = receivedRequestByUserId.get(userId);
          if (requestId) await postAcceptFriendRequest(requestId);
          Alert.alert(t("community.acceptedTitle", { defaultValue: "Connected" }), t("community.acceptedBody", { defaultValue: "You are now friends." }));
        } else if (action === "remove") {
          Alert.alert(t("community.removeTitle"), t("community.removeBody"), [
            { text: t("community.no"), style: "cancel" },
            {
              text: t("community.remove"),
              style: "destructive",
              onPress: async () => {
                await postRemoveFriend(userId);
                invalidateAll();
              },
            },
          ]);
          setActionBusy(false);
          return;
        }
        invalidateAll();
      } catch (e: any) {
        Alert.alert(
          t("common.error"),
          e?.response?.data?.message ?? e?.message ?? t("community.errorGeneric")
        );
      } finally {
        setActionBusy(false);
      }
    },
    [emitNotification, receivedRequestByUserId, t]
  );

  const handleMessage = useCallback(
    async (userId: string, name: string, picture?: string) => {
      setMessageBusy(true);
      try {
        const res = await apiClient.post(API_ROUTES.chat.conversation, {
          otherUserId: userId,
          participantId: userId,
        });
        const body = (res as any)?.data ?? res;
        const conversation = body?.data ?? body?.result ?? body;
        const convId = conversation?._id ?? conversation?.conversationId;
        if (convId) {
          queryClient.invalidateQueries({ queryKey: queryKeys.chats.conversations });
          setActiveChat({
            conversationId: convId,
            partner: { _id: userId, fullname: name, profile_picture: picture },
          });
        }
      } catch (e: any) {
        const msg =
          e?.response?.data?.message ??
          e?.response?.data?.error ??
          e?.message ??
          t("community.openChatError");
        Alert.alert(t("common.error"), String(msg));
      } finally {
        setMessageBusy(false);
      }
    },
    [queryClient, t]
  );

  if (activeChat) {
    return (
      <ChatRoomScreen
        conversationId={activeChat.conversationId}
        partner={activeChat.partner}
        onGoBack={() => {
          setActiveChat(null);
          queryClient.invalidateQueries({ queryKey: queryKeys.chats.conversations });
        }}
      />
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.root, gutter, { paddingTop: space.md, gap: space.sm }]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}>
            <Skeleton width={52} height={52} radius={26} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width="55%" height={14} />
              <Skeleton width="35%" height={10} />
            </View>
            <Skeleton width={40} height={40} radius={20} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.searchWrap, gutter]}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={c.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={t("community.searchPlaceholder")}
            placeholderTextColor={c.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCorrect={false}
          />
          {!!search ? (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={c.textMuted} />
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.resultMeta}>
          {t("community.memberCount", {
            defaultValue: "{{count}} members",
            count: filteredMembers.length,
          })}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.filterRow, gutter]}
      >
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <Pressable
              key={f.key}
              style={[styles.filterChip, on && styles.filterChipOn]}
              onPress={() => setFilter(f.key)}
            >
              <Ionicons name={f.icon} size={14} color={on ? c.brandNavy : c.textMuted} />
              <Text style={[styles.filterLabel, on && styles.filterLabelOn]}>
                {t(f.labelKey, { defaultValue: f.key })}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <MorphRefreshScrollSurface
        style={{ flex: 1 }}
        onRefresh={refetch}
        externalRefreshing={isRefetching}
        tintColor={c.brandNavy}
      >
        {({ refreshControl, onScroll, scrollEventThrottle }) => (
          <FlashList
            data={filteredMembers}
            keyExtractor={flatListKeyExtractor}
            renderItem={({ item, index }) => (
              <MemberCard
                user={item}
                index={index}
                status={getStatus(String(item._id))}
                onAction={handleAction}
                onMessage={handleMessage}
                actionBusy={actionBusy}
                messageBusy={messageBusy}
              />
            )}
            contentContainerStyle={listPad}
            refreshControl={refreshControl}
            onScroll={onScroll}
            scrollEventThrottle={scrollEventThrottle}
            {...FLASHLIST_PERF_DEFAULTS}
            ListEmptyComponent={
              <EmptyState
                icon="people-outline"
                title={t("community.emptyTitle")}
                description={
                  trimmedSearch
                    ? t("community.emptySearchDescription", { query: trimmedSearch })
                    : t("community.emptyDescription")
                }
              />
            }
          />
        )}
      </MorphRefreshScrollSurface>
    </View>
  );
}

function useScreenStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      root: { flex: 1, backgroundColor: palette.background },
      searchWrap: {
        paddingTop: space.md,
        paddingBottom: space.sm,
        gap: space.xs,
      },
      searchBar: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: palette.border,
        paddingHorizontal: space.md,
        paddingVertical: 12,
      },
      searchInput: {
        flex: 1,
        ...typography.bodyMd,
        color: palette.text,
        paddingVertical: 0,
      },
      resultMeta: {
        ...typography.caption,
        color: palette.textMuted,
        marginLeft: space.xs,
      },
      filterRow: {
        gap: space.sm,
        paddingBottom: space.sm,
      },
      filterChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surfaceElevated,
      },
      filterChipOn: {
        borderColor: palette.brandNavy,
        backgroundColor: palette.brandSubtle,
      },
      filterLabel: {
        ...typography.caption,
        fontWeight: "600",
        color: palette.textMuted,
      },
      filterLabelOn: {
        color: palette.brandNavy,
        fontWeight: "700",
      },
    })
  );
}

function useMemberStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      card: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.lg,
        padding: space.md,
        borderWidth: 1,
        borderColor: palette.border,
      },
      avatarWrap: { position: "relative" },
      onlineDot: {
        position: "absolute",
        right: 0,
        bottom: 0,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: palette.success,
        borderWidth: 2,
        borderColor: palette.surfaceElevated,
      },
      cardBody: { flex: 1, minWidth: 0, gap: 4 },
      name: { ...typography.subtitle, color: palette.text, fontWeight: "700" },
      rolePill: {
        alignSelf: "flex-start",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: radii.pill,
      },
      roleTrainer: { backgroundColor: palette.brandSubtle },
      roleTrainee: { backgroundColor: palette.successSubtle },
      roleText: { ...typography.caption, fontWeight: "700", fontSize: 11 },
      roleTrainerText: { color: palette.brandNavy },
      roleTraineeText: { color: palette.success },
      actions: { flexDirection: "row", alignItems: "center", gap: space.xs },
      primaryBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: palette.brandNavy,
        alignItems: "center",
        justifyContent: "center",
      },
      secondaryBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: palette.brandSubtle,
        borderWidth: 1,
        borderColor: palette.border,
        alignItems: "center",
        justifyContent: "center",
      },
      iconGhostBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
      },
      pendingBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: palette.warningSubtle,
        borderWidth: 1,
        borderColor: palette.warning,
        alignItems: "center",
        justifyContent: "center",
      },
    })
  );
}
