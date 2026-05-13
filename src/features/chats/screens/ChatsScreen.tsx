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
import { EmptyState, Skeleton } from "../../../components/ui";
import { API_ROUTES } from "../../../config/apiRoutes";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { colors, radii, space, typography } from "../../../theme";
import type { MainTabScreenProps } from "../../../navigation/types";

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
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          accessibilityLabel="Search conversations"
        />
        {!!search && (
          <Pressable onPress={() => setSearch("")} accessibilityLabel="Clear search">
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
          renderItem={({ item }) => <ConversationRow item={item} />}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles-outline"
              title={search ? "No matching conversations" : "No chats yet"}
              description={
                search
                  ? "Try a different search term."
                  : "Your conversations with trainers and trainees will appear here."
              }
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceElevated },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

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
  searchInput: { flex: 1, ...typography.bodyMd, color: colors.text },

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
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surfaceElevated,
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
});
