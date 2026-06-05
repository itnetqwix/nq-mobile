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
import { useThemeColors } from "../../../theme";
import { useChatOverlayStyles } from "../hooks/useChatOverlayStyles";

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
  const c = useThemeColors();
  const styles = useChatOverlayStyles();
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
                    haptics.tap();
                    onReact(emoji);
                    onClose();
                  }}
                  style={[styles.reactionPill, active && styles.reactionPillActive]}
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
                  pressed && styles.actionRowPressed,
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
                  color={a.destructive ? c.danger : c.textSecondary}
                />
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
