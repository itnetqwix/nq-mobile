import React, { useEffect } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
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
import { brandImages } from "../../constants/images";
import { space, typography, useTheme, useThemedStyles } from "../../theme";
import { LoaderTipCarousel } from "./loaderTips/LoaderTipCarousel";

export type NetQwixLoaderVariant = "fullscreen" | "inline" | "overlay";
export type NetQwixLoaderBackdrop = "transparent" | "scrim" | "solid";

type Props = {
  message?: string;
  variant?: NetQwixLoaderVariant;
  size?: "sm" | "md" | "lg";
  /** `quick` — shorter entrance / breathe (session restore, overlays). */
  motion?: "full" | "quick";
  /** `scrim` — frosted translucent overlay (default). `transparent` — no fill. */
  backdrop?: NetQwixLoaderBackdrop;
  /** Rotating sports tips at the bottom (session / sign-in). */
  showTips?: boolean;
  style?: ViewStyle;
};

const SIZES = { sm: 64, md: 92, lg: 120 } as const;
const LOGO_ASPECT = 0.36;

export function NetQwixLoader({
  message = "Loading",
  variant = "fullscreen",
  size = "md",
  motion = "full",
  backdrop = "scrim",
  showTips = false,
  style,
}: Props) {
  const quick = motion === "quick";
  const { scheme } = useTheme();
  const isDark = scheme === "dark";
  const stage = SIZES[size];
  const logoW = stage;
  const logoH = stage * LOGO_ASPECT;
  const useScrim = backdrop === "scrim" && variant !== "inline";
  const scrimColor = isDark ? "rgba(15,23,42,0.62)" : "rgba(255,255,255,0.55)";

  const breathe = useSharedValue(0);
  const shimmer = useSharedValue(0);
  const enter = useSharedValue(0);
  const msgFade = useSharedValue(0);

  const styles = useThemedStyles((palette) =>
    StyleSheet.create({
      fullscreen: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: backdrop === "solid" ? palette.background : "transparent",
        paddingHorizontal: space.xl,
      },
      inline: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: space.xl,
        backgroundColor: "transparent",
      },
      overlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor:
          backdrop === "solid"
            ? `${palette.background}E8`
            : backdrop === "scrim"
              ? scrimColor
              : "transparent",
        zIndex: 999,
      },
      scrim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: scrimColor,
      },
      glassCard: {
        paddingHorizontal: space.xl,
        paddingVertical: space.lg,
        borderRadius: 24,
        backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.72)",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.08)",
        alignItems: "center",
        shadowColor: palette.brandNavy,
        shadowOpacity: isDark ? 0.35 : 0.12,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
      },
      stage: {
        width: logoW + 48,
        height: logoH + 48,
        alignItems: "center",
        justifyContent: "center",
      },
      glow: {
        position: "absolute",
        width: logoW + 56,
        height: logoH + 56,
        borderRadius: (logoH + 56) / 2,
        backgroundColor: palette.brandSubtle,
      },
      glowAccent: {
        position: "absolute",
        width: logoW + 28,
        height: logoH + 28,
        borderRadius: (logoH + 28) / 2,
        backgroundColor: palette.brandAccent,
        opacity: 0.12,
      },
      logoClip: {
        width: logoW,
        height: logoH,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
      },
      logoGhost: {
        position: "absolute",
        width: logoW * 1.08,
        height: logoH * 1.08,
        opacity: 0.22,
      },
      logo: {
        width: logoW,
        height: logoH,
      },
      shimmerBar: {
        position: "absolute",
        top: 0,
        bottom: 0,
        width: Math.max(logoW * 0.35, 28),
        backgroundColor: palette.brandTextOn,
        opacity: 0.35,
        borderRadius: 12,
      },
      message: {
        ...typography.bodySm,
        color: palette.textMuted,
        marginTop: space.md,
        textAlign: "center",
        letterSpacing: 0.3,
        maxWidth: 280,
      },
    })
  );

  useEffect(() => {
    const enterMs = quick ? 120 : 320;
    const breatheMs = quick ? 650 : 1000;
    const shimmerMs = quick ? 1300 : 2000;

    enter.value = withTiming(1, { duration: enterMs, easing: Easing.out(Easing.cubic) });
    msgFade.value = withDelay(quick ? 40 : 120, withTiming(1, { duration: quick ? 180 : 400 }));

    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: breatheMs, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: breatheMs, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );

    shimmer.value = withRepeat(
      withTiming(1, { duration: shimmerMs, easing: Easing.inOut(Easing.quad) }),
      -1,
      false
    );
  }, [breathe, shimmer, enter, msgFade, quick]);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      {
        scale: interpolate(enter.value, [0, 1], [0.9, 1]),
      },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => {
    const t = breathe.value;
    return {
      opacity: interpolate(t, [0, 1], [0.35, 0.85]),
      transform: [{ scale: interpolate(t, [0, 1], [0.92, 1.08]) }],
    };
  });

  const glowAccentStyle = useAnimatedStyle(() => {
    const t = 1 - breathe.value;
    return {
      opacity: interpolate(t, [0, 1], [0.08, 0.28]),
      transform: [{ scale: interpolate(t, [0, 1], [1.05, 0.94]) }],
    };
  });

  const ghostStyle = useAnimatedStyle(() => {
    const t = breathe.value;
    return {
      opacity: interpolate(t, [0, 1], [0.12, 0.28]),
      transform: [{ scale: interpolate(t, [0, 1], [1.06, 1]) }],
    };
  });

  const logoStyle = useAnimatedStyle(() => {
    const t = breathe.value;
    return {
      opacity: interpolate(t, [0, 1], [0.5, 1]),
      transform: [{ scale: interpolate(t, [0, 1], [0.97, 1.03]) }],
    };
  });

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(shimmer.value, [0, 1], [-logoW * 0.6, logoW * 1.1]),
      },
      { skewX: "-18deg" },
    ],
  }));

  const messageStyle = useAnimatedStyle(() => ({
    opacity: msgFade.value * interpolate(breathe.value, [0, 1], [0.7, 1]),
  }));

  const containerStyle =
    variant === "fullscreen"
      ? styles.fullscreen
      : variant === "overlay"
        ? styles.overlay
        : styles.inline;

  const accessibilityLabel = message || (showTips ? "Loading" : "Loading");

  return (
    <View
      style={[containerStyle, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion="polite"
      pointerEvents={variant === "overlay" ? "auto" : "box-none"}
    >
      {useScrim && variant === "fullscreen" ? (
        <View style={styles.scrim} pointerEvents="none" />
      ) : null}

      <Animated.View style={[styles.glassCard, enterStyle]}>
        <View style={styles.stage}>
          <Animated.View style={[styles.glow, glowStyle]} />
          <Animated.View style={[styles.glowAccent, glowAccentStyle]} />

          <View style={styles.logoClip}>
            <Animated.Image
              source={brandImages.netquixLogo}
              resizeMode="contain"
              style={[styles.logoGhost, ghostStyle]}
            />
            <Animated.Image
              source={brandImages.netquixLogo}
              resizeMode="contain"
              style={[styles.logo, logoStyle]}
            />
            <Animated.View style={[styles.shimmerBar, shimmerStyle]} pointerEvents="none" />
          </View>
        </View>

        {!!message ? (
          <Animated.Text style={[styles.message, messageStyle]}>{message}</Animated.Text>
        ) : null}
      </Animated.View>

      {showTips ? <LoaderTipCarousel active /> : null}
    </View>
  );
}
