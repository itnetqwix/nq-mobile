import React, { useCallback, useState } from "react";
import { FlashList } from "@shopify/flash-list";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { flatListKeyExtractor } from "../../../lib/lists/trainerListUtils";
import { Ionicons } from "@expo/vector-icons";
import {
  Button,
  EmptyState,
  MorphRefreshScrollSurface,
  PresenceDot,
  SegmentedControl,
  Skeleton,
} from "../../../components/ui";
import { FadeInView } from "../../../lib/motion/FadeInView";
import { FLASHLIST_PERF_DEFAULTS } from "../../../lib/lists/flatListPerf";
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
import { InviteFriendsScreen } from "../../dashboard/screens/InviteFriendsScreen";
import { useChatRoomChrome } from "../../chats/hooks/useChatRoomChrome";
import { ChatRoomScreen } from "../../chats/screens/ChatRoomScreen";
import { useAppTranslation } from "../../../i18n/useAppTranslation";

const PRIMARY_TABS = [
  { key: "friends", labelKey: "friends.tabs.friends" },
  { key: "requests", labelKey: "friends.tabs.requests" },
  { key: "sent", labelKey: "friends.tabs.sent" },
] as const;

const SECONDARY_TABS = [
  { key: "share", labelKey: "friends.tabs.shareClips" },
  { key: "invite", labelKey: "friends.tabs.invite" },
] as const;

type PrimaryTab = (typeof PRIMARY_TABS)[number]["key"];
type SecondaryTab = (typeof SECONDARY_TABS)[number]["key"];
type Tab = PrimaryTab | SecondaryTab;

type FriendsScreenProps = {
  initialTab?: Tab;
};

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
  index,
  onMessage,
  messageBusy,
  onRemove,
  onBlock,
  onReport,
}: {
  friend: any;
  index: number;
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
  const online = isOnline(userId) || !!user?.is_online;

  const showActions = () => {
    const options = [
      t("friends.removeFriend"),
      t("friends.blockUser"),
      t("friends.reportUser"),
      t("common.cancel"),
    ];

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
    <FadeInView index={index}>
      <View style={styles.card}>
        <View style={styles.avatarWrap}>
          <Avatar uri={user?.profile_picture} name={name} size={44} />
          {online ? (
            <View style={styles.presenceDot}>
              <PresenceDot online size={10} ring />
            </View>
          ) : null}
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.rowName} numberOfLines={1}>
            {name}
          </Text>
          {!!user?.email && (
            <Text style={styles.rowSub} numberOfLines={1}>
              {user.email}
            </Text>
          )}
        </View>
        <View style={styles.cardActions}>
          <Pressable
            style={styles.iconBtn}
            onPress={() => onMessage(userId, name, user?.profile_picture)}
            disabled={messageBusy}
            accessibilityLabel={t("friends.message")}
          >
            {messageBusy ? (
              <ActivityIndicator size="small" color={colors.brandNavy} />
            ) : (
              <Ionicons name="chatbubble-outline" size={20} color={colors.brandNavy} />
            )}
          </Pressable>
          <Pressable onPress={showActions} hitSlop={8} style={styles.iconBtn}>
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>
    </FadeInView>
  );
}

function RequestCard({
  request,
  index,
  onAccept,
  onReject,
}: {
  request: any;
  index: number;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const { t } = useAppTranslation();
  const sender = request?.senderId;
  const name = sender?.fullname || sender?.fullName || t("friends.userDefault");
  return (
    <FadeInView index={index}>
      <View style={styles.card}>
        <Avatar uri={sender?.profile_picture} name={name} size={44} />
        <View style={styles.cardBody}>
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
            variant="ghost"
            fullWidth={false}
            onPress={() => onReject(request._id)}
          />
        </View>
      </View>
    </FadeInView>
  );
}

function SentRequestCard({
  request,
  index,
  onCancel,
  cancelBusy,
}: {
  request: any;
  index: number;
  onCancel: (receiverId: string) => void;
  cancelBusy: boolean;
}) {
  const { t } = useAppTranslation();
  const receiver = request?.receiverId;
  const name = receiver?.fullname || receiver?.fullName || t("friends.userDefault");
  const status: string = request?.status ?? "pending";
  const isPending = status === "pending";

  return (
    <FadeInView index={index}>
      <View style={styles.card}>
        <Avatar uri={receiver?.profile_picture} name={name} size={44} />
        <View style={styles.cardBody}>
          <Text style={styles.rowName}>{name}</Text>
          <Text style={styles.rowSub}>
            {isPending ? t("friends.pending") : t("friends.accepted")}
          </Text>
        </View>
        {isPending ? (
          <Button
            label={t("friends.cancel")}
            size="sm"
            variant="ghost"
            fullWidth={false}
            onPress={() => onCancel(String(receiver?._id))}
            disabled={cancelBusy}
          />
        ) : null}
      </View>
    </FadeInView>
  );
}

function resolveInitialTab(initialTab?: Tab): Tab {
  if (!initialTab) return "friends";
  return initialTab;
}

function isSecondaryTab(tab: Tab): tab is SecondaryTab {
  return tab === "share" || tab === "invite";
}

export function FriendsScreen({ initialTab = "friends" }: FriendsScreenProps) {
  const { t } = useAppTranslation();
  const resolved = resolveInitialTab(initialTab);
  const [tab, setTab] = useState<Tab>(resolved);
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
        text: t("friends.remove"),
        style: "destructive",
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
        text: t("friends.block"),
        style: "destructive",
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
            Alert.alert(t("common.done"), t("friends.reportedBody"));
          } catch (e: any) {
            Alert.alert(t("common.error"), e?.response?.data?.error ?? t("friends.couldNotReport"));
          }
        }
      );
    } else {
      Alert.alert(t("friends.reportTitle", { name }), t("friends.pickReason"), [
        ...reportReasons.map((reason) => ({
          text: reason,
          onPress: async () => {
            try {
              await apiClient.post(API_ROUTES.user.reportUser, { userId, reason });
              Alert.alert(t("common.done"), t("friends.reportedBody"));
            } catch (e: any) {
              Alert.alert(t("common.error"), e?.response?.data?.error ?? t("friends.couldNotReport"));
            }
          },
        })),
        { text: t("common.cancel"), style: "cancel" },
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

  const renderTabBody = () => {
    if (tab === "share") {
      return <ShareClipsPanel />;
    }
    if (tab === "invite") {
      return <InviteFriendsScreen />;
    }

    const tabKey = tab as PrimaryTab;
    const isLoading =
      tabKey === "friends" ? loadingFriends : tabKey === "requests" ? loadingReqs : loadingSent;
    const isRefetching =
      tabKey === "friends" ? refreshingFriends : tabKey === "requests" ? refreshingReqs : refreshingSent;
    const refetch =
      tabKey === "friends" ? refetchFriends : tabKey === "requests" ? refetchReqs : refetchSent;
    const data =
      tabKey === "friends" ? friends : tabKey === "requests" ? requests : sentRequests;

    if (isLoading) {
      return (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} width="100%" height={72} radius={radii.md} />
          ))}
        </View>
      );
    }

    return (
      <MorphRefreshScrollSurface onRefresh={refetch} externalRefreshing={isRefetching} tintColor={colors.brandNavy}>
        {({ refreshControl, onScroll, scrollEventThrottle }) => (
          <FlashList
            data={data}
            keyExtractor={flatListKeyExtractor}
            renderItem={({ item, index }) =>
              tabKey === "friends" ? (
                <FriendCard
                  friend={item}
                  index={index}
                  onMessage={handleMessage}
                  messageBusy={messageBusy}
                  onRemove={handleRemoveFriend}
                  onBlock={handleBlockUser}
                  onReport={handleReportUser}
                />
              ) : tabKey === "sent" ? (
                <SentRequestCard
                  request={item}
                  index={index}
                  onCancel={handleCancelRequest}
                  cancelBusy={cancelBusy}
                />
              ) : (
                <RequestCard
                  request={item}
                  index={index}
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
                  tabKey === "friends"
                    ? "people-outline"
                    : tabKey === "sent"
                      ? "paper-plane-outline"
                      : "person-add-outline"
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
      <SegmentedControl
        options={PRIMARY_TABS.map((item) => ({
          key: item.key,
          label: t(item.labelKey),
          badge: item.key === "requests" ? requests.length : undefined,
        }))}
        value={isSecondaryTab(tab) ? null : tab}
        onChange={(key) => setTab(key)}
      />
      <View style={styles.quickLinks}>
        {SECONDARY_TABS.map((item) => {
          const active = tab === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setTab(item.key)}
              style={[styles.quickLink, active && styles.quickLinkActive]}
            >
              <Ionicons
                name={item.key === "share" ? "share-social-outline" : "person-add-outline"}
                size={16}
                color={active ? colors.brandTextOn : colors.brandNavy}
              />
              <Text style={[styles.quickLinkText, active && styles.quickLinkTextActive]}>
                {t(item.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.body}>{renderTabBody()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  body: { flex: 1 },
  quickLinks: {
    flexDirection: "row",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  quickLink: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  quickLinkActive: {
    backgroundColor: colors.brandNavy,
    borderColor: colors.brandNavy,
  },
  quickLinkText: { ...typography.label, color: colors.brandNavy, fontWeight: "600", fontSize: 12 },
  quickLinkTextActive: { color: colors.brandTextOn },

  list: { padding: space.md, gap: space.sm, paddingBottom: space.xl },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    padding: space.md,
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: space.sm,
  },
  avatarWrap: { position: "relative" },
  presenceDot: { position: "absolute", right: -2, bottom: -2 },
  cardBody: { flex: 1, minWidth: 0 },
  cardActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandSubtle,
  },

  rowName: { ...typography.subtitle, color: colors.text, fontWeight: "600" },
  rowSub: { ...typography.caption, color: colors.textMuted, marginTop: 2 },

  reqActions: { alignItems: "flex-end", gap: 6 },

  avatarFallback: { backgroundColor: colors.brandNavy, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: colors.brandTextOn, fontWeight: "700" },
});
