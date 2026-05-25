import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState, ImageWithSkeleton, Pill, Skeleton } from "../../../components/ui";
import { colors, radii, space, typography } from "../../../theme";
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
  postSendFriendRequest,
  postCancelFriendRequest,
  postRemoveFriend,
} from "../../home/api/homeApi";
import {
  NOTIFICATION_TITLES,
  NOTIFICATION_TYPES,
  useNotifications,
} from "../../notifications/NotificationContext";
import { openChatInTab } from "../../chats/lib/openChatTab";
import { useNavigation } from "@react-navigation/native";
import { haptics } from "../../../lib/haptics";
import { useAppTranslation } from "../../../i18n/useAppTranslation";

async function fetchCommunityUsers(search?: string): Promise<any[]> {
  const res = await apiClient.get(API_ROUTES.user.getAllUsers, {
    params: search ? { search } : undefined,
  });
  return res.data?.result ?? res.data ?? [];
}

function Avatar({ uri, name, size = 48 }: { uri?: string; name?: string; size?: number }) {
  const [failed, setFailed] = React.useState(false);
  const url = getS3ImageUrl(uri);
  React.useEffect(() => { setFailed(false); }, [uri]);
  if (!url || failed) {
    return (
      <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.avatarInitial, { fontSize: size * 0.38 }]}>
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
  onAction,
  onMessage,
  actionBusy,
  messageBusy,
}: {
  user: any;
  status: FriendStatus;
  onAction: (userId: string, action: string) => void;
  onMessage: (userId: string, name: string, picture?: string) => void;
  actionBusy: boolean;
  messageBusy: boolean;
}) {
  const { t } = useAppTranslation();
  const { isOnline } = useOnlinePresence();
  const name = user?.fullname || user?.fullName || t("community.memberDefault");
  const role = user?.account_type || user?.accountType || "";
  const userId = String(user?._id ?? "");
  const showOnline = isOnline(userId) || !!user?.is_online;

  return (
    <View style={styles.card}>
      <Avatar uri={user?.profile_picture} name={name} size={52} />
      <View style={styles.cardInfo}>
        <Text style={styles.memberName}>{name}</Text>
        {!!role && (
          <Pill
            label={role}
            tone={role === "Trainer" ? "info" : "success"}
            style={{ marginTop: 4 }}
          />
        )}
      </View>
      <View style={styles.actionCol}>
        {showOnline && <View style={styles.onlineDot} />}
        {status === "none" && (
          <Pressable
            style={styles.addBtn}
            onPress={() => {
              haptics.press();
              onAction(String(user._id), "add");
            }}
            disabled={actionBusy}
          >
            <Ionicons name="person-add" size={14} color={colors.brandTextOn} />
            <Text style={styles.addBtnText}>{t("community.add")}</Text>
          </Pressable>
        )}
        {status === "request_sent" && (
          <Pressable
            style={styles.pendingBtn}
            onPress={() => onAction(String(user._id), "cancel")}
            disabled={actionBusy}
          >
            <Ionicons name="time-outline" size={14} color={colors.warning} />
            <Text style={styles.pendingBtnText}>{t("community.pending")}</Text>
          </Pressable>
        )}
        {status === "friends" && (
          <>
            <Pressable
              style={styles.friendsBadge}
              onPress={() => onAction(String(user._id), "remove")}
              disabled={actionBusy}
            >
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={styles.friendsBadgeText}>{t("community.friends")}</Text>
            </Pressable>
            <Pressable
              style={styles.chatBtn}
              onPress={() => {
                haptics.tap();
                onMessage(String(user._id), name, user?.profile_picture);
              }}
              disabled={messageBusy}
            >
              {messageBusy ? (
                <ActivityIndicator size={12} color={colors.brandTextOn} />
              ) : (
                <Ionicons name="chatbubble-outline" size={12} color={colors.brandTextOn} />
              )}
              <Text style={styles.chatBtnText}>{t("community.chat")}</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

export function CommunityScreen() {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const gutter = useHorizontalGutter("md");
  const { user } = useAuth();
  const { emitNotification } = useNotifications();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [messageBusy, setMessageBusy] = useState(false);
  const navigation = useNavigation();
  const currentUserId = String((user as any)?._id ?? (user as any)?.id ?? "");

  const listPad = useMemo(
    () => ({
      ...gutter,
      paddingTop: space.md,
      paddingBottom: space.xl + insets.bottom,
      gap: space.sm,
    }),
    [gutter, insets.bottom]
  );

  const trimmedSearch = search.trim();
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

  const { data: sentRequests = [] } = useQuery({
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
    for (const r of sentRequests) {
      const rid = r?.receiverId?._id ?? r?.receiverId;
      if (rid) ids.add(String(rid));
    }
    return ids;
  }, [sentRequests]);

  const receivedRequestIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of sentRequests) {
      const sid = r?.senderId?._id ?? r?.senderId;
      if (sid && String(sid) !== currentUserId) ids.add(String(sid));
    }
    return ids;
  }, [sentRequests, currentUserId]);

  const getStatus = useCallback(
    (userId: string): FriendStatus => {
      if (friendIds.has(userId)) return "friends";
      if (sentRequestIds.has(userId)) return "request_sent";
      if (receivedRequestIds.has(userId)) return "request_received";
      return "none";
    },
    [friendIds, sentRequestIds, receivedRequestIds]
  );

  const filteredMembers = useMemo(
    () => members.filter((m: any) => String(m._id) !== currentUserId),
    [members, currentUserId]
  );

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
    [emitNotification, queryClient, t]
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
          openChatInTab(navigation, {
            conversationId: String(convId),
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

  if (isLoading) {
    return (
      <View style={listPad}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{ marginBottom: space.sm, flexDirection: "row", gap: space.sm, alignItems: "center" }}
          >
            <Skeleton width={44} height={44} radius={22} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="50%" height={12} />
              <Skeleton width="70%" height={10} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder={t("community.searchPlaceholder")}
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          autoCorrect={false}
        />
        {!!search && (
          <Pressable onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
      <FlatList
        data={filteredMembers}
        keyExtractor={flatListKeyExtractor}
        renderItem={({ item }) => (
          <MemberCard
            user={item}
            status={getStatus(String(item._id))}
            onAction={handleAction}
            onMessage={handleMessage}
            actionBusy={actionBusy}
            messageBusy={messageBusy}
          />
        )}
        contentContainerStyle={listPad}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandNavy} />
        }
        ListHeaderComponent={
          <View style={styles.headerCard}>
            <Ionicons name="globe-outline" size={28} color={colors.brandNavy} />
            <Text style={styles.headerText}>{t("community.headerTitle")}</Text>
            <Text style={styles.headerSub}>{t("community.headerSub")}</Text>
          </View>
        }
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    gap: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: typography.bodyMd.fontWeight,
    fontFamily: typography.bodyMd.fontFamily,
    letterSpacing: typography.bodyMd.letterSpacing,
    color: colors.text,
    paddingVertical: 0,
    textAlignVertical: "center",
  },
  headerCard: {
    backgroundColor: colors.brandSubtle,
    borderRadius: radii.md,
    padding: space.lg,
    alignItems: "center",
    gap: space.xs,
    marginBottom: space.md,
    borderWidth: 1,
    borderColor: colors.brandAccentSubtle,
  },
  headerText: { ...typography.titleSm, color: colors.brandNavy },
  headerSub: { ...typography.bodySm, color: colors.textMuted, textAlign: "center" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: space.md,
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardInfo: { flex: 1 },
  memberName: { ...typography.subtitle, color: colors.text },
  actionCol: { alignItems: "flex-end", gap: 6 },
  onlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brandNavy,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  addBtnText: { fontSize: 12, fontWeight: "700", color: colors.brandTextOn },
  pendingBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.warningSubtle,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  pendingBtnText: { fontSize: 12, fontWeight: "700", color: colors.warning },
  friendsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.successSubtle,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  friendsBadgeText: { fontSize: 12, fontWeight: "700", color: colors.success },
  chatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brandNavy,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  chatBtnText: { fontSize: 11, fontWeight: "700", color: colors.brandTextOn },
  avatarFallback: { backgroundColor: colors.brandNavy, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: colors.brandTextOn, fontWeight: "700" },
});
