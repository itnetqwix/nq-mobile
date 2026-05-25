import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { searchAllMessages } from "../api/chatActionsApi";

type Props = {
  query: string;
  currentUserId: string;
  onOpenResult: (
    conversationId: string,
    partner: any,
    targetMessageId: string,
    isGroup: boolean
  ) => void;
};

/**
 * Renders the result list when the user types in the chat-list top bar.
 *
 * The search hits the backend only after a small debounce so we don't
 * fire 6 requests for "hello". Each row links straight into the right
 * conversation, highlights the matched message via `targetMessageId`,
 * and pre-fills the in-chat search to make the match obvious.
 */
export function GlobalMessageSearchResults({
  query,
  currentUserId,
  onOpenResult,
}: Props) {
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 220);
    return () => clearTimeout(t);
  }, [query]);

  const enabled = debounced.length >= 2;

  const { data = [], isLoading } = useQuery({
    queryKey: queryKeys.chats.globalSearch(debounced),
    queryFn: () => searchAllMessages(debounced),
    enabled,
    staleTime: 10_000,
  });

  const hits = useMemo(() => {
    return (data as any[]).map((m: any) => {
      const conv = m.conversationId || {};
      const isGroup = !!conv.isGroup;
      const partner = isGroup
        ? null
        : (conv.participants || []).find(
            (p: any) => String(p._id) !== String(currentUserId)
          );
      const title = isGroup
        ? conv.groupName || "Group"
        : partner?.fullname || "User";
      const avatar = isGroup ? conv.groupAvatar : partner?.profile_picture;
      return {
        messageId: String(m._id),
        conversationId: String(conv._id || ""),
        isGroup,
        partner: isGroup ? { _id: conv._id, fullname: title, isGroup: true } : partner,
        title,
        avatar,
        content: m.content || "",
        createdAt: m.createdAt,
      };
    });
  }, [data, currentUserId]);

  if (!enabled) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Ionicons name="search" size={14} color="#6B7280" />
        <Text style={styles.headerLabel}>
          {isLoading
            ? "Searching messages…"
            : `Matches in messages — ${hits.length}`}
        </Text>
      </View>
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 12 }} />
      ) : (
        <FlatList
          data={hits}
          keyExtractor={(h) => h.messageId}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => {
            const avatarUri = getS3ImageUrl(item.avatar) || null;
            return (
              <Pressable
                onPress={() =>
                  onOpenResult(
                    item.conversationId,
                    item.partner || {
                      _id: item.conversationId,
                      fullname: item.title,
                      isGroup: item.isGroup,
                    },
                    item.messageId,
                    item.isGroup
                  )
                }
                style={({ pressed }) => [
                  styles.row,
                  pressed && { backgroundColor: "rgba(0,0,0,0.03)" },
                ]}
              >
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarLetter}>
                      {item.title?.[0]?.toUpperCase() || "?"}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.snippet} numberOfLines={1}>
                    {item.content || "(no preview)"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              No messages match "{debounced}". Try a different word.
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingTop: 8 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  headerLabel: { fontSize: 12, color: "#6B7280", fontWeight: "600" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E5E7EB",
  },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarLetter: { color: "#374151", fontWeight: "700" },
  title: { fontSize: 14, fontWeight: "600", color: "#111827" },
  snippet: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: "#F3F4F6" },
  empty: { textAlign: "center", color: "#9CA3AF", marginTop: 16, fontSize: 13 },
});
