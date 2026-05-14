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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "../../../api/client";
import { EmptyState, Skeleton } from "../../../components/ui";
import { API_ROUTES } from "../../../config/apiRoutes";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { colors, radii, space, typography } from "../../../theme";
import { useAuth } from "../../auth/context/AuthContext";
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
    (conv: any): ChatPartner => {
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
        items.push({
          _id: String(other._id),
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

            return (
              <Pressable
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
                onPress={() =>
                  setActiveChat({
                    conversationId: item._id,
                    partner,
                  })
                }
              >
                <View style={styles.avatarWrap}>
                  <Avatar uri={partner.profile_picture} name={partner.fullname} />
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

      {/* New Chat Modal — Friend Picker */}
      <Modal
        visible={showNewChat}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowNewChat(false); setFriendSearch(""); }}
      >
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => { setShowNewChat(false); setFriendSearch(""); }} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
            <Text style={styles.modalTitle}>New Chat</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.modalSearch}>
            <Ionicons name="search-outline" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search friends..."
              placeholderTextColor={colors.textMuted}
              value={friendSearch}
              onChangeText={setFriendSearch}
              autoFocus
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
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.friendRow, pressed && { opacity: 0.8 }]}
                  onPress={() => openChatWithFriend(item)}
                  disabled={creatingChat}
                >
                  <Avatar uri={item.profile_picture} name={item.fullname} size={44} />
                  <Text style={styles.friendName} numberOfLines={1}>
                    {item.fullname}
                  </Text>
                  {creatingChat ? (
                    <ActivityIndicator size="small" color={colors.brandNavy} />
                  ) : (
                    <Ionicons name="chatbubble-outline" size={20} color={colors.brandNavy} />
                  )}
                </Pressable>
              )}
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
  friendName: { ...typography.subtitle, color: colors.text, flex: 1 },
});
