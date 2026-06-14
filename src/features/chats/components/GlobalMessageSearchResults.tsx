import React, { useMemo } from "react";
import { useDebouncedValue, SEARCH_LOCAL_DEBOUNCE_MS } from "../../../lib/timing";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { useThemeColors } from "../../../theme";
import { searchAllMessages } from "../api/chatActionsApi";
import { useChatOverlayStyles } from "../hooks/useChatOverlayStyles";

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
  const c = useThemeColors();
  const styles = useChatOverlayStyles();
  const debounced = useDebouncedValue(query.trim(), SEARCH_LOCAL_DEBOUNCE_MS);

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
    <View style={styles.searchResultsWrap}>
      <View style={styles.searchResultsHeader}>
        <Ionicons name="search" size={14} color={c.textMuted} />
        <Text style={styles.searchResultsHeaderLabel}>
          {isLoading
            ? "Searching messages…"
            : `Matches in messages — ${hits.length}`}
        </Text>
      </View>
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 12 }} color={c.brand} />
      ) : (
        <FlatList
          data={hits}
          keyExtractor={(h) => h.messageId}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
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
                  styles.listRow,
                  pressed && styles.listRowPressed,
                ]}
              >
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarSm} />
                ) : (
                  <View style={[styles.avatarSm, styles.avatarFallback]}>
                    <Text style={styles.avatarLetter}>
                      {item.title?.[0]?.toUpperCase() || "?"}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.listTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.listSub} numberOfLines={1}>
                    {item.content || "(no preview)"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No messages match "{debounced}". Try a different word.
            </Text>
          }
        />
      )}
    </View>
  );
}
