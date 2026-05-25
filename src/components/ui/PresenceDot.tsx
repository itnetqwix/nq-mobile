/**
 * PresenceDot — colour-blind-safe online/offline indicator.
 *
 * Why not just a green/red circle?
 *   Roughly 8 % of men have red-green colour deficiency; a pure-colour dot
 *   is invisible to them. We pair the colour with a glyph (check/dash/dot)
 *   so the state is conveyed by *shape* as well as hue, and expose the
 *   semantic state to screen readers.
 *
 * Usage:
 *   <PresenceDot online size={10} />
 *   <PresenceDot state="away" size={12} ring />
 *
 * The component is purely visual — when paired with text like "Online"
 * the icon is redundant and you can opt out with `hideIcon`.
 */

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useThemeColors } from "../../theme";

export type PresenceState = "online" | "offline" | "away";

export type PresenceDotProps = {
  /** Shorthand: `online={true}` → "online", omit / false → "offline". */
  online?: boolean;
  /** Tri-state — overrides `online`. */
  state?: PresenceState;
  /** Outer ring colour (defaults to surfaceElevated). */
  ringColor?: string;
  /** Pixel size of the indicator (default 10). */
  size?: number;
  /** Render the inset glyph (default true). When the dot is decorative-only
   *  next to descriptive text, set this to `false`. */
  hideIcon?: boolean;
  /** Adds a 2px ring so the indicator pops against avatars. */
  ring?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Override the accessibility label (e.g. "Online — last seen 2m ago"). */
  accessibilityLabel?: string;
};

export function PresenceDot({
  online,
  state,
  ringColor,
  size = 10,
  hideIcon = false,
  ring = false,
  style,
  accessibilityLabel,
}: PresenceDotProps) {
  const c = useThemeColors();
  const resolved: PresenceState =
    state ?? (online === true ? "online" : online === false ? "offline" : "offline");

  const palette: Record<PresenceState, { bg: string; iconName: keyof typeof Ionicons.glyphMap }> = {
    online: { bg: c.success, iconName: "checkmark" },
    away: { bg: c.warning, iconName: "remove" },
    offline: { bg: c.iconMuted, iconName: "ellipse-outline" },
  };
  const { bg, iconName } = palette[resolved];

  /**
   * For small dot sizes (< 12px) the glyph would render at sub-pixel widths
   * which looks blurry — fall back to a solid colour + shape (a ring for
   * offline) so the silhouette alone still conveys the state.
   */
  const showInsetIcon = !hideIcon && size >= 12;

  const dotStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: resolved === "offline" && !showInsetIcon ? "transparent" : bg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: resolved === "offline" && !showInsetIcon ? Math.max(1.5, size * 0.18) : ring ? 2 : 0,
    borderColor:
      resolved === "offline" && !showInsetIcon
        ? bg
        : ring
        ? ringColor ?? c.surfaceElevated
        : "transparent",
  };

  return (
    <View
      style={[dotStyle, style]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? accessibilityFromState(resolved)}
    >
      {showInsetIcon ? (
        <Ionicons name={iconName} size={Math.round(size * 0.7)} color="#fff" />
      ) : null}
    </View>
  );
}

function accessibilityFromState(state: PresenceState): string {
  switch (state) {
    case "online":
      return "Online";
    case "away":
      return "Away";
    case "offline":
    default:
      return "Offline";
  }
}

const _unused = StyleSheet.create({ _: {} });
void _unused;
