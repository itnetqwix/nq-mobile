import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "../../../api/client";
import { EmptyState, Skeleton } from "../../../components/ui";
import { API_ROUTES } from "../../../config/apiRoutes";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { colors, radii, space, typography } from "../../../theme";
import { useAuth } from "../../auth/context/AuthContext";
import { useOnlinePresence } from "../../socket/useOnlinePresence";
import { fetchFriends } from "../../home/api/homeApi";
import type { MainTabScreenProps } from "../../../navigation/types";
import { ChatRoomScreen } from "./ChatRoomScreen";

async function fetchConversations(): Promise<any[]> {
  try {
    const res = await apiClient.get(API_ROUTES.chat.conversations);
    const body = (res as any)?.data ?? res;
    return body?.data ?? body?.result ?? [];
  } catch {
    return [];
  }
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
  const [failed, setFailed] = React.useState(false);
  const url = getS3ImageUrl(uri);
  if (!url || failed) {
    return (
      <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.avatarInitial, { fontSize: size * 0.4 }]}>
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

export function ChatsScreen(_props: MainTabScreenProps<"Chats">) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const currentUserId = String((user as any)?._id ?? (user as any)?.id ?? "");
  const [search, setSearch] = useState("");
  const [activeChat, setActiveChat] = useState<{
    conversationId: string;
    partner: ChatPartner;
  } | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [friendSearch, setFriendSearch] = useState("");
  const [creatingChat, setCreatingChat] = useState(false);
  const [showGroupCreate, setShowGroupCreate] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<Set<string>>(new Set());
  const [creatingGroup, setCreatingGroup] = useState(false);
  const { isOnline } = useOnlinePresence();

  const { data: conversations = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["conversations"],
    queryFn: fetchConversations,
    staleTime: 30_000,
  });

  const { data: friends = [], isLoading: loadingFriends } = useQuery({
    queryKey: ["friends"],
    queryFn: fetchFriends,
    staleTime: 120_000,
    enabled: showNewChat,
  });

  const getPartner = useCallback(
    (conv: any): ChatPartner & { isGroup?: boolean } => {
      if (conv?.isGroup) {
        return {
          _id: String(conv._id),
          fullname: conv.groupName ?? "Group",
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
        fullname: p?.fullname ?? p?.fullName ?? "User",
        profile_picture: p?.profile_picture,
      };
    },
    [currentUserId]
  );

  const toggleGroupMember = useCallback((id: string) => {
    setSelectedGroupMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const createGroup = useCallback(async () => {
    if (!groupName.trim() || selectedGroupMembers.size < 2) {
      Alert.alert("Error", "Please enter a group name and select at least 2 members.");
      return;
    }
    setCreatingGroup(true);
    try {
      const res = await apiClient.post(API_ROUTES.chat.createGroup, {
        participantIds: Array.from(selectedGroupMembers),
        groupName: groupName.trim(),
      });
      const body = (res as any)?.data ?? res;
      const conversation = body?.data ?? body?.result ?? body;
      const convId = conversation?._id;
      if (convId) {
        setShowGroupCreate(false);
        setShowNewChat(false);
        setGroupName("");
        setSelectedGroupMembers(new Set());
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
        setActiveChat({
          conversationId: convId,
          partner: {
            _id: convId,
            fullname: groupName.trim(),
          },
        });
      } else {
        Alert.alert("Error", "Could not create group.");
      }
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.error ?? e?.message ?? "Could not create group.");
    } finally {
      setCreatingGroup(false);
    }
  }, [groupName, selectedGroupMembers, queryClient]);

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
          fullname: other.fullname ?? other.fullName ?? "Friend",
          profile_picture: other.profile_picture,
        });
      }
    }
    if (!friendSearch.trim()) return items;
    const q = friendSearch.toLowerCase();
    return items.filter((fp) => (fp.fullname ?? "").toLowerCase().includes(q));
  }, [friends, currentUserId, friendSearch]);

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
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
        setActiveChat({ conversationId: convId, partner: friend });
      } else {
        Alert.alert("Error", "Could not open chat. Please try again.");
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? e?.message ?? "Could not open chat.";
      Alert.alert("Error", msg);
    } finally {
      setCreatingChat(false);
    }
  }, [queryClient]);

  if (activeChat) {
    return (
      <ChatRoomScreen
        conversationId={activeChat.conversationId}
        partner={activeChat.partner}
        onGoBack={() => {
          setActiveChat(null);
          refetch();
        }}
      />
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.listHeader, { paddingTop: insets.top + 4 }]}>
        <Text style={styles.listTitle}>Chats</Text>
      </View>
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {!!search && (
          <Pressable onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View style={{ padding: space.md }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ marginBottom: space.sm, flexDirection: "row", gap: space.sm, alignItems: "center" }}>
              <Skeleton width={44} height={44} radius={22} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="60%" height={12} />
                <Skeleton width="80%" height={10} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, i) => item?._id ?? String(i)}
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
                    conversationId: item._id,
                    partner: { _id: partner._id, fullname: partner.fullname, profile_picture: partner.profile_picture },
                  })
                }
              >
                <View style={styles.avatarWrap}>
                  {isGroup ? (
                    <View style={[styles.avatarFallback, { width: 48, height: 48, borderRadius: 24 }]}>
                      <Ionicons name="people" size={22} color="#fff" />
                    </View>
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
                      {partner.fullname ?? "User"}
                    </Text>
                    {!!time && <Text style={styles.rowTime}>{time}</Text>}
                  </View>
                  <View style={styles.rowBottom}>
                    <Text style={styles.rowPreview} numberOfLines={1}>
                      {lastMsg || "Tap to start chatting"}
                    </Text>
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
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandNavy} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles-outline"
              title={search ? "No matching conversations" : "No chats yet"}
              description={
                search
                  ? "Try a different search term."
                  : "Tap the + button to start chatting with your friends."
              }
            />
          }
        />
      )}

      {/* New Chat FAB */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.92 }] }]}
        onPress={() => setShowNewChat(true)}
      >
        <Ionicons name="create-outline" size={24} color={colors.brandTextOn} />
      </Pressable>

      {/* New Chat Modal — Friend Picker + Group */}
      <Modal
        visible={showNewChat}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowNewChat(false); setShowGroupCreate(false); setFriendSearch(""); setGroupName(""); setSelectedGroupMembers(new Set()); }}
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
              <Ionicons name={showGroupCreate ? "arrow-back" : "close"} size={24} color={colors.text} />
            </Pressable>
            <Text style={styles.modalTitle}>{showGroupCreate ? "New Group" : "New Chat"}</Text>
            {showGroupCreate ? (
              <Pressable onPress={createGroup} disabled={creatingGroup} hitSlop={12}>
                {creatingGroup ? (
                  <ActivityIndicator size="small" color={colors.brandNavy} />
                ) : (
                  <Text style={[styles.modalCreateBtn, selectedGroupMembers.size < 2 && { opacity: 0.4 }]}>Create</Text>
                )}
              </Pressable>
            ) : (
              <Pressable onPress={() => setShowGroupCreate(true)} hitSlop={12}>
                <Ionicons name="people" size={24} color={colors.brandNavy} />
              </Pressable>
            )}
          </View>

          {/* Group name input */}
          {showGroupCreate && (
            <View style={styles.groupNameRow}>
              <View style={styles.groupIconCircle}>
                <Ionicons name="people" size={22} color="#fff" />
              </View>
              <TextInput
                style={styles.groupNameInput}
                placeholder="Group name"
                placeholderTextColor={colors.textMuted}
                value={groupName}
                onChangeText={setGroupName}
                autoFocus
              />
            </View>
          )}

          {showGroupCreate && selectedGroupMembers.size > 0 && (
            <Text style={styles.selectedCount}>{selectedGroupMembers.size} member{selectedGroupMembers.size > 1 ? "s" : ""} selected</Text>
          )}

          <View style={styles.modalSearch}>
            <Ionicons name="search-outline" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.modalSearchInput}
              placeholder={showGroupCreate ? "Add participants..." : "Search friends..."}
              placeholderTextColor={colors.textMuted}
              value={friendSearch}
              onChangeText={setFriendSearch}
            />
            {!!friendSearch && (
              <Pressable onPress={() => setFriendSearch("")}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
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
              keyExtractor={(item) => item._id}
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
                      <Ionicons name={isSelected ? "checkmark-circle" : "ellipse-outline"} size={24} color={isSelected ? colors.brandNavy : colors.textMuted} />
                    ) : creatingChat ? (
                      <ActivityIndicator size="small" color={colors.brandNavy} />
                    ) : (
                      <Ionicons name="chatbubble-outline" size={20} color={colors.brandNavy} />
                    )}
                  </Pressable>
                );
              }}
              contentContainerStyle={{ padding: space.md, gap: space.xs }}
              ListEmptyComponent={
                <EmptyState
                  icon="people-outline"
                  title="No friends found"
                  description={
                    friendSearch
                      ? "No friends match your search."
                      : "Add friends from the Community page to start chatting."
                  }
                />
              }
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceElevated },
  listHeader: {
    paddingHorizontal: space.md,
    paddingBottom: 8,
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  listTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.brandNavy,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    margin: space.md,
    borderRadius: radii.md,
    paddingHorizontal: space.sm,
    paddingVertical: 9,
    gap: space.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: typography.bodyMd.fontWeight,
    fontFamily: typography.bodyMd.fontFamily,
    letterSpacing: typography.bodyMd.letterSpacing,
    color: colors.text,
    textAlignVertical: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingVertical: 12,
    gap: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  avatarWrap: { position: "relative" },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#4CAF50",
    borderWidth: 2,
    borderColor: colors.surface,
  },
  rowContent: { flex: 1 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowName: { ...typography.subtitle, color: colors.text, flex: 1, marginRight: 8 },
  rowTime: { ...typography.caption, color: colors.textMuted },
  rowBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 3 },
  rowPreview: { ...typography.bodySm, color: colors.textMuted, flex: 1, marginRight: 8 },
  unreadBadge: {
    backgroundColor: colors.brandNavy,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadText: { fontSize: 11, color: colors.brandTextOn, fontWeight: "700" },
  avatarFallback: {
    backgroundColor: colors.brandNavy,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { color: colors.brandTextOn, fontWeight: "700" },

  fab: {
    position: "absolute",
    right: space.md,
    bottom: space.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brandNavy,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },

  modalRoot: { flex: 1, backgroundColor: colors.surface },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.md,
    paddingVertical: 14,
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalTitle: { ...typography.titleSm, color: colors.text },
  modalSearch: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    margin: space.md,
    borderRadius: radii.md,
    paddingHorizontal: space.sm,
    paddingVertical: 9,
    gap: space.sm,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: typography.bodyMd.fontWeight,
    fontFamily: typography.bodyMd.fontFamily,
    letterSpacing: typography.bodyMd.letterSpacing,
    color: colors.text,
    textAlignVertical: "center",
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: 10,
    paddingHorizontal: space.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  friendRowSelected: {
    backgroundColor: `${colors.brandNavy}10`,
    borderColor: colors.brandNavy,
  },
  friendName: { ...typography.subtitle, color: colors.text, flex: 1 },
  modalCreateBtn: { color: colors.brandNavy, fontWeight: "700", fontSize: 16 },
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
    backgroundColor: colors.brandNavy,
    alignItems: "center",
    justifyContent: "center",
  },
  groupNameInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    borderBottomWidth: 2,
    borderBottomColor: colors.brandNavy,
    paddingVertical: 8,
  },
  selectedCount: {
    paddingHorizontal: space.md,
    paddingTop: 8,
    fontSize: 13,
    color: colors.brandNavy,
    fontWeight: "600",
  },
});
