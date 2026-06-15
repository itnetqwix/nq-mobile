import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { queryKeys } from "../../../lib/queryKeys";
import { useDebouncedValue, SEARCH_LOCAL_DEBOUNCE_MS } from "../../../lib/timing";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { haptics } from "../../../lib/haptics";
import { useThemeColors } from "../../../theme";
import { forwardChatMessage } from "../api/chatActionsApi";
import { useChatOverlayStyles } from "../hooks/useChatOverlayStyles";

type Conversation = {
  _id: string;
  isGroup?: boolean;
  groupName?: string | null;
  groupAvatar?: string | null;
  participants?: Array<{ _id: string; fullname?: string; profile_picture?: string }>;
  lastMessage?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  messageId: string;
  currentUserId: string;
  /** Conversation that contains the message — hidden from picker. */
  excludeConversationId?: string;
  onForwarded?: () => void;
};

/**
 * Bottom sheet for forwarding a chat message. Pulls the existing chat
 * conversations list, lets the user pick up to 5, then fires off the
 * forward API in a single batch.
 */
export function ForwardPickerSheet({
  visible,
  onClose,
  messageId,
  currentUserId,
  excludeConversationId,
  onForwarded,
}: Props) {
  const c = useThemeColors();
  const styles = useChatOverlayStyles();
  const [selected, setSelected] = useState<Record<string, true>>({});
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, SEARCH_LOCAL_DEBOUNCE_MS);
  const [submitting, setSubmitting] = useState(false);

  const { data: conversations = [], isLoading } = useQuery<Conversation[]>({
    queryKey: queryKeys.chats.conversations,
    queryFn: async () => {
      const res = await apiClient.get(API_ROUTES.chat.conversations);
      const body = (res as any)?.data ?? res;
      return body?.data ?? body?.result ?? [];
    },
    enabled: visible,
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return conversations
      .filter((c) => !excludeConversationId || c._id !== excludeConversationId)
      .map((c) => {
        const other = c.isGroup
          ? null
          : c.participants?.find((p) => String(p._id) !== String(currentUserId));
        const title = c.isGroup ? c.groupName || "Group" : other?.fullname || "User";
        const avatar = c.isGroup ? c.groupAvatar : other?.profile_picture;
        return { ...c, _title: title, _avatar: avatar };
      })
      .filter((c: any) => (q ? (c._title || "").toLowerCase().includes(q) : true));
  }, [conversations, debouncedSearch, currentUserId, excludeConversationId]);

  const toggleSelect = (id: string) => {
    haptics.select();
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  };

  const selectedIds = Object.keys(selected);

  const handleForward = async () => {
    if (!selectedIds.length || submitting) return;
    haptics.press();
    setSubmitting(true);
    try {
      await forwardChatMessage(
        messageId,
        selectedIds.slice(0, 5).map((id) => ({ conversationId: id }))
      );
      haptics.success();
      onForwarded?.();
      setSelected({});
      onClose();
    } catch {
      haptics.error();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.bottomSheet}>
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>
          <View style={styles.headerRowBetween}>
            <Text style={styles.sheetTitle}>Forward to…</Text>
            <Pressable hitSlop={12} onPress={onClose}>
              <Ionicons name="close" size={22} color={c.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={c.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search chats"
              placeholderTextColor={c.textMuted}
              style={styles.searchInput}
              autoCorrect={false}
            />
          </View>

          {isLoading ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={c.brand} />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(c: any) => String(c._id)}
              renderItem={({ item }: any) => {
                const checked = !!selected[item._id];
                const avatarUri = getS3ImageUrl(item._avatar) || null;
                return (
                  <Pressable
                    onPress={() => toggleSelect(item._id)}
                    style={({ pressed }) => [
                      styles.listRow,
                      pressed && styles.listRowPressed,
                    ]}
                  >
                    {avatarUri ? (
                      <Image source={{ uri: avatarUri }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarFallback]}>
                        <Text style={styles.avatarLetter}>
                          {(item._title?.[0] ?? "?").toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listTitle} numberOfLines={1}>
                        {item._title}
                      </Text>
                      {!!item.lastMessage && (
                        <Text style={styles.listSub} numberOfLines={1}>
                          {item.lastMessage}
                        </Text>
                      )}
                    </View>
                    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                      {checked ? (
                        <Ionicons name="checkmark" size={16} color={c.brandTextOn} />
                      ) : null}
                    </View>
                  </Pressable>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No chats match your search.</Text>
              }
              contentContainerStyle={{ paddingBottom: 80 }}
            />
          )}

          <Pressable
            disabled={!selectedIds.length || submitting}
            onPress={handleForward}
            style={[
              styles.sendBtn,
              (!selectedIds.length || submitting) && styles.sendBtnDisabled,
            ]}
          >
            <Ionicons name="paper-plane" size={16} color={c.brandTextOn} />
            <Text style={styles.sendLabel}>
              {submitting
                ? "Sending…"
                : selectedIds.length
                ? `Forward to ${selectedIds.length} chat${selectedIds.length === 1 ? "" : "s"}`
                : "Pick a chat"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
