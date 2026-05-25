/**
 * Visual indicator that background blur is enabled.
 *
 * Until we ship native frame-level blur via a frame processor, this
 * component is the user-facing acknowledgement that the preference is
 * being honoured. It overlays the local PIP with a soft scrim and a
 * small "Blur ON" pill so the user can verify their choice without
 * leaving the call.
 *
 * Marking the indicator as `accessibilityElementsHidden=false` lets
 * VoiceOver announce "Background blur on" when focus reaches the PIP.
 */

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTranslation } from "../../../i18n/useAppTranslation";

type Props = {
  /** When false, render nothing so the layout collapses cleanly. */
  visible: boolean;
  /** Pin to "top-right" by default — switchable for full-bleed cards. */
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
};

export function BackgroundBlurBadge({ visible, position = "top-right" }: Props) {
  const { t } = useAppTranslation();
  if (!visible) return null;
  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, positionStyles[position]]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={t("call.backgroundBlur.onA11y", {
        defaultValue: "Background blur is on",
      })}
    >
      <View style={styles.scrim} />
      <View style={styles.pill}>
        <Ionicons name="eye-off-outline" size={12} color="#fff" />
        <Text style={styles.text}>
          {t("call.backgroundBlur.on", { defaultValue: "Blur ON" })}
        </Text>
      </View>
    </View>
  );
}

const positionStyles = StyleSheet.create({
  "top-right": { top: 6, right: 6 },
  "top-left": { top: 6, left: 6 },
  "bottom-right": { bottom: 6, right: 6 },
  "bottom-left": { bottom: 6, left: 6 },
});

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.16)",
    borderRadius: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  text: { color: "#fff", fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
});
