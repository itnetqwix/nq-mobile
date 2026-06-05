import { Image } from "expo-image";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { brandImages } from "../../constants/images";
import { typography } from "../../theme";
import { SPLASH_BRAND_NAVY } from "./splashConstants";

const LOGO_W = 220;
const LOGO_H = 80;

type Props = {
  /** Overrides i18n `splash.preparing`. */
  message?: string;
};

/** Shared cold-start / session-restore screen — animated wordmark on brand navy. */
export function BrandBootScreen({ message }: Props) {
  const { t } = useTranslation();
  const statusText = message ?? t("splash.preparing", { defaultValue: "Loading" });
  const tagline = t("splash.tagline", { defaultValue: "Live coaching, anywhere" });

  const enter = useSharedValue(0);
  const breathe = useSharedValue(0);
  const shimmer = useSharedValue(0);
  const dot = useSharedValue(0);

  useEffect(() => {
    enter.value = withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) });
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      -1,
      false
    );
    dot.value = withDelay(
      200,
      withRepeat(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        -1,
        false
      )
    );
  }, [breathe, dot, enter, shimmer]);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: interpolate(enter.value, [0, 1], [0.96, 1]) }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breathe.value, [0, 1], [0.2, 0.55]),
    transform: [{ scale: interpolate(breathe.value, [0, 1], [0.9, 1.12]) }],
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breathe.value, [0, 1], [0.82, 1]),
    transform: [{ scale: interpolate(breathe.value, [0, 1], [0.98, 1.02]) }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(shimmer.value, [0, 1], [-LOGO_W * 0.5, LOGO_W * 0.9]) },
      { skewX: "-16deg" },
    ],
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0, 0.45, 0]),
  }));

  const dot0 = useAnimatedStyle(() => {
    const wave = dot.value % 1;
    return {
      opacity: interpolate(wave, [0, 0.35, 0.7, 1], [0.35, 1, 0.35, 0.35]),
      transform: [{ scale: interpolate(wave, [0, 0.35, 0.7, 1], [0.85, 1.15, 0.85, 0.85]) }],
    };
  });
  const dot1 = useAnimatedStyle(() => {
    const wave = (dot.value + 0.33) % 1;
    return {
      opacity: interpolate(wave, [0, 0.35, 0.7, 1], [0.35, 1, 0.35, 0.35]),
      transform: [{ scale: interpolate(wave, [0, 0.35, 0.7, 1], [0.85, 1.15, 0.85, 0.85]) }],
    };
  });
  const dot2 = useAnimatedStyle(() => {
    const wave = (dot.value + 0.66) % 1;
    return {
      opacity: interpolate(wave, [0, 0.35, 0.7, 1], [0.35, 1, 0.35, 0.35]),
      transform: [{ scale: interpolate(wave, [0, 0.35, 0.7, 1], [0.85, 1.15, 0.85, 0.85]) }],
    };
  });

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.stack, rootStyle]}>
        <View style={styles.logoStage}>
          <Animated.View style={[styles.glow, glowStyle]} />
          <View style={styles.logoClip}>
            <Animated.View style={logoStyle}>
              <Image
                source={brandImages.netqwixWordmark}
                style={styles.logo}
                contentFit="contain"
                accessibilityLabel="NetQwix"
              />
            </Animated.View>
            <Animated.View style={[styles.shimmer, shimmerStyle]} pointerEvents="none" />
          </View>
        </View>

        <Text style={styles.tagline}>{tagline}</Text>

        <View style={styles.dotsRow} accessibilityElementsHidden>
          <Animated.View style={[styles.dot, dot0]} />
          <Animated.View style={[styles.dot, dot1]} />
          <Animated.View style={[styles.dot, dot2]} />
        </View>

        <Text style={styles.status}>{statusText}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SPLASH_BRAND_NAVY,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  stack: {
    alignItems: "center",
    maxWidth: 320,
  },
  logoStage: {
    width: LOGO_W + 48,
    height: LOGO_H + 48,
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    width: LOGO_W + 64,
    height: LOGO_H + 64,
    borderRadius: (LOGO_H + 64) / 2,
    backgroundColor: "rgba(96, 165, 250, 0.35)",
  },
  logoClip: {
    width: LOGO_W,
    height: LOGO_H,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: LOGO_W,
    height: LOGO_H,
  },
  shimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: LOGO_W * 0.28,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderRadius: 8,
  },
  tagline: {
    ...typography.bodySm,
    color: "rgba(255,255,255,0.72)",
    marginTop: 20,
    textAlign: "center",
    letterSpacing: 0.4,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 28,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  status: {
    ...typography.caption,
    color: "rgba(255,255,255,0.5)",
    marginTop: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
});
