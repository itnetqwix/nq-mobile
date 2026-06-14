import React, { useCallback, useRef, useState } from "react";
import { FlashList } from "@shopify/flash-list";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { flatListKeyExtractor } from "../../../lib/lists/trainerListUtils";
import { Ionicons } from "@expo/vector-icons";
import { Button, EmptyState, MorphRefreshScrollSurface, Skeleton } from "../../../components/ui";
import { useWindowMetrics } from "../../../lib/layout";
import {
  FLASHLIST_PERF_DEFAULTS,
} from "../../../lib/lists/flatListPerf";
import { colors, radii, space, typography } from "../../../theme";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { useOnlinePresence } from "../../socket/useOnlinePresence";
import {
  fetchFriends,
  fetchFriendRequests,
  fetchSentFriendRequests,
  postAcceptFriendRequest,
  postRejectFriendRequest,
} from "../../home/api/homeApi";

import { ShareClipsPanel } from "../components/ShareClipsPanel";
import { useChatRoomChrome } from "../../chats/hooks/useChatRoomChrome";
import { ChatRoomScreen } from "../../chats/screens/ChatRoomScreen";
import { useAppTranslation } from "../../../i18n/useAppTranslation";

const TABS = [
  { key: "friends", labelKey: "friends.tabs.friends" },
  { key: "requests", labelKey: "friends.tabs.requests" },
  { key: "sent", labelKey: "friends.tabs.sent" },
  { key: "share", labelKey: "friends.tabs.shareClips" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const REPORT_REASON_KEYS = [
  "friends.reportReasons.harassment",
  "friends.reportReasons.spam",
  "friends.reportReasons.inappropriate",
  "friends.reportReasons.fake",
  "friends.reportReasons.other",
] as const;

function Avatar({ uri, name, size = 48 }: { uri?: string; name?: string; size?: number }) {
  const [failed, setFailed] = React.useState(false);
  const url = getS3ImageUrl(uri);
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
    <Image
      source={{ uri: url }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      onError={() => setFailed(true)}
    />
  );
}

function FriendCard({
  friend,
  onMessage,
  messageBusy,
  onRemove,
  onBlock,
  onReport,
}: {
  friend: any;
  onMessage: (userId: string, name: string, picture?: string) => void;
  messageBusy: boolean;
  onRemove: (userId: string, name: string) => void;
  onBlock: (userId: string, name: string) => void;
  onReport: (userId: string, name: string) => void;
}) {
  const { t } = useAppTranslation();
  const { isOnline } = useOnlinePresence();
  const user = friend?.receiverId ?? friend?.senderId ?? friend;
  const name = user?.fullname || user?.fullName || t("friends.friendDefault");
  const userId = String(user?._id ?? "");
  const showOnline = isOnline(userId) || !!user?.is_online;

  const showActions = () => {
    const options = [
      t("friends.removeFriend"),
      t("friends.blockUser"),
      t("friends.reportUser"),
      t("common.cancel"),
    ];
    const destructiveIndex = [0, 1];

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, destructiveButtonIndex: 1, cancelButtonIndex: 3, title: name },
        (idx) => {
          if (idx === 0) onRemove(userId, name);
          else if (idx === 1) onBlock(userId, name);
          else if (idx === 2) onReport(userId, name);
        }
      );
    } else {
      Alert.alert(name, t("friends.chooseAction"), [
        { text: t("friends.removeFriend"), onPress: () => onRemove(userId, name), style: "destructive" },
        { text: t("friends.blockUser"), onPress: () => onBlock(userId, name), style: "destructive" },
        { text: t("friends.reportUser"), onPress: () => onReport(userId, name) },
        { text: t("common.cancel"), style: "cancel" },
      ]);
    }
  };

  return (
    <View style={styles.row}>
      <Avatar uri={user?.profile_picture} name={name} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{name}</Text>
        {!!user?.email && <Text style={styles.rowSub}>{user.email}</Text>}
      </View>
      <View style={styles.friendActions}>
        {showOnline && <View style={styles.onlineDot} />}
        <View style={styles.friendBtns}>
          <Pressable
            style={styles.msgBtn}
            onPress={() => onMessage(userId, name, user?.profile_picture)}
            disabled={messageBusy}
          >
            {messageBusy ? (
              <ActivityIndicator size={14} color={colors.brandTextOn} />
            ) : (
              <Ionicons name="chatbubble-outline" size={14} color={colors.brandTextOn} />
            )}
            <Text style={styles.msgBtnText}>{t("friends.message")}</Text>
          </Pressable>
          <Pressable onPress={showActions} hitSlop={8} style={styles.moreBtn}>
            <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function RequestCard({
  request,
  onAccept,
  onReject,
}: {
  request: any;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const { t } = useAppTranslation();
  const sender = request?.senderId;
  const name = sender?.fullname || sender?.fullName || t("friends.userDefault");
  return (
    <View style={styles.row}>
      <Avatar uri={sender?.profile_picture} name={name} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{name}</Text>
        <Text style={styles.rowSub}>{t("friends.sentYouRequest")}</Text>
      </View>
      <View style={styles.reqActions}>
        <Button
          label={t("friends.accept")}
          size="sm"
          fullWidth={false}
          onPress={() => onAccept(request._id)}
        />
        <Button
          label={t("friends.reject")}
          size="sm"
          variant="danger"
          fullWidth={false}
          onPress={() => onReject(request._id)}
        />
      </View>
    </View>
  );
}

function SentRequestCard({
  request,
  onCancel,
  cancelBusy,
}: {
  request: any;
  onCancel: (receiverId: string) => void;
  cancelBusy: boolean;
}) {
  const { t } = useAppTranslation();
  const receiver = request?.receiverId;
  const name = receiver?.fullname || receiver?.fullName || t("friends.userDefault");
  const status: string = request?.status ?? "pending";
  const isPending = status === "pending";

  return (
    <View style={styles.row}>
      <Avatar uri={receiver?.profile_picture} name={name} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{name}</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, isPending ? styles.statusPending : styles.statusAccepted]} />
          <Text style={[styles.rowSub, { marginTop: 0 }]}>
            {isPending ? t("friends.pending") : t("friends.accepted")}
          </Text>
        </View>
      </View>
      {isPending && (
        <Button
          label={t("friends.cancel")}
          size="sm"
          variant="danger"
          fullWidth={false}
          onPress={() => onCancel(String(receiver?._id))}
          disabled={cancelBusy}
        />
      )}
    </View>
  );
}

export function FriendsScreen() {
  const { t } = useAppTranslation();
  const { width: screenWidth } = useWindowMetrics();
  const scrollRef = useRef<ScrollView>(null);
  const [tab, setTab] = useState<Tab>("friends");
  const [messageBusy, setMessageBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [activeChat, setActiveChat] = useState<{
    conversationId: string;
    partner: { _id: string; fullname?: string; profile_picture?: string };
  } | null>(null);
  useChatRoomChrome(!!activeChat);
  const queryClient = useQueryClient();

  const { data: friends = [], isLoading: loadingFriends, isRefetching: refreshingFriends, refetch: refetchFriends } = useQuery({
    queryKey: queryKeys.friends.list,
    queryFn: fetchFriends,
    staleTime: 120_000,
  });

  const { data: requests = [], isLoading: loadingReqs, isRefetching: refreshingReqs, refetch: refetchReqs } = useQuery({
    queryKey: queryKeys.friends.requests,
    queryFn: fetchFriendRequests,
    staleTime: 60_000,
  });

  const { data: sentRequests = [], isLoading: loadingSent, isRefetching: refreshingSent, refetch: refetchSent } = useQuery({
    queryKey: queryKeys.friends.sentRequests,
    queryFn: fetchSentFriendRequests,
    staleTime: 60_000,
  });

  const handleAccept = async (requestId: string) => {
    await postAcceptFriendRequest(requestId);
    queryClient.invalidateQueries({ queryKey: queryKeys.friends.requests });
    queryClient.invalidateQueries({ queryKey: queryKeys.friends.list });
  };

  const handleReject = async (requestId: string) => {
    await postRejectFriendRequest(requestId);
    queryClient.invalidateQueries({ queryKey: queryKeys.friends.requests });
  };

  const handleCancelRequest = async (receiverId: string) => {
    setCancelBusy(true);
    try {
      await apiClient.post(API_ROUTES.user.cancelFriendRequest, { receiverId });
      queryClient.invalidateQueries({ queryKey: queryKeys.friends.sentRequests });
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.response?.data?.error ?? t("friends.couldNotCancel"));
    } finally {
      setCancelBusy(false);
    }
  };

  const handleRemoveFriend = useCallback(async (friendId: string, name: string) => {
    Alert.alert(t("friends.removeConfirmTitle"), t("friends.removeConfirmBody", { name }), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("friends.remove"), style: "destructive",
        onPress: async () => {
          try {
            await apiClient.post(API_ROUTES.user.removeFriend, { friendId });
            queryClient.invalidateQueries({ queryKey: queryKeys.friends.list });
            Alert.alert(t("common.done"), t("friends.removedBody", { name }));
          } catch (e: any) {
            Alert.alert(t("common.error"), e?.response?.data?.error ?? t("friends.couldNotRemove"));
          }
        },
      },
    ]);
  }, [queryClient, t]);

  const handleBlockUser = useCallback(async (userId: string, name: string) => {
    Alert.alert(t("friends.blockConfirmTitle"), t("friends.blockConfirmBody", { name }), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("friends.block"), style: "destructive",
        onPress: async () => {
          try {
            await apiClient.post(API_ROUTES.user.blockUser, { userId });
            queryClient.invalidateQueries({ queryKey: queryKeys.friends.list });
            queryClient.invalidateQueries({ queryKey: queryKeys.chats.conversations });
            Alert.alert(t("common.done"), t("friends.blockedBody", { name }));
          } catch (e: any) {
            Alert.alert(t("common.error"), e?.response?.data?.error ?? t("friends.couldNotBlock"));
          }
        },
      },
    ]);
  }, [queryClient, t]);

  const handleReportUser = useCallback((userId: string, name: string) => {
    const reportReasons = REPORT_REASON_KEYS.map((key) => t(key));
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...reportReasons, t("common.cancel")],
          cancelButtonIndex: reportReasons.length,
          title: t("friends.reportTitle", { name }),
        },
        async (idx) => {
          if (idx >= reportReasons.length) return;
          try {
            await apiClient.post(API_ROUTES.user.reportUser, {
              userId,
              reason: reportReasons[idx],
            });
            Alert.alert(t("friends.reportSubmittedTitle"), t("friends.reportSubmittedBody"));
          } catch (e: any) {
            Alert.alert(t("common.error"), e?.response?.data?.error ?? t("friends.couldNotReport"));
          }
        }
      );
    } else {
      Alert.alert(t("friends.reportTitle", { name }), t("friends.reportSelectReason"), [
        ...reportReasons.map((r) => ({
          text: r,
          onPress: async () => {
            try {
              await apiClient.post(API_ROUTES.user.reportUser, { userId, reason: r });
              Alert.alert(t("friends.reportSubmittedTitle"), t("friends.reportSubmittedBody"));
            } catch (e: any) {
              Alert.alert(t("common.error"), e?.response?.data?.error ?? t("friends.couldNotReport"));
            }
          },
        })),
        { text: t("common.cancel"), style: "cancel" as const },
      ]);
    }
  }, [t]);

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
        } else {
          Alert.alert(t("common.error"), t("friends.couldNotOpenChat"));
        }
      } catch (e: any) {
        const msg =
          e?.response?.data?.message ??
          e?.response?.data?.error ??
          e?.message ??
          t("friends.couldNotOpenChat");
        Alert.alert(t("common.error"), String(msg));
      } finally {
        setMessageBusy(false);
      }
    },
    [queryClient, t]
  );

  const renderTabBody = (tabKey: Tab) => {
    const isLoading =
      tabKey === "friends" ? loadingFriends :
      tabKey === "requests" ? loadingReqs :
      tabKey === "sent" ? loadingSent : false;
    const isRefetching =
      tabKey === "friends" ? refreshingFriends :
      tabKey === "requests" ? refreshingReqs :
      tabKey === "sent" ? refreshingSent : false;
    const refetch =
      tabKey === "friends" ? refetchFriends :
      tabKey === "requests" ? refetchReqs :
      tabKey === "sent" ? refetchSent : () => {};
    const data =
      tabKey === "friends" ? friends :
      tabKey === "requests" ? requests :
      tabKey === "sent" ? sentRequests : [];

    if (isLoading) {
      return (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ marginBottom: space.md }}>
              <Skeleton width="100%" height={68} radius={radii.md} />
            </View>
          ))}
        </View>
      );
    }

    if (tabKey === "share") {
      return <ShareClipsPanel />;
    }

    return (
      <MorphRefreshScrollSurface onRefresh={refetch} externalRefreshing={isRefetching} tintColor={colors.brandNavy}>
        {({ refreshControl, onScroll, scrollEventThrottle }) => (
      <FlashList
        data={data}
        keyExtractor={flatListKeyExtractor}
        renderItem={({ item }) =>
          tabKey === "friends" ? (
            <FriendCard
              friend={item}
              onMessage={handleMessage}
              messageBusy={messageBusy}
              onRemove={handleRemoveFriend}
              onBlock={handleBlockUser}
              onReport={handleReportUser}
            />
          ) : tabKey === "sent" ? (
            <SentRequestCard
              request={item}
              onCancel={handleCancelRequest}
              cancelBusy={cancelBusy}
            />
          ) : (
            <RequestCard
              request={item}
              onAccept={handleAccept}
              onReject={handleReject}
            />
          )
        }
        contentContainerStyle={styles.list}
        refreshControl={refreshControl}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        {...FLASHLIST_PERF_DEFAULTS}
        ListEmptyComponent={
          <EmptyState
            icon={
              tabKey === "friends" ? "people-outline" :
              tabKey === "sent" ? "paper-plane-outline" :
              "person-add-outline"
            }
            title={
              tabKey === "friends"
                ? t("friends.emptyFriends")
                : tabKey === "sent"
                ? t("friends.emptySent")
                : t("friends.emptyRequests")
            }
            description={
              tabKey === "friends"
                ? t("friends.emptyFriendsDescription")
                : tabKey === "sent"
                ? t("friends.emptySentDescription")
                : t("friends.emptyRequestsDescription")
            }
          />
        }
      />
        )}
      </MorphRefreshScrollSurface>
    );
  };

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

  return (
    <View style={styles.root}>
      <View style={styles.tabs}>
        {TABS.map((tabItem, index) => (
          <Pressable
            key={tabItem.key}
            style={[styles.tabBtn, tab === tabItem.key && styles.tabBtnActive]}
            onPress={() => {
              setTab(tabItem.key);
              scrollRef.current?.scrollTo({ x: index * screenWidth, animated: true });
            }}
          >
            <Text style={[styles.tabText, tab === tabItem.key && styles.tabTextActive]}>
              {t(tabItem.labelKey)}
              {tabItem.key === "requests" && requests.length > 0 && (
                <Text style={styles.badge}> {requests.length}</Text>
              )}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
        onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
          const next = TABS[index];
          if (next) setTab(next.key);
        }}
      >
        {TABS.map((tabItem) => (
          <View key={tabItem.key} style={{ width: screenWidth, flex: 1 }}>
            {renderTabBody(tabItem.key)}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  tabs: {
    flexDirection: "row",
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabBtnActive: { borderBottomColor: colors.brandNavy },
  tabText: { ...typography.label, color: colors.textMuted, fontSize: 12 },
  tabTextActive: { color: colors.brandNavy },
  badge: { fontSize: 12, color: colors.danger, fontWeight: "700" },

  list: { padding: space.md, gap: space.sm, paddingBottom: space.xl },

  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: space.md,
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowInfo: { flex: 1 },
  rowName: { ...typography.subtitle, color: colors.text },
  rowSub: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  onlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success },

  reqActions: { flexDirection: "column", gap: 6 },
  friendActions: { alignItems: "flex-end", gap: 6 },
  friendBtns: { flexDirection: "row", alignItems: "center", gap: 8 },
  moreBtn: { padding: 4 },
  msgBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brandNavy,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  msgBtnText: { fontSize: 12, fontWeight: "700", color: colors.brandTextOn },

  avatarFallback: { backgroundColor: colors.brandNavy, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: colors.brandTextOn, fontWeight: "700" },

  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusPending: { backgroundColor: "#f59e0b" },
  statusAccepted: { backgroundColor: colors.success },
});
