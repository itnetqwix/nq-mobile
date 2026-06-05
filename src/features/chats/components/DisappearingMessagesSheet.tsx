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
import { useThemeColors } from "../../../theme";
import { setConversationDisappearingTtl } from "../api/chatActionsApi";
import { useChatOverlayStyles } from "../hooks/useChatOverlayStyles";

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
  const c = useThemeColors();
  const styles = useChatOverlayStyles();
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
        <View style={styles.bottomSheet}>
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>
          <View style={styles.headerRow}>
            <Ionicons name="timer-outline" size={20} color={c.brand} />
            <Text style={styles.sheetTitle}>Disappearing messages</Text>
          </View>
          <Text style={styles.sheetSubtitle}>
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
                  styles.optionRow,
                  idx !== OPTIONS.length - 1 && styles.optionRowBorder,
                  pressed && styles.rowPressed,
                ]}
              >
                <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                  {opt.label}
                </Text>
                {active ? (
                  <Ionicons name="checkmark" size={20} color={c.brand} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}
