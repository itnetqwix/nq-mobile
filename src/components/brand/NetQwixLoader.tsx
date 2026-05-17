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
import { space, typography, useThemedStyles } from "../../theme";

export type NetQwixLoaderVariant = "fullscreen" | "inline" | "overlay";

type Props = {
  message?: string;
  variant?: NetQwixLoaderVariant;
  size?: "sm" | "md" | "lg";
  style?: ViewStyle;
};

const SIZES = { sm: 64, md: 92, lg: 120 } as const;
const LOGO_ASPECT = 0.36;

export function NetQwixLoader({
  message = "Loading",
  variant = "fullscreen",
  size = "md",
  style,
}: Props) {
  const stage = SIZES[size];
  const logoW = stage;
  const logoH = stage * LOGO_ASPECT;

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
        backgroundColor: palette.background,
        paddingHorizontal: space.xl,
      },
      inline: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: space.xl,
      },
      overlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: `${palette.background}F0`,
        zIndex: 999,
      },
      vignette: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: palette.brandNavy,
        opacity: 0.04,
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
        marginTop: space.lg,
        textAlign: "center",
        letterSpacing: 0.3,
        maxWidth: 280,
      },
    })
  );

  useEffect(() => {
    enter.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
    msgFade.value = withDelay(180, withTiming(1, { duration: 500 }));

    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );

    shimmer.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
      -1,
      false
    );
  }, [breathe, shimmer, enter, msgFade]);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      {
        scale: interpolate(enter.value, [0, 1], [0.88, 1]),
      },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => {
    const t = breathe.value;
    return {
      opacity: interpolate(t, [0, 1], [0.35, 0.85]),
      transform: [
        { scale: interpolate(t, [0, 1], [0.92, 1.08]) },
      ],
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
      opacity: interpolate(t, [0, 1], [0.42, 1]),
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
    opacity: msgFade.value * interpolate(breathe.value, [0, 1], [0.65, 1]),
  }));

  const containerStyle =
    variant === "fullscreen"
      ? styles.fullscreen
      : variant === "overlay"
        ? styles.overlay
        : styles.inline;

  return (
    <View
      style={[containerStyle, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
      pointerEvents={variant === "overlay" ? "auto" : "box-none"}
    >
      {variant === "overlay" ? <View style={styles.vignette} pointerEvents="none" /> : null}

      <Animated.View style={[styles.stage, enterStyle]}>
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
      </Animated.View>

      {!!message ? (
        <Animated.Text style={[styles.message, messageStyle]}>{message}</Animated.Text>
      ) : null}
    </View>
  );
}
