import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { haptics } from "../../../lib/haptics";
import { setConversationDisappearingTtl } from "../api/chatActionsApi";

type Option = { label: string; minutes: number };

const OPTIONS: Option[] = [
  { label: "Off", minutes: 0 },
  { label: "5 minutes", minutes: 5 },
  { label: "1 hour", minutes: 60 },
  { label: "24 hours", minutes: 60 * 24 },
  { label: "7 days", minutes: 60 * 24 * 7 },
  { label: "30 days", minutes: 60 * 24 * 30 },
];

type Props = {
  visible: boolean;
  conversationId: string;
  currentMinutes: number;
  onClose: () => void;
  onChanged?: (minutes: number) => void;
};

/**
 * Small bottom sheet that lets either participant set a TTL on new
 * messages in the conversation. The choices roughly mirror WhatsApp's
 * disappearing-messages timer.
 */
export function DisappearingMessagesSheet({
  visible,
  conversationId,
  currentMinutes,
  onClose,
  onChanged,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<number>(currentMinutes ?? 0);

  React.useEffect(() => {
    setSelected(currentMinutes ?? 0);
  }, [currentMinutes, visible]);

  const apply = async (minutes: number) => {
    if (saving) return;
    haptics.select();
    setSaving(true);
    try {
      await setConversationDisappearingTtl(conversationId, minutes);
      setSelected(minutes);
      haptics.success();
      onChanged?.(minutes);
      onClose();
    } catch {
      haptics.error();
    } finally {
      setSaving(false);
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
            <Ionicons name="timer-outline" size={20} color="#2563EB" />
            <Text style={styles.title}>Disappearing messages</Text>
          </View>
          <Text style={styles.subtitle}>
            New messages will be deleted after the timer ends. This
            doesn't remove existing messages.
          </Text>
          {OPTIONS.map((opt, idx) => {
            const active = selected === opt.minutes;
            return (
              <Pressable
                key={opt.minutes}
                onPress={() => apply(opt.minutes)}
                disabled={saving}
                style={({ pressed }) => [
                  styles.row,
                  idx !== OPTIONS.length - 1 && styles.rowBorder,
                  pressed && { backgroundColor: "rgba(0,0,0,0.04)" },
                ]}
              >
                <Text style={[styles.label, active && styles.labelActive]}>
                  {opt.label}
                </Text>
                {active ? (
                  <Ionicons name="checkmark" size={20} color="#2563EB" />
                ) : null}
              </Pressable>
            );
          })}
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
    paddingBottom: 26,
  },
  handleRow: { alignItems: "center", paddingTop: 8, paddingBottom: 4 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#D1D5DB" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 6,
  },
  title: { fontSize: 17, fontWeight: "700", color: "#111827" },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 6,
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  label: { fontSize: 16, color: "#111827" },
  labelActive: { color: "#2563EB", fontWeight: "700" },
});
