import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { haptics } from "../../../lib/haptics";
import { useThemeColors } from "../../../theme";
import {
  cancelScheduledMessage,
  listScheduledMessages,
  type ScheduledMessage,
} from "../api/chatActionsApi";
import { useChatOverlayStyles } from "../hooks/useChatOverlayStyles";

type Props = {
  visible: boolean;
  onClose: () => void;
  currentUserId: string;
};

/**
 * Lists every message the caller has queued for future delivery.
 * Cancel is one-tap with optimistic invalidation.
 */
export function ScheduledMessagesSheet({ visible, onClose, currentUserId }: Props) {
  const c = useThemeColors();
  const styles = useChatOverlayStyles();
  const queryClient = useQueryClient();
  const { data = [], isLoading, refetch } = useQuery({
    queryKey: queryKeys.chats.scheduled,
    queryFn: listScheduledMessages,
    enabled: visible,
    staleTime: 30_000,
  });

  const handleCancel = async (id: string) => {
    haptics.tap();
    try {
      await cancelScheduledMessage(id);
      queryClient.invalidateQueries({ queryKey: queryKeys.chats.scheduled });
      void refetch();
    } catch {
      haptics.error();
    }
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.bottomSheet, { maxHeight: "78%" }]}>
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>
          <View style={styles.headerRowBetween}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              <Ionicons name="time-outline" size={18} color={c.brand} />
              <Text style={styles.sheetTitle}>Scheduled messages</Text>
            </View>
            <Pressable hitSlop={12} onPress={onClose}>
              <Ionicons name="close" size={22} color={c.textSecondary} />
            </Pressable>
          </View>

          {isLoading ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={c.brand} />
          ) : (
            <FlatList
              data={data as ScheduledMessage[]}
              keyExtractor={(s) => String(s._id)}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => {
                const recipient =
                  item.conversationId?.isGroup
                    ? item.conversationId?.groupName ?? "Group"
                    : item.conversationId?.participants?.find(
                        (p: any) => String(p?._id) !== String(currentUserId)
                      )?.fullname ?? "Direct chat";
                return (
                  <View style={styles.scheduledRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.scheduledRecipient}>{recipient}</Text>
                      <Text style={styles.scheduledPreview} numberOfLines={2}>
                        {item.content || "[media]"}
                      </Text>
                      <Text style={styles.scheduledWhen}>
                        {new Date(item.scheduledFor).toLocaleString([], {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                    <Pressable
                      hitSlop={8}
                      style={styles.cancelChip}
                      onPress={() => handleCancel(item._id)}
                    >
                      <Ionicons name="close" size={16} color={c.danger} />
                      <Text style={styles.cancelChipLabel}>Cancel</Text>
                    </Pressable>
                  </View>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  No scheduled messages. Long-press the send button to schedule
                  one.
                </Text>
              }
              contentContainerStyle={{ paddingBottom: 24 }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
