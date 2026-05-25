/**
 * `InlineSavedIndicator` — small green "Saved ✓" badge that animates in
 * next to the field it confirms, then fades out after a beat.
 *
 * Why not a toast?
 *   - Toasts steal attention and pile up when the user flips multiple
 *     switches in a row. An inline indicator gives feedback exactly
 *     where the change happened and disappears on its own.
 *
 * Usage:
 *   <InlineSavedIndicator visible={savedKey === "notif.push"} />
 *
 * Pair with the {@link useInlineSaved} hook which manages a one-shot
 * key → visibility map and clears it after `clearAfterMs` (default 1800ms).
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useReduceMotion } from "../../lib/a11y";
import { space, typography, useThemeColors } from "../../theme";

export type InlineSavedIndicatorProps = {
  visible: boolean;
  /** Optional custom label — defaults to localised "Saved". */
  label?: string;
  /** Tone — `success` (default) or `error` for failed saves. */
  tone?: "success" | "error";
};

export function InlineSavedIndicator({
  visible,
  label,
  tone = "success",
}: InlineSavedIndicatorProps) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const reduceMotion = useReduceMotion();
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    if (!visible) {
      fade.setValue(0);
      slide.setValue(8);
      return;
    }
    if (reduceMotion) {
      fade.setValue(1);
      slide.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
    return () => {
      fade.stopAnimation();
      slide.stopAnimation();
    };
  }, [fade, reduceMotion, slide, visible]);

  if (!visible) return null;

  const isError = tone === "error";
  const text =
    label ??
    (isError
      ? t("inlineSaved.error", { defaultValue: "Couldn't save" })
      : t("inlineSaved.label", { defaultValue: "Saved" }));

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[
        styles.row,
        {
          backgroundColor: isError ? c.dangerSubtle : c.successSubtle,
          borderColor: isError ? c.danger : c.success,
          opacity: fade,
          transform: [{ translateX: slide }],
        },
      ]}
    >
      <Ionicons
        name={isError ? "alert-circle" : "checkmark-circle"}
        size={14}
        color={isError ? c.danger : c.success}
      />
      <Text
        style={[
          typography.caption,
          {
            color: isError ? c.dangerText ?? c.danger : c.successText ?? c.success,
            fontWeight: "600",
          },
        ]}
      >
        {text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: "flex-start",
    marginLeft: space.xs,
  },
});
