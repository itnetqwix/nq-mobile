import React, { useEffect } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { brandImages } from "../../constants/images";
import { space, typography, useThemeColors, useThemedStyles } from "../../theme";

export type NetQwixLoaderVariant = "fullscreen" | "inline" | "overlay";

type Props = {
  message?: string;
  variant?: NetQwixLoaderVariant;
  size?: "sm" | "md" | "lg";
  style?: ViewStyle;
};

const SIZES = { sm: 56, md: 80, lg: 104 } as const;

export function NetQwixLoader({
  message = "Loading",
  variant = "fullscreen",
  size = "md",
  style,
}: Props) {
  const c = useThemeColors();
  const logoSize = SIZES[size];
  const spin = useSharedValue(0);
  const pulse = useSharedValue(0.7);

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
        backgroundColor: `${palette.background}E6`,
        zIndex: 999,
      },
      ringWrap: {
        width: logoSize + 36,
        height: logoSize + 36,
        alignItems: "center",
        justifyContent: "center",
      },
      ring: {
        position: "absolute",
        width: logoSize + 32,
        height: logoSize + 32,
        borderRadius: (logoSize + 32) / 2,
        borderWidth: 3,
        borderColor: palette.brandNavy,
        borderTopColor: "transparent",
        borderRightColor: `${palette.brandNavy}40`,
      },
      logo: {
        width: logoSize,
        height: logoSize * 0.36,
        maxWidth: "100%",
      },
      message: {
        ...typography.bodyMd,
        color: palette.textMuted,
        marginTop: space.lg,
        textAlign: "center",
      },
    })
  );

  useEffect(() => {
    spin.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.linear }),
      -1,
      false
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.65, { duration: 700, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [spin, pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
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
      <View style={styles.ringWrap}>
        <Animated.View style={[styles.ring, ringStyle]} />
        <Animated.Image
          source={brandImages.netquixLogo}
          resizeMode="contain"
          style={[styles.logo, logoStyle]}
        />
      </View>
      {!!message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}
