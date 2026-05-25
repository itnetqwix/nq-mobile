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
import {
  cancelScheduledMessage,
  listScheduledMessages,
  type ScheduledMessage,
} from "../api/chatActionsApi";

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
        <View style={styles.sheet}>
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>
          <View style={styles.headerRow}>
            <Ionicons name="time-outline" size={18} color="#2563EB" />
            <Text style={styles.title}>Scheduled messages</Text>
            <Pressable hitSlop={12} onPress={onClose}>
              <Ionicons name="close" size={22} color="#374151" />
            </Pressable>
          </View>

          {isLoading ? (
            <ActivityIndicator style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              data={data as ScheduledMessage[]}
              keyExtractor={(s) => String(s._id)}
              ItemSeparatorComponent={() => <View style={styles.sep} />}
              renderItem={({ item }) => {
                const recipient =
                  item.conversationId?.isGroup
                    ? item.conversationId?.groupName ?? "Group"
                    : item.conversationId?.participants?.find(
                        (p: any) => String(p?._id) !== String(currentUserId)
                      )?.fullname ?? "Direct chat";
                return (
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recipient}>{recipient}</Text>
                      <Text style={styles.preview} numberOfLines={2}>
                        {item.content || "[media]"}
                      </Text>
                      <Text style={styles.when}>
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
                      style={styles.cancelBtn}
                      onPress={() => handleCancel(item._id)}
                    >
                      <Ionicons name="close" size={16} color="#EF4444" />
                      <Text style={styles.cancelLabel}>Cancel</Text>
                    </Pressable>
                  </View>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.empty}>
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
    paddingTop: 4,
    paddingBottom: 24,
    maxHeight: "78%",
  },
  handleRow: { alignItems: "center", paddingTop: 8, paddingBottom: 4 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#D1D5DB" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 8,
  },
  title: { flex: 1, fontSize: 16, fontWeight: "700", color: "#111827" },
  row: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    paddingVertical: 12,
  },
  recipient: { fontSize: 14, fontWeight: "700", color: "#111827" },
  preview: { fontSize: 13, color: "#374151", marginTop: 2 },
  when: { fontSize: 12, color: "#6B7280", marginTop: 4 },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
  },
  cancelLabel: { fontSize: 12, color: "#EF4444", fontWeight: "700" },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: "#F3F4F6" },
  empty: { color: "#6B7280", textAlign: "center", paddingVertical: 24 },
});
