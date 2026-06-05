import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "../../../api/client";
import {
  ChatRowSkeleton,
  EmptyState,
  MorphRefreshHeader,
  Skeleton,
  SkeletonGroup,
} from "../../../components/ui";
import {
  FLATLIST_PERF_DEFAULTS,
  chatListGetItemLayout,
} from "../../../lib/lists/flatListPerf";
import { useCombinedScroll } from "../../../lib/refresh/useCombinedScroll";
import { useMorphRefresh } from "../../../lib/refresh/useMorphRefresh";
import { API_ROUTES } from "../../../config/apiRoutes";
import { queryKeys } from "../../../lib/queryKeys";
import { flatListKeyExtractor } from "../../../lib/lists/trainerListUtils";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { useAuth } from "../../auth/context/AuthContext";
import { useOnlinePresence } from "../../socket/useOnlinePresence";
import { fetchFriends } from "../../home/api/homeApi";
import { useHomeScrollHandler } from "../../home/hooks/useHomeScrollHandler";
import {
  archiveChatConversation,
  createGroupWithInvites,
  deleteChatConversation,
  fetchGroupInvites,
  respondGroupInvite,
} from "../api/chatActionsApi";
import { useFocusEffect } from "@react-navigation/native";
import { TabScreenShell } from "../../../lib/layout";
import { useFloatingTabBarBottomInset } from "../../../navigation/useFloatingTabBarBottomInset";
import type { MainTabScreenProps } from "../../../navigation/types";
import { useChatRoomChrome } from "../hooks/useChatRoomChrome";
import { ChatRoomScreen } from "./ChatRoomScreen";
import {
  getPresignedChatUploadUrl,
  uploadChatFileToS3,
} from "../lib/chatMediaUpload";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import type { TFunction } from "i18next";

async function fetchConversations(): Promise<any[]> {
  try {
    const res = await apiClient.get(API_ROUTES.chat.conversations);
    const body = (res as any)?.data ?? res;
    return body?.data ?? body?.result ?? [];
  } catch {
    return [];
  }
}

function formatLastMessagePreview(raw: string, t: TFunction): string {
  const s = String(raw ?? "").trim();
  if (s === "[video]" || s === "[clip]") return t("chats.video");
  if (s === "[image]") return t("chats.photo");
  if (s === "[voice]") return t("chats.voiceMessage");
  return s;
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "now";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  } catch {
    return "";
  }
}

function Avatar({ uri, name, size = 48 }: { uri?: string; name?: string; size?: number }) {
  const c = useThemeColors();
  const [failed, setFailed] = React.useState(false);
  const url = getS3ImageUrl(uri);
  if (!url || failed) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: c.brandAccent,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: size * 0.4, color: c.brandTextOn, fontWeight: "700" }}>
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

type ChatPartner = {
  _id: string;
  fullname?: string;
  profile_picture?: string;
};

export function ChatsScreen({ navigation }: MainTabScreenProps<"Chats">) {
  const { t } = useAppTranslation();
  const homeScroll = useHomeScrollHandler();
  const c = useThemeColors();
  const styles = useThemedStyles((palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.surface },
  listHeader: {
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
    backgroundColor: palette.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  listTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: palette.brandNavy,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.surfaceMuted,
    marginHorizontal: space.md,
    marginBottom: space.sm,
    borderRadius: radii.lg,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    gap: space.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: typography.bodyMd.fontWeight,
    fontFamily: typography.bodyMd.fontFamily,
    letterSpacing: typography.bodyMd.letterSpacing,
    color: palette.text,
    textAlignVertical: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    gap: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  avatarWrap: { position: "relative" },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: palette.chatPresence,
    borderWidth: 2,
    borderColor: palette.surface,
  },
  rowContent: { flex: 1 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowName: { ...typography.subtitle, color: palette.text, flex: 1, marginRight: 8 },
  rowTime: { ...typography.caption, color: palette.textMuted },
  rowBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 3 },
  rowPreviewWrap: { flex: 1, marginRight: 8, minWidth: 0 },
  rowOnline: { fontSize: 12, fontWeight: "600", color: palette.chatPresence, marginBottom: 1 },
  rowPreview: { ...typography.bodySm, color: palette.textMuted },
  unreadBadge: {
    backgroundColor: palette.brandNavy,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadText: { fontSize: 11, color: palette.brandTextOn, fontWeight: "700" },
  avatarFallback: {
    backgroundColor: palette.brandNavy,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { color: palette.brandTextOn, fontWeight: "700" },

  fab: {
    position: "absolute",
    right: space.md,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.brandNavy,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
    elevation: 8,
    shadowColor: palette.neutral900,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },

  modalRoot: { flex: 1, backgroundColor: palette.surface },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.md,
    paddingVertical: 14,
    backgroundColor: palette.surfaceElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  modalTitle: { ...typography.titleSm, color: palette.text },
  modalSearch: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.surfaceMuted,
    marginHorizontal: space.md,
    marginBottom: space.sm,
    borderRadius: radii.lg,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    gap: space.sm,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: typography.bodyMd.fontWeight,
    fontFamily: typography.bodyMd.fontFamily,
    letterSpacing: typography.bodyMd.letterSpacing,
    color: palette.text,
    textAlignVertical: "center",
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: 10,
    paddingHorizontal: space.sm,
    backgroundColor: palette.surfaceElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
  },
  friendRowSelected: {
    backgroundColor: `${palette.brandNavy}10`,
    borderColor: palette.brandNavy,
  },
  friendName: { ...typography.subtitle, color: palette.text, flex: 1 },
  modalCreateBtn: { color: palette.brandNavy, fontWeight: "700", fontSize: 16 },
  groupNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: space.md,
    paddingTop: 12,
  },
  groupIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.brandNavy,
    alignItems: "center",
    justifyContent: "center",
  },
  groupNameInput: {
    flex: 1,
    fontSize: 16,
    color: palette.text,
    borderBottomWidth: 2,
    borderBottomColor: palette.brandNavy,
    paddingVertical: 8,
  },
  selectedCount: {
    paddingHorizontal: space.md,
    paddingTop: 8,
    fontSize: 13,
    color: palette.brandNavy,
    fontWeight: "600",
  },
  inviteSection: {
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  inviteTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.brandNavy,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  inviteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  inviteName: { ...typography.subtitle, color: palette.text, flex: 1 },
  inviteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.sm,
    backgroundColor: palette.brandNavy,
  },
  inviteBtnText: { color: palette.brandTextOn, fontSize: 13, fontWeight: "600" },
  inviteDecline: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: palette.border,
  },
  inviteDeclineText: { color: palette.textMuted, fontSize: 13, fontWeight: "600" },
}));
  const tabBarPad = useFloatingTabBarBottomInset(space.md);
  const listPadBottom = useMemo(() => tabBarPad + 56 + space.md, [tabBarPad]);

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const currentUserId = String((user as any)?._id ?? (user as any)?.id ?? "");
  const [search, setSearch] = useState("");
  const [activeChat, setActiveChat] = useState<{
    conversationId: string;
    partner: ChatPartner & { isGroup?: boolean };
    isGroup?: boolean;
    memberCount?: number;
    groupAdminId?: string;
    groupDescription?: string;
  } | null>(null);
  useChatRoomChrome(!!activeChat);

  // Clear drawer/root headers left on by older builds that toggled parent navigators.
  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.getParent?.()?.setOptions?.({ headerShown: false });
    }, [navigation])
  );

  const [showNewChat, setShowNewChat] = useState(false);
  const [friendSearch, setFriendSearch] = useState("");
  const [creatingChat, setCreatingChat] = useState(false);
  const [showGroupCreate, setShowGroupCreate] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<Set<string>>(new Set());
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupDescription, setGroupDescription] = useState("");
  const [groupAvatarUri, setGroupAvatarUri] = useState<string | null>(null);
  const [showAllSelectedMembers, setShowAllSelectedMembers] = useState(false);
  const { isOnline } = useOnlinePresence();

  const { data: conversations = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: queryKeys.chats.conversations,
    queryFn: fetchConversations,
    staleTime: 15_000,
    refetchInterval: 25_000,
  });

  const morphRefresh = useMorphRefresh({
    onRefresh: async () => {
      await refetch();
    },
  });
  const onListScroll = useCombinedScroll(morphRefresh.scrollProps.onScroll, homeScroll.onScroll);

  const { data: groupInvites = [], refetch: refetchGroupInvites } = useQuery({
    queryKey: queryKeys.chats.groupInvites,
    queryFn: fetchGroupInvites,
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

  const { data: friends = [], isLoading: loadingFriends } = useQuery({
    queryKey: queryKeys.friends.list,
    queryFn: fetchFriends,
    staleTime: 120_000,
    enabled: showNewChat || showGroupCreate,
  });

  const getPartner = useCallback(
    (conv: any): ChatPartner & { isGroup?: boolean } => {
      if (conv?.isGroup) {
        return {
          _id: String(conv._id),
          fullname: conv.groupName ?? t("chats.group"),
          profile_picture: conv.groupAvatar,
          isGroup: true,
        };
      }
      const participants: any[] = conv?.participants ?? [];
      const other = participants.find(
        (p: any) => String(p?._id) !== currentUserId
      );
      if (other) {
        return {
          _id: String(other._id),
          fullname: other.fullname ?? other.fullName,
          profile_picture: other.profile_picture,
        };
      }
      const trainer = conv?.trainer_info;
      const trainee = conv?.trainee_info;
      const p = trainer ?? trainee;
      return {
        _id: String(p?._id ?? ""),
        fullname: p?.fullname ?? p?.fullName ?? t("chats.unknownUser"),
        profile_picture: p?.profile_picture,
      };
    },
    [currentUserId, t]
  );

  const toggleGroupMember = useCallback((id: string) => {
    setSelectedGroupMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c: any) => {
      const p = getPartner(c);
      return (p.fullname ?? "").toLowerCase().includes(q);
    });
  }, [conversations, search, getPartner]);

  const friendsList = useMemo(() => {
    const items: ChatPartner[] = [];
    const seen = new Set<string>();
    for (const f of friends) {
      const receiver = f?.receiverId;
      const sender = f?.senderId;

      let other: any = null;
      if (receiver && typeof receiver === "object" && receiver._id) {
        other = String(receiver._id) !== currentUserId ? receiver : null;
      }
      if (!other && sender && typeof sender === "object" && sender._id) {
        other = String(sender._id) !== currentUserId ? sender : null;
      }
      if (!other && f?._id && String(f._id) !== currentUserId) {
        other = f;
      }

      if (other && other._id) {
        const id = String(other._id);
        if (seen.has(id)) continue;
        seen.add(id);
        items.push({
          _id: id,
          fullname: other.fullname ?? other.fullName ?? t("chats.friendDefault"),
          profile_picture: other.profile_picture,
        });
      }
    }
    if (!friendSearch.trim()) return items;
    const q = friendSearch.toLowerCase();
    return items.filter((fp) => (fp.fullname ?? "").toLowerCase().includes(q));
  }, [friends, currentUserId, friendSearch, t]);

  const selectedMemberList = useMemo(
    () => friendsList.filter((f) => selectedGroupMembers.has(f._id)),
    [friendsList, selectedGroupMembers]
  );

  const pickGroupAvatar = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("locker.permissionTitle"), t("chats.permissionPhoto"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setGroupAvatarUri(result.assets[0].uri);
    }
  }, [t]);

  const createGroup = useCallback(async () => {
    if (!groupName.trim() || selectedGroupMembers.size < 2) {
      Alert.alert(t("common.error"), t("chats.groupNameAndMembersError"));
      return;
    }
    setCreatingGroup(true);
    const desc = groupDescription.trim();
    try {
      let groupAvatar: string | null = null;
      if (groupAvatarUri) {
        const fileName = `group-${Date.now()}.jpg`;
        const { uploadUrl, mediaUrl } = await getPresignedChatUploadUrl(fileName, "image/jpeg");
        await uploadChatFileToS3(uploadUrl, groupAvatarUri, "image/jpeg");
        groupAvatar = mediaUrl;
      }
      const res = await createGroupWithInvites({
        participantIds: Array.from(selectedGroupMembers),
        groupName: groupName.trim(),
        groupDescription: desc,
        groupAvatar,
      });
      const body = res as any;
      const conversation = body?.data ?? body?.result ?? body;
      const convId = conversation?._id;
      if (convId) {
        setShowGroupCreate(false);
        setShowNewChat(false);
        setGroupName("");
        setGroupDescription("");
        setGroupAvatarUri(null);
        setSelectedGroupMembers(new Set());
        queryClient.invalidateQueries({ queryKey: queryKeys.chats.conversations });
        Alert.alert(t("chats.groupCreatedTitle"), t("chats.groupCreatedBody"));
        setActiveChat({
          conversationId: convId,
          isGroup: true,
          memberCount: 1,
          groupAdminId: currentUserId,
          groupDescription: desc,
          partner: {
            _id: String(convId),
            fullname: groupName.trim(),
            profile_picture: groupAvatar ?? undefined,
            isGroup: true,
          },
        });
      } else {
        Alert.alert(t("common.error"), t("chats.groupCreateError"));
      }
    } catch (e: any) {
      Alert.alert(
        t("common.error"),
        e?.response?.data?.error ?? e?.message ?? t("chats.groupCreateError")
      );
    } finally {
      setCreatingGroup(false);
    }
  }, [
    groupName,
    groupDescription,
    groupAvatarUri,
    selectedGroupMembers,
    queryClient,
    currentUserId,
    t,
  ]);

  const openChatWithFriend = useCallback(async (friend: ChatPartner) => {
    setCreatingChat(true);
    try {
      const res = await apiClient.post(API_ROUTES.chat.conversation, {
        otherUserId: friend._id,
        participantId: friend._id,
      });
      const body = (res as any)?.data ?? res;
      const conversation = body?.data ?? body?.result ?? body;
      const convId = conversation?._id ?? conversation?.conversationId;
      if (convId) {
        setShowNewChat(false);
        setFriendSearch("");
        queryClient.invalidateQueries({ queryKey: queryKeys.chats.conversations });
        setActiveChat({ conversationId: convId, partner: friend });
      } else {
        Alert.alert(t("common.error"), t("chats.openChatError"));
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? e?.message ?? t("chats.openChatGenericError");
      Alert.alert(t("common.error"), msg);
    } finally {
      setCreatingChat(false);
    }
  }, [queryClient, t]);

  if (activeChat) {
    return (
      <ChatRoomScreen
        conversationId={activeChat.conversationId}
        partner={activeChat.partner}
        isGroup={!!activeChat.isGroup}
        memberCount={activeChat.memberCount}
        groupAdminId={activeChat.groupAdminId}
        groupDescription={activeChat.groupDescription}
        onGoBack={() => {
          setActiveChat(null);
          refetch();
        }}
      />
    );
  }

  return (
    <TabScreenShell clearFloatingTabBar={false}>
      <MorphRefreshHeader
        {...morphRefresh.headerProps}
        refreshing={morphRefresh.refreshing || isRefetching}
      />
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={c.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder={t("chats.searchPlaceholder")}
          placeholderTextColor={c.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {!!search && (
          <Pressable onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color={c.textMuted} />
          </Pressable>
        )}
        <Pressable
          onPress={() => navigation.navigate("Home", { screen: "ArchivedChats" })}
          accessibilityLabel={t("chats.archivedChatsA11y")}
          hitSlop={8}
        >
          <Ionicons name="archive-outline" size={22} color={c.brandNavy} />
        </Pressable>
      </View>

      {groupInvites.length > 0 ? (
        <View style={styles.inviteSection}>
          <Text style={styles.inviteTitle}>{t("chats.groupRequests")}</Text>
          {groupInvites.map((inv: any) => {
            const convId = String(inv.conversationId ?? inv._id ?? "");
            const name = inv.groupName ?? t("chats.group");
            return (
              <View key={convId} style={styles.inviteRow}>
                <Ionicons name="people-outline" size={22} color={c.brandNavy} />
                <Text style={styles.inviteName} numberOfLines={1}>
                  {name}
                </Text>
                <Pressable
                  style={styles.inviteDecline}
                  onPress={() => {
                    void respondGroupInvite(convId, false).then(() => {
                      void refetchGroupInvites();
                      void refetch();
                    });
                  }}
                >
                  <Text style={styles.inviteDeclineText}>{t("chats.decline")}</Text>
                </Pressable>
                <Pressable
                  style={styles.inviteBtn}
                  onPress={() => {
                    void respondGroupInvite(convId, true).then(() => {
                      void refetchGroupInvites();
                      void refetch();
                    });
                  }}
                >
                  <Text style={styles.inviteBtnText}>{t("chats.accept")}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      {isLoading ? (
        <View style={{ padding: space.md }}>
          <SkeletonGroup count={5} renderRow={() => <ChatRowSkeleton />} />
        </View>
      ) : (
        <FlatList<any>
          data={filtered as any[]}
          keyExtractor={(item, index) => flatListKeyExtractor(item, index)}
          onScroll={onListScroll}
          scrollEventThrottle={16}
          {...FLATLIST_PERF_DEFAULTS}
          getItemLayout={chatListGetItemLayout}
          renderItem={({ item }) => {
            const partner = getPartner(item);
            const lastMsg = item.lastMessage ?? item.last_message ?? "";
            const unread = item.unreadCount ?? 0;
            const time = timeAgo(item.lastMessageAt ?? item.updatedAt);
            const isGroup = !!(item.isGroup || (partner as any).isGroup);
            const participants: any[] = item?.participants ?? [];
            const otherParticipant = participants.find(
              (p: any) => String(p?._id) !== currentUserId
            );
            const partnerOnline =
              !isGroup &&
              (isOnline(partner._id) || otherParticipant?.isOnline === true);

            return (
              <Pressable
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
                onPress={() =>
                  setActiveChat({
                    conversationId: String(item._id ?? item.id ?? ""),
                    isGroup,
                    memberCount: participants.length,
                    groupAdminId: item.groupAdmin ? String(item.groupAdmin) : undefined,
                    groupDescription: item.groupDescription ?? "",
                    partner: {
                      _id: partner._id,
                      fullname: partner.fullname,
                      profile_picture: partner.profile_picture,
                      isGroup,
                    },
                  })
                }
                onLongPress={() => {
                  Alert.alert(partner.fullname ?? t("chats.chat"), undefined, [
                    {
                      text: t("chats.archive"),
                      onPress: () => {
                        void archiveChatConversation(String(item._id)).then(() =>
                          queryClient.invalidateQueries({ queryKey: ["conversations"] })
                        );
                      },
                    },
                    {
                      text: t("chats.deleteChat"),
                      style: "destructive",
                      onPress: () => {
                        void deleteChatConversation(String(item._id)).then(() =>
                          queryClient.invalidateQueries({ queryKey: ["conversations"] })
                        );
                      },
                    },
                    { text: t("common.cancel"), style: "cancel" },
                  ]);
                }}
              >
                <View style={styles.avatarWrap}>
                  {isGroup ? (
                    getS3ImageUrl(item.groupAvatar ?? partner.profile_picture) ? (
                      <Avatar
                        uri={item.groupAvatar ?? partner.profile_picture}
                        name={partner.fullname}
                        size={48}
                      />
                    ) : (
                      <View style={[styles.avatarFallback, { width: 48, height: 48, borderRadius: 24 }]}>
                        <Ionicons name="people" size={22} color={c.brandTextOn} />
                      </View>
                    )
                  ) : (
                    <>
                      <Avatar uri={partner.profile_picture} name={partner.fullname} />
                      {partnerOnline && <View style={styles.onlineDot} />}
                    </>
                  )}
                </View>
                <View style={styles.rowContent}>
                  <View style={styles.rowTop}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {partner.fullname ?? t("chats.unknownUser")}
                    </Text>
                    {!!time && <Text style={styles.rowTime}>{time}</Text>}
                  </View>
                  <View style={styles.rowBottom}>
                    <View style={styles.rowPreviewWrap}>
                      {partnerOnline && (
                        <Text style={styles.rowOnline}>{t("chats.online")}</Text>
                      )}
                      <Text style={styles.rowPreview} numberOfLines={1}>
                        {formatLastMessagePreview(lastMsg, t) || t("chats.tapToChat")}
                      </Text>
                    </View>
                    {unread > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>
                          {unread > 99 ? "99+" : unread}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          }}
          refreshControl={
            <RefreshControl
              refreshing={morphRefresh.refreshing || isRefetching}
              onRefresh={morphRefresh.onRefreshControl}
              tintColor={c.iconPrimary}
            />
          }
          contentContainerStyle={
            filtered.length > 0 ? { paddingBottom: listPadBottom } : undefined
          }
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles-outline"
              title={search ? t("chats.noMatchingConversations") : t("chats.noConversations")}
              description={search ? t("chats.noMatchingDescription") : t("chats.emptyDescription")}
            />
          }
        />
      )}

      {/* New Chat FAB */}
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { bottom: tabBarPad },
          pressed && { transform: [{ scale: 0.92 }] },
        ]}
        onPress={() => setShowNewChat(true)}
      >
        <Ionicons name="create-outline" size={24} color={c.brandTextOn} />
      </Pressable>

      {/* New Chat Modal — Friend Picker + Group */}
      <Modal
        visible={showNewChat}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowNewChat(false);
          setShowGroupCreate(false);
          setFriendSearch("");
          setGroupName("");
          setGroupDescription("");
          setGroupAvatarUri(null);
          setSelectedGroupMembers(new Set());
        }}
      >
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => {
              if (showGroupCreate) {
                setShowGroupCreate(false);
                setGroupName("");
                setSelectedGroupMembers(new Set());
              } else {
                setShowNewChat(false);
                setFriendSearch("");
              }
            }} hitSlop={12}>
              <Ionicons name={showGroupCreate ? "arrow-back" : "close"} size={24} color={c.text} />
            </Pressable>
            <Text style={styles.modalTitle}>
              {showGroupCreate ? t("chats.newGroup") : t("chats.newChat")}
            </Text>
            {showGroupCreate ? (
              <Pressable onPress={createGroup} disabled={creatingGroup} hitSlop={12}>
                {creatingGroup ? (
                  <ActivityIndicator size="small" color={c.iconPrimary} />
                ) : (
                  <Text style={[styles.modalCreateBtn, selectedGroupMembers.size < 2 && { opacity: 0.4 }]}>
                    {t("chats.create")}
                  </Text>
                )}
              </Pressable>
            ) : (
              <Pressable onPress={() => setShowGroupCreate(true)} hitSlop={12}>
                <Ionicons name="people" size={24} color={c.iconPrimary} />
              </Pressable>
            )}
          </View>

          {/* Group name input */}
          {showGroupCreate && (
            <>
              <View style={[styles.groupNameRow, { alignItems: "flex-start" }]}>
                <View style={{ alignItems: "center", width: 56 }}>
                  <Pressable onPress={pickGroupAvatar} style={styles.groupIconCircle}>
                    {groupAvatarUri ? (
                      <Image source={{ uri: groupAvatarUri }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                    ) : (
                      <Ionicons name="camera-outline" size={22} color={c.brandTextOn} />
                    )}
                  </Pressable>
                  <Text style={{ fontSize: 11, color: c.textMuted, marginTop: 4, textAlign: "center" }}>
                    {t("chats.groupPhoto")}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 8 }}>
                  <TextInput
                    style={styles.groupNameInput}
                    placeholder={t("chats.groupNamePlaceholder")}
                    placeholderTextColor={c.textMuted}
                    value={groupName}
                    onChangeText={setGroupName}
                    autoFocus
                  />
                  <TextInput
                    style={[styles.groupNameInput, { borderBottomColor: c.border }]}
                    placeholder={t("chats.descriptionOptional")}
                    placeholderTextColor={c.textMuted}
                    value={groupDescription}
                    onChangeText={setGroupDescription}
                  />
                </View>
              </View>
              {selectedGroupMembers.size > 0 && (
                <View style={{ paddingHorizontal: space.md, paddingTop: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={styles.selectedCount}>
                      {t("chats.friendsSelected", { count: selectedGroupMembers.size })}
                    </Text>
                    {selectedGroupMembers.size > 10 ? (
                      <Pressable onPress={() => setShowAllSelectedMembers(true)}>
                        <Text style={styles.modalCreateBtn}>{t("chats.seeAll")}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                    {selectedMemberList.slice(0, 10).map((m, mi) => (
                      <View key={`${m._id}-${mi}`} style={{ alignItems: "center", marginRight: 10, width: 56 }}>
                        <Avatar uri={m.profile_picture} name={m.fullname} size={44} />
                        <Text style={{ fontSize: 10, color: c.textMuted, marginTop: 4 }} numberOfLines={1}>
                          {(m.fullname ?? "").split(" ")[0]}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}
            </>
          )}

          <View style={styles.modalSearch}>
            <Ionicons name="search-outline" size={18} color={c.textMuted} />
            <TextInput
              style={styles.modalSearchInput}
              placeholder={showGroupCreate ? t("chats.addParticipants") : t("chats.searchFriends")}
              placeholderTextColor={c.textMuted}
              value={friendSearch}
              onChangeText={setFriendSearch}
            />
            {!!friendSearch && (
              <Pressable onPress={() => setFriendSearch("")}>
                <Ionicons name="close-circle" size={18} color={c.textMuted} />
              </Pressable>
            )}
          </View>

          {loadingFriends ? (
            <View style={{ padding: space.md }}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={{ marginBottom: space.md, flexDirection: "row", gap: space.sm, alignItems: "center" }}>
                  <Skeleton width={44} height={44} radius={22} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Skeleton width="50%" height={14} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <FlatList
              data={friendsList}
              keyExtractor={flatListKeyExtractor}
              renderItem={({ item }) => {
                const isSelected = selectedGroupMembers.has(item._id);
                return (
                  <Pressable
                    style={({ pressed }) => [styles.friendRow, pressed && { opacity: 0.8 }, isSelected && styles.friendRowSelected]}
                    onPress={() => showGroupCreate ? toggleGroupMember(item._id) : openChatWithFriend(item)}
                    disabled={creatingChat}
                  >
                    <Avatar uri={item.profile_picture} name={item.fullname} size={44} />
                    <Text style={styles.friendName} numberOfLines={1}>
                      {item.fullname}
                    </Text>
                    {showGroupCreate ? (
                      <Ionicons name={isSelected ? "checkmark-circle" : "ellipse-outline"} size={24} color={isSelected ? c.brandNavy : c.textMuted} />
                    ) : creatingChat ? (
                      <ActivityIndicator size="small" color={c.iconPrimary} />
                    ) : (
                      <Ionicons name="chatbubble-outline" size={20} color={c.iconPrimary} />
                    )}
                  </Pressable>
                );
              }}
              contentContainerStyle={{ padding: space.md, gap: space.xs }}
              ListEmptyComponent={
                <EmptyState
                  icon="people-outline"
                  title={t("chats.noFriendsFound")}
                  description={
                    friendSearch ? t("chats.noFriendsMatch") : t("chats.addFriendsFromCommunity")
                  }
                />
              }
            />
          )}
        </View>
      </Modal>

      <Modal
        visible={showAllSelectedMembers}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAllSelectedMembers(false)}
      >
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowAllSelectedMembers(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color={c.text} />
            </Pressable>
            <Text style={styles.modalTitle}>{t("chats.selectedMembers")}</Text>
            <View style={{ width: 24 }} />
          </View>
          <FlatList
            data={selectedMemberList}
            keyExtractor={flatListKeyExtractor}
            renderItem={({ item }) => (
              <View style={styles.friendRow}>
                <Avatar uri={item.profile_picture} name={item.fullname} size={44} />
                <Text style={styles.friendName}>{item.fullname}</Text>
              </View>
            )}
            contentContainerStyle={{ padding: space.md, gap: space.xs }}
          />
        </View>
      </Modal>
    </TabScreenShell>
  );
}


