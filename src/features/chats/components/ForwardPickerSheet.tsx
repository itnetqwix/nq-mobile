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
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { haptics } from "../../../lib/haptics";
import { forwardChatMessage } from "../api/chatActionsApi";

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
  const [selected, setSelected] = useState<Record<string, true>>({});
  const [search, setSearch] = useState("");
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
    const q = search.trim().toLowerCase();
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
  }, [conversations, search, currentUserId, excludeConversationId]);

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
        <View style={styles.sheet}>
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Forward to…</Text>
            <Pressable hitSlop={12} onPress={onClose}>
              <Ionicons name="close" size={22} color="#374151" />
            </Pressable>
          </View>

          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#9CA3AF" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search chats"
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
              autoCorrect={false}
            />
          </View>

          {isLoading ? (
            <ActivityIndicator style={{ marginTop: 24 }} />
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
                      styles.row,
                      pressed && { backgroundColor: "rgba(0,0,0,0.03)" },
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
                      <Text style={styles.name} numberOfLines={1}>
                        {item._title}
                      </Text>
                      {!!item.lastMessage && (
                        <Text style={styles.preview} numberOfLines={1}>
                          {item.lastMessage}
                        </Text>
                      )}
                    </View>
                    <View
                      style={[
                        styles.checkbox,
                        checked && styles.checkboxChecked,
                      ]}
                    >
                      {checked ? (
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      ) : null}
                    </View>
                  </Pressable>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.sep} />}
              ListEmptyComponent={
                <Text style={styles.empty}>No chats match your search.</Text>
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
            <Ionicons name="paper-plane" size={16} color="#FFFFFF" />
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

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingBottom: 24,
    maxHeight: "82%",
  },
  handleRow: { alignItems: "center", paddingTop: 8, paddingBottom: 4 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#D1D5DB" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
  },
  title: { fontSize: 18, fontWeight: "700", color: "#111827" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 15, color: "#111827", padding: 0 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E5E7EB",
  },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarLetter: { color: "#374151", fontWeight: "700", fontSize: 16 },
  name: { fontSize: 15, fontWeight: "600", color: "#111827" },
  preview: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: "#E5E7EB" },
  empty: { textAlign: "center", color: "#6B7280", marginTop: 16 },
  sendBtn: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 14,
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  sendBtnDisabled: { backgroundColor: "#94A3B8" },
  sendLabel: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
});
