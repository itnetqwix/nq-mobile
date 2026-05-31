import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { fetchPinnedMessage, unpinChatMessage } from "../api/chatActionsApi";
import { haptics } from "../../../lib/haptics";
import {
  getPinnedMessageCollapsed,
  setPinnedMessageCollapsed,
} from "../lib/chatPinnedUiPrefs";
import { radii, space, typography, useThemedStyles, useThemeColors } from "../../../theme";

type Props = {
  conversationId: string;
  decryptText?: (raw: string) => string;
  onJump?: (messageId: string) => void;
};

export function PinnedMessageBanner({ conversationId, decryptText, onJump }: Props) {
  const c = useThemeColors();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);

  const { data } = useQuery({
    queryKey: queryKeys.chats.pinned(conversationId),
    queryFn: () => fetchPinnedMessage(conversationId),
    staleTime: 30_000,
  });

  useEffect(() => {
    void getPinnedMessageCollapsed(conversationId).then(setCollapsed);
  }, [conversationId]);

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
      ? "Photo"
      : m.type === "video"
      ? "Video"
      : m.type === "voice"
      ? "Voice note"
      : (raw || "Pinned message").slice(0, 200);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    void setPinnedMessageCollapsed(conversationId, next);
    haptics.tap();
  };

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
    <View style={[styles.shell, { backgroundColor: c.brandSubtle, borderColor: c.border }]}>
      <Pressable
        onPress={toggleCollapsed}
        style={styles.headerRow}
        accessibilityRole="button"
        accessibilityState={{ expanded: !collapsed }}
        accessibilityLabel={collapsed ? "Expand pinned message" : "Collapse pinned message"}
      >
        <View style={[styles.pinBadge, { backgroundColor: c.brandNavy }]}>
          <Ionicons name="pin" size={12} color={c.brandTextOn} />
        </View>
        <Text style={[styles.headerLabel, { color: c.brandNavy }]}>Pinned message</Text>
        <View style={{ flex: 1 }} />
        <Pressable
          hitSlop={8}
          onPress={() => onJump?.(String(m._id))}
          style={styles.jumpChip}
          accessibilityLabel="View pinned message"
        >
          <Text style={[styles.jumpText, { color: c.brandNavy }]}>View</Text>
          <Ionicons name="chevron-forward" size={12} color={c.brandNavy} />
        </Pressable>
        <Pressable hitSlop={8} onPress={handleUnpin} accessibilityLabel="Unpin message">
          <Ionicons name="close-circle" size={18} color={c.textMuted} />
        </Pressable>
        <Ionicons
          name={collapsed ? "chevron-down" : "chevron-up"}
          size={16}
          color={c.textMuted}
        />
      </Pressable>

      {!collapsed ? (
        <Pressable
          onPress={() => onJump?.(String(m._id))}
          style={({ pressed }) => [styles.body, pressed && { opacity: 0.92 }]}
        >
          <Text style={[styles.preview, { color: c.text }]} numberOfLines={3}>
            {previewText}
          </Text>
        </Pressable>
      ) : (
        <Text style={[styles.collapsedHint, { color: c.textMuted }]} numberOfLines={1}>
          {previewText}
        </Text>
      )}
    </View>
  );
}

function useStyles() {
  return useThemedStyles(() =>
    StyleSheet.create({
      shell: {
        marginHorizontal: space.md,
        marginTop: space.xs,
        marginBottom: space.xs,
        borderRadius: radii.md,
        borderWidth: 1,
        overflow: "hidden",
      },
      headerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: space.sm,
        paddingVertical: 8,
      },
      pinBadge: {
        width: 22,
        height: 22,
        borderRadius: 6,
        alignItems: "center",
        justifyContent: "center",
      },
      headerLabel: {
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 0.5,
        textTransform: "uppercase",
      },
      jumpChip: { flexDirection: "row", alignItems: "center", gap: 2 },
      jumpText: { fontSize: 12, fontWeight: "700" },
      body: {
        paddingHorizontal: space.sm,
        paddingBottom: space.sm,
        paddingTop: 0,
      },
      preview: { ...typography.bodySm, lineHeight: 20 },
      collapsedHint: {
        ...typography.caption,
        paddingHorizontal: space.sm,
        paddingBottom: 8,
        fontWeight: "600",
      },
    })
  );
}
