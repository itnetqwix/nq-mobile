/**
 * `HelpBubble` — small "?" pill that surfaces a tooltip explaining a
 * confusing field (commission, hourly rate, slot length, etc.).
 *
 * Why a component instead of inline copy?
 *   - Many of these fields live in dense forms where adding another line
 *     of helper text bloats the layout. A tap target keeps the form tight
 *     while still giving the curious user an explanation.
 *   - Centralising the visual treatment means the same look + a11y label
 *     across every screen.
 *
 * Usage:
 *   <HelpBubble id="commission" topic={t("help.commission.topic")}>
 *     {t("help.commission.body")}
 *   </HelpBubble>
 *
 * The body is a React node so you can mix `<Text>` and bullets if needed.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { radii, space, typography, useThemeColors } from "../../theme";

export type HelpBubbleProps = {
  /** Stable id for analytics — not used for storage today. */
  id?: string;
  /** Title at the top of the popover. */
  topic: string;
  /** Body content — string or any React node. */
  children: React.ReactNode;
  /** Override the icon size (default 16). */
  size?: number;
  /** Tint of the bubble (defaults to brandAccent). */
  tint?: string;
  /** Optional accessibilityLabel — falls back to "Help · {topic}". */
  accessibilityLabel?: string;
};

export function HelpBubble({
  topic,
  children,
  size = 16,
  tint,
  accessibilityLabel,
}: HelpBubbleProps) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const [open, setOpen] = useState(false);

  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);

  const tone = tint ?? c.brandAccent;
  const hitSize = Math.max(size + 10, 28);

  return (
    <>
      <Pressable
        onPress={handleOpen}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={
          accessibilityLabel ??
          t("help.bubbleA11y", { defaultValue: "Help · {{topic}}", topic })
        }
        style={({ pressed }) => [
          {
            width: hitSize,
            height: hitSize,
            borderRadius: hitSize / 2,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <View
          style={[
            styles.bubble,
            {
              width: size + 6,
              height: size + 6,
              borderRadius: (size + 6) / 2,
              borderColor: tone,
            },
          ]}
        >
          <Ionicons name="help" size={Math.max(10, Math.round(size * 0.75))} color={tone} />
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={handleClose}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: c.overlay }]}
          onPress={handleClose}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.sheet,
              {
                backgroundColor: c.surfaceElevated,
                borderColor: c.border,
              },
            ]}
          >
            <View style={styles.header}>
              <View style={[styles.iconWrap, { backgroundColor: c.brandAccentSubtle }]}>
                <Ionicons name="help-circle" size={22} color={c.brandAccent} />
              </View>
              <Text style={[typography.titleSm, { color: c.text, flex: 1 }]}>{topic}</Text>
              <Pressable
                onPress={handleClose}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t("common.close", { defaultValue: "Close" })}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={20} color={c.textMuted} />
              </Pressable>
            </View>

            {typeof children === "string" ? (
              <Text style={[typography.bodySm, { color: c.textSecondary, marginTop: space.sm }]}>
                {children}
              </Text>
            ) : (
              <View style={{ marginTop: space.sm }}>{children}</View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bubble: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.md,
  },
  sheet: {
    width: "100%",
    maxWidth: 360,
    padding: space.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});
