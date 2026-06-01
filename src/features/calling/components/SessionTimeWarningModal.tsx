/**
 * SessionTimeWarningModal
 * ─────────────────────────────────────────────────────────────────────────────
 * Shown when the lesson timer crosses the 5-min and 2-min thresholds. The
 * 5-min variant is informational; the 2-min variant exposes an "Extend
 * session" CTA that opens the trainee `SessionExtensionModal`.
 *
 * Auto-dismisses after `autoDismissMs` so the trainer/trainee can keep
 * coaching without an extra tap. Trainee-only mounted in NativeMeetingScreen.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../../../components/ui";
import { colors, radii, space, typography } from "../../../theme";

export type SessionWarningKind = "five" | "two";

type Props = {
  visible: boolean;
  kind: SessionWarningKind;
  /** Trainer vs trainee copy for the 2-minute warning. */
  audience?: "trainer" | "trainee";
  /** Hide the modal after this many ms (defaults to 12s). 0 disables. */
  autoDismissMs?: number;
  /** Only the trainee sees the "Extend" CTA — pass true to render it. */
  canExtend: boolean;
  onExtend: () => void;
  /** Quick +10 min auto-charge from wallet path. Set when the trainee has enough wallet balance. */
  onQuickExtendTenMin?: () => void;
  quickExtendPrice?: number;
  quickExtendCurrency?: string;
  onDismiss: () => void;
};

const COPY: Record<
  SessionWarningKind,
  { title: string; body: string; icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  five: {
    title: "5 minutes left",
    body: "You have 5 minutes before this lesson ends.",
    icon: "time-outline",
    color: "#1e88e5",
  },
  two: {
    title: "2 minutes left",
    body: "Want a few more minutes? Ask your coach to extend the session.",
    icon: "alarm-outline",
    color: "#ff9800",
  },
};

const TRAINER_COPY: Partial<typeof COPY> = {
  two: {
    title: "2 minutes left",
    body: "Your trainee may request an extension. The timer will pause while payment is processed.",
    icon: "alarm-outline",
    color: "#ff9800",
  },
};

export function SessionTimeWarningModal({
  visible,
  kind,
  audience = "trainee",
  autoDismissMs = 12000,
  canExtend,
  onExtend,
  onQuickExtendTenMin,
  quickExtendPrice,
  quickExtendCurrency,
  onDismiss,
}: Props) {
  const insets = useSafeAreaInsets();
  const copy =
    audience === "trainer" && TRAINER_COPY[kind]
      ? TRAINER_COPY[kind]!
      : COPY[kind];

  useEffect(() => {
    if (!visible || !autoDismissMs) return;
    const id = setTimeout(() => onDismiss(), autoDismissMs);
    return () => clearTimeout(id);
  }, [visible, autoDismissMs, onDismiss]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={[styles.backdrop, { paddingBottom: insets.bottom + space.md }]}>
        <View style={styles.card}>
          <Pressable
            onPress={onDismiss}
            style={styles.closeBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>
          <View style={[styles.iconBubble, { backgroundColor: copy.color + "22" }]}>
            <Ionicons name={copy.icon} size={28} color={copy.color} />
          </View>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.body}</Text>

          {kind === "two" && canExtend ? (
            <View style={styles.actionStack}>
              {onQuickExtendTenMin ? (
                <Button
                  label={
                    quickExtendPrice
                      ? `+10 min · ${quickExtendCurrency ?? "$"}${quickExtendPrice.toFixed(0)} wallet`
                      : "+10 min · charge wallet"
                  }
                  leftIcon="flash"
                  onPress={onQuickExtendTenMin}
                  fullWidth
                />
              ) : null}
              <View style={styles.actionRow}>
                <Button label="Custom" onPress={onExtend} variant="secondary" fullWidth />
                <Button label="Not now" onPress={onDismiss} variant="ghost" fullWidth />
              </View>
            </View>
          ) : (
            <Pressable onPress={onDismiss} style={styles.dismissBtn}>
              <Text style={styles.dismissText}>Got it</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.overlay,
    paddingHorizontal: space.md,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.xl,
    padding: space.lg,
    alignItems: "center",
    gap: space.sm,
  },
  closeBtn: {
    position: "absolute",
    top: space.sm,
    right: space.sm,
    zIndex: 2,
    padding: 4,
  },
  iconBubble: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.xs,
  },
  title: { ...typography.titleSm, color: colors.text, textAlign: "center" },
  body: { ...typography.bodySm, color: colors.textMuted, textAlign: "center" },
  actionRow: {
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.sm,
    width: "100%",
  },
  actionStack: { width: "100%", gap: space.sm, marginTop: space.sm },
  dismissBtn: {
    marginTop: space.sm,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
  },
  dismissText: { ...typography.label, color: colors.text },
});
