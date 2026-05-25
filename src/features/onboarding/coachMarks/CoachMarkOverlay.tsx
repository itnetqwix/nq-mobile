/**
 * Renders the single active coach mark as an absolutely-positioned tooltip
 * with a leading icon, body, action row, and a small triangular arrow that
 * points to the anchor view. Tapping outside or hitting the close icon
 * persists the "seen" state.
 *
 * The overlay sits at the very top of the navigation tree (mounted in
 * `RootNavigator`) so it always wins z-order even when a screen pushes a
 * full-screen modal.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { radii, space, typography, useThemeColors } from "../../../theme";
import { useCoachMarkContext, type CoachMarkAnchor } from "./CoachMarkProvider";
import { useTranslation } from "react-i18next";

const TOOLTIP_MAX_WIDTH = 320;
const ARROW = 10; // px — half-width of the pointer triangle
const EDGE_PADDING = 12;

type Layout = {
  top: number;
  left: number;
  width: number;
  arrowLeft: number;
  arrowOnTop: boolean;
};

function computeLayout(anchor: CoachMarkAnchor, preferred: "top" | "bottom" | "auto"): Layout {
  const screen = Dimensions.get("window");
  const width = Math.min(TOOLTIP_MAX_WIDTH, screen.width - EDGE_PADDING * 2);

  /** Centre horizontally on the anchor, then clamp to the screen. */
  const centerX = anchor.x + anchor.width / 2;
  let left = centerX - width / 2;
  if (left < EDGE_PADDING) left = EDGE_PADDING;
  if (left + width > screen.width - EDGE_PADDING) left = screen.width - EDGE_PADDING - width;

  /** Pointer sits over the *anchor centre* even when the tooltip got clamped. */
  const arrowLeft = Math.max(ARROW * 2, Math.min(width - ARROW * 2, centerX - left));

  const spaceBelow = screen.height - (anchor.y + anchor.height);
  const spaceAbove = anchor.y;
  const wantsTop =
    preferred === "top" ||
    (preferred === "auto" && spaceAbove > spaceBelow && spaceAbove > 220);

  let top: number;
  let arrowOnTop: boolean;
  if (wantsTop) {
    top = Math.max(StatusBar.currentHeight ?? 40, anchor.y - 12 - 180);
    arrowOnTop = false;
  } else {
    top = anchor.y + anchor.height + 12;
    arrowOnTop = true;
  }
  return { top, left, width, arrowLeft, arrowOnTop };
}

export function CoachMarkOverlay() {
  const { t } = useTranslation();
  const { active, dismiss } = useCoachMarkContext();
  const c = useThemeColors();

  const layout = useMemo(
    () => (active ? computeLayout(active.anchor, active.placement ?? "auto") : null),
    [active]
  );

  if (!active || !layout) return null;

  const onPrimary = () => {
    active.cta?.onPress();
    dismiss();
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      {/* Backdrop — tapping anywhere outside dismisses the hint without
          triggering the underlying button. */}
      <Pressable style={styles.backdrop} onPress={dismiss} accessibilityLabel={t("coachMark.dismiss", { defaultValue: "Dismiss hint" })}>
        {/* Anchor halo — a soft brand-tinted ring that draws the eye to
            the actual target. We use a transparent border + outer shadow so
            it sits clearly on both light and dark backgrounds. */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: active.anchor.y - 6,
            left: active.anchor.x - 6,
            width: active.anchor.width + 12,
            height: active.anchor.height + 12,
            borderRadius: radii.md,
            borderWidth: 3,
            borderColor: c.brandAccent,
          }}
        />

        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[
            styles.tooltip,
            {
              top: layout.top,
              left: layout.left,
              width: layout.width,
              backgroundColor: c.surfaceElevated,
              borderColor: c.border,
            },
          ]}
        >
          {/* Arrow */}
          <View
            pointerEvents="none"
            style={[
              styles.arrowOuter,
              layout.arrowOnTop
                ? { top: -ARROW, borderBottomColor: c.surfaceElevated }
                : { bottom: -ARROW, borderTopColor: c.surfaceElevated },
              { left: layout.arrowLeft - ARROW },
            ]}
          />

          <View style={styles.header}>
            {active.icon ? (
              <View style={[styles.iconWrap, { backgroundColor: c.brandAccentSubtle }]}>
                <Ionicons
                  name={active.icon as keyof typeof Ionicons.glyphMap}
                  size={20}
                  color={c.brandAccent}
                />
              </View>
            ) : null}
            <Text style={[typography.titleSm, { color: c.text, flex: 1 }]} numberOfLines={2}>
              {active.title}
            </Text>
            <Pressable
              onPress={dismiss}
              accessibilityRole="button"
              accessibilityLabel={t("coachMark.gotIt", { defaultValue: "Got it" })}
              hitSlop={10}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={18} color={c.textMuted} />
            </Pressable>
          </View>

          <Text style={[typography.bodySm, { color: c.textSecondary, marginTop: space.xs }]}>
            {active.description}
          </Text>

          <View style={styles.footer}>
            {active.cta ? (
              <Pressable
                accessibilityRole="button"
                onPress={onPrimary}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: c.brandAccent, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[typography.button, { color: "#fff" }]}>{active.cta.label}</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("coachMark.gotIt", { defaultValue: "Got it" })}
              onPress={dismiss}
              style={styles.dismissBtn}
            >
              <Text style={[typography.button, { color: c.textSecondary }]}>
                {t("coachMark.gotIt", { defaultValue: "Got it" })}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  tooltip: {
    position: "absolute",
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: space.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 16,
  },
  arrowOuter: {
    position: "absolute",
    width: 0,
    height: 0,
    borderLeftWidth: ARROW,
    borderRightWidth: ARROW,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomWidth: ARROW,
    borderTopWidth: ARROW,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.md,
  },
  primaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.md,
  },
  dismissBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: "auto",
  },
});
