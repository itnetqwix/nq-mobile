import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { fetchPinnedMessage, unpinChatMessage } from "../api/chatActionsApi";
import { haptics } from "../../../lib/haptics";

type Props = {
  conversationId: string;
  /** Optional decryptor to render E2E pin previews in plain text. */
  decryptText?: (raw: string) => string;
  onJump?: (messageId: string) => void;
};

/**
 * The one pin slot that lives above a conversation. We poll a little
 * less aggressively than messages — the pin rarely changes — and rely
 * on the socket `CHAT_PINNED` event to invalidate this query.
 */
export function PinnedMessageBanner({ conversationId, decryptText, onJump }: Props) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: queryKeys.chats.pinned(conversationId),
    queryFn: () => fetchPinnedMessage(conversationId),
    staleTime: 30_000,
  });

  if (!data?.message) return null;

  const m = data.message;
  const raw =
    typeof m.content === "string" && m.content
      ? decryptText
        ? decryptText(m.content)
        : m.content
      : null;
  const previewText =
    m.type === "image"
      ? "📷 Photo"
      : m.type === "video"
      ? "🎬 Video"
      : m.type === "voice"
      ? "🎤 Voice note"
      : (raw || "Pinned message").slice(0, 120);

  const handleUnpin = async () => {
    haptics.tap();
    try {
      await unpinChatMessage(conversationId);
      queryClient.invalidateQueries({ queryKey: queryKeys.chats.pinned(conversationId) });
    } catch {
      haptics.error();
    }
  };

  return (
    <Pressable
      onPress={() => onJump?.(String(m._id))}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: "rgba(0,0,0,0.04)" },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Pinned message: ${previewText}`}
    >
      <View style={styles.indicatorBar} />
      <Ionicons name="pin" size={13} color="#2563EB" style={styles.pinIcon} />
      <Text style={styles.preview} numberOfLines={1}>
        {previewText}
      </Text>
      <Pressable
        hitSlop={10}
        onPress={() => onJump?.(String(m._id))}
        style={styles.viewBtn}
      >
        <Ionicons name="chevron-forward" size={14} color="#2563EB" />
        <Text style={styles.viewBtnText}>View</Text>
      </Pressable>
      <Pressable hitSlop={10} onPress={handleUnpin} style={styles.unpinBtn}>
        <Ionicons name="close" size={14} color="#6B7280" />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Compact single-line banner, ~36 px tall. Pin icon + preview + View
  // affordance + unpin X all on one line so it doesn't crowd the chat.
  row: {
    flexDirection: "row",
    alignItems: "center",
    height: 36,
    paddingRight: 8,
    paddingLeft: 0,
    backgroundColor: "#EFF6FF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#DBEAFE",
    gap: 8,
  },
  indicatorBar: {
    width: 3,
    height: 24,
    backgroundColor: "#2563EB",
    marginLeft: 12,
    borderRadius: 2,
  },
  pinIcon: { marginRight: 2 },
  preview: { flex: 1, fontSize: 13, color: "#1F2937" },
  viewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  viewBtnText: { color: "#2563EB", fontSize: 12, fontWeight: "700" },
  unpinBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.6)",
  },
});
