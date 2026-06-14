import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { brandImages } from "../../constants/images";
import { Image } from "expo-image";

type Props = {
  /** Shown under the spinner (omit for compact inline use). */
  message?: string;
  size?: "compact" | "full";
  /** Light spinner only — no logo or ring (clips / in-call video). */
  variant?: "branded" | "minimal";
  style?: ViewStyle;
};

/**
 * Branded loading surface for locker/chat media; use `variant="minimal"` for clips.
 */
export function MediaLoadingOverlay({
  message = "Loading",
  size = "full",
  variant = "branded",
  style,
}: Props) {
  if (variant === "minimal") {
    return (
      <View style={[styles.overlayMinimal, style]} pointerEvents="none">
        <ActivityIndicator size="small" color="#e2e8f0" />
        {message ? (
          <Text style={styles.minimalLabel} numberOfLines={1}>
            {message}
          </Text>
        ) : null}
      </View>
    );
  }

  const spin = useRef(new Animated.Value(0)).current;
  const compact = size === "compact";

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={[styles.overlay, style]} pointerEvents="none">
      <View style={[styles.card, compact && styles.cardCompact]}>
        <Animated.View style={[styles.ring, { transform: [{ rotate }] }]}>
          <View style={styles.ringTrack} />
          <View style={styles.ringArc} />
        </Animated.View>
        {!compact ? (
          <Image
            source={brandImages.netqwixMark}
            style={styles.mark}
            contentFit="contain"
          />
        ) : null}
        {message && message.length > 0 ? (
          <Text style={[styles.label, compact && styles.labelCompact]} numberOfLines={1}>
            {message}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayMinimal: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.42)",
    gap: 8,
  },
  minimalLabel: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 12,
    fontWeight: "600",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8,12,28,0.55)",
  },
  card: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,80,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    minWidth: 132,
  },
  cardCompact: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    minWidth: 0,
    gap: 0,
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  ring: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  ringTrack: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.18)",
  },
  ringArc: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: "transparent",
    borderTopColor: "#fff",
    borderRightColor: "rgba(255,255,255,0.5)",
  },
  mark: {
    position: "absolute",
    width: 22,
    height: 22,
  },
  label: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  labelCompact: {
    fontSize: 11,
  },
});
