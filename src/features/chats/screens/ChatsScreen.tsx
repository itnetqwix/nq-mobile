import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { radii, space } from "../../../theme/tokens";
import type { MainTabScreenProps } from "../../../navigation/types";

const NAVY = "#000080";

async function fetchConversations(): Promise<any[]> {
  try {
    // Use the booking list as a proxy for conversations (each booking = a trainer-trainee pair)
    const res = await apiClient.get(API_ROUTES.user.bookingList);
    return res.data?.result ?? res.data ?? [];
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

function ConversationRow({ item }: { item: any }) {
  // Derive a "conversation partner" from the booking
  const trainer = item?.trainer_info;
  const trainee = item?.trainee_info;
  // Show whichever is not the current user — use both for now
  const partner = trainer ?? trainee;
  const name = partner?.fullname || partner?.fullName || "User";
  const lastMsg = item?.last_message?.content ?? item?.lastMessage ?? "";
  const unread = item?.unread_count ?? item?.unreadCount ?? 0;
  const time = timeAgo(item?.updatedAt ?? item?.last_message?.createdAt);

  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}>
      <View style={styles.avatarWrap}>
        <Avatar uri={partner?.profile_picture} name={name} />
        {partner?.is_online && <View style={styles.onlineDot} />}
      </View>
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={styles.rowName} numberOfLines={1}>{name}</Text>
          {!!time && <Text style={styles.rowTime}>{time}</Text>}
        </View>
        <View style={styles.rowBottom}>
          <Text style={styles.rowPreview} numberOfLines={1}>
            {lastMsg || "Tap to start chatting"}
          </Text>
          {unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{unread > 99 ? "99+" : unread}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export function ChatsScreen(_props: MainTabScreenProps<"Chats">) {
  const [search, setSearch] = React.useState("");

  const { data: conversations = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["conversations"],
    queryFn: fetchConversations,
    staleTime: 30_000,
  });

  const filtered = search.trim()
    ? conversations.filter((c: any) => {
        const t = c?.trainer_info?.fullname ?? c?.trainee_info?.fullname ?? "";
        return t.toLowerCase().includes(search.toLowerCase());
      })
    : conversations;

  return (
    <View style={styles.root}>
      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations..."
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
        />
        {!!search && (
          <Pressable onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color="#9ca3af" />
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={NAVY} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, i) => item?._id ?? String(i)}
          renderItem={({ item }) => <ConversationRow item={item} />}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={NAVY} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyTitle}>
                {search ? "No matching conversations" : "No chats yet"}
              </Text>
              <Text style={styles.emptyBody}>
                {search
                  ? "Try a different search term."
                  : "Your conversations with trainers and trainees will appear here."}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    margin: space.md,
    borderRadius: radii.md,
    paddingHorizontal: space.sm,
    paddingVertical: 9,
    gap: space.sm,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#111827" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingVertical: 12,
    gap: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f3f4f6",
  },
  avatarWrap: { position: "relative" },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#16a34a",
    borderWidth: 2,
    borderColor: "#fff",
  },
  rowContent: { flex: 1 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowName: { fontSize: 15, fontWeight: "700", color: "#111827", flex: 1, marginRight: 8 },
  rowTime: { fontSize: 12, color: "#9ca3af" },
  rowBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 3 },
  rowPreview: { fontSize: 13, color: "#6b7280", flex: 1, marginRight: 8 },
  unreadBadge: {
    backgroundColor: NAVY,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadText: { fontSize: 11, color: "#fff", fontWeight: "700" },

  avatarFallback: { backgroundColor: NAVY, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: "#fff", fontWeight: "700" },

  empty: { alignItems: "center", paddingVertical: space.xl * 2, gap: space.sm, paddingHorizontal: space.lg },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#374151" },
  emptyBody: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20 },
});
