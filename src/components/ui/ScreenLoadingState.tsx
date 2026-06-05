/**
 * Unified loading surface — prefer content-shaped skeletons; fall back to
 * branded loader or spinner only when no layout mirror exists yet.
 */

import React from "react";
import { ActivityIndicator, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { NetQwixLoader } from "../brand/NetQwixLoader";
import { space, typography, useThemeColors } from "../../theme";
import { SkeletonGroup } from "./ContentSkeletons";

export type ScreenLoadingVariant = "skeleton" | "inline" | "fullscreen" | "spinner";

export type ScreenLoadingStateProps = {
  variant?: ScreenLoadingVariant;
  /** Custom skeleton node — overrides default `SkeletonGroup`. */
  skeleton?: React.ReactNode;
  skeletonCount?: number;
  message?: string;
  /** Rotating tips under the branded loader (session restore, long fetches). */
  showTips?: boolean;
  style?: ViewStyle;
};

export function ScreenLoadingState({
  variant = "skeleton",
  skeleton,
  skeletonCount = 4,
  message,
  showTips = false,
  style,
}: ScreenLoadingStateProps) {
  const c = useThemeColors();

  if (variant === "fullscreen") {
    return (
      <View style={[styles.fullscreen, { backgroundColor: c.background }, style]}>
        <NetQwixLoader
          variant="fullscreen"
          motion="quick"
          backdrop="solid"
          message={message}
          showTips={showTips}
        />
      </View>
    );
  }

  if (variant === "skeleton") {
    return (
      <View style={[styles.block, style]} accessibilityLabel={message ?? "Loading"}>
        {skeleton ?? <SkeletonGroup count={skeletonCount} />}
      </View>
    );
  }

  return (
    <View style={[styles.inline, style]}>
      <ActivityIndicator size="small" color={c.brandAccent} />
      {message ? (
        <Text style={[styles.message, { color: c.textMuted }]}>{message}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fullscreen: {
    flex: 1,
  },
  block: { paddingVertical: space.sm },
  inline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    padding: space.md,
  },
  message: { ...typography.bodySm, textAlign: "center" },
});
