import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { haptics } from "../../../lib/haptics";

/**
 * Centralised long-press action sheet for chat bubbles.
 *
 * Renders a small floating bar of quick emoji reactions on top, then
 * a vertical list of contextual actions (Reply / Forward / Pin / Copy /
 * Edit / Delete / Report …) — feels close to iMessage / Telegram while
 * staying fully cross-platform with React Native primitives.
 */

const REACTION_EMOJIS = ["👍", "❤️", "😂", "🎉", "🙏", "🔥"] as const;

export type MessageActionId =
  | "reply"
  | "forward"
  | "copy"
  | "pin"
  | "unpin"
  | "edit"
  | "delete"
  | "report"
  | "transcribe";

export type MessageAction = {
  id: MessageActionId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  actions: MessageAction[];
  onReact: (emoji: string) => void;
  currentReaction?: string | null;
};

export function MessageActionsSheet({
  visible,
  onClose,
  actions,
  onReact,
  currentReaction,
}: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(slide, {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fade.setValue(0);
      slide.setValue(40);
    }
  }, [visible, fade, slide]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheetWrap,
            { transform: [{ translateY: slide }] },
          ]}
        >
          <View style={styles.reactionsRow}>
            {REACTION_EMOJIS.map((emoji) => {
              const active = currentReaction === emoji;
              return (
                <Pressable
                  key={emoji}
                  onPress={() => {
                    haptics.select();
                    onReact(emoji);
                  }}
                  style={({ pressed }) => [
                    styles.reactionPill,
                    active && styles.reactionPillActive,
                    pressed && { transform: [{ scale: 1.18 }] },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`React with ${emoji}`}
                >
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.actionsCard}>
            {actions.map((a, idx) => (
              <Pressable
                key={a.id}
                onPress={() => {
                  haptics.tap();
                  a.onPress();
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.actionRow,
                  idx !== actions.length - 1 && styles.actionRowBorder,
                  pressed && { backgroundColor: "rgba(0,0,0,0.04)" },
                ]}
              >
                <Text
                  style={[
                    styles.actionLabel,
                    a.destructive && styles.actionLabelDestructive,
                  ]}
                >
                  {a.label}
                </Text>
                <Ionicons
                  name={a.icon}
                  size={20}
                  color={a.destructive ? "#EF4444" : "#374151"}
                />
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheetWrap: {
    paddingHorizontal: 14,
    paddingBottom: 36,
    gap: 12,
  },
  reactionsRow: {
    flexDirection: "row",
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 999,
    gap: 4,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  reactionPill: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  reactionPillActive: {
    backgroundColor: "#E0F2FE",
  },
  reactionEmoji: {
    fontSize: 24,
  },
  actionsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  actionRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#111827",
  },
  actionLabelDestructive: {
    color: "#EF4444",
  },
});
