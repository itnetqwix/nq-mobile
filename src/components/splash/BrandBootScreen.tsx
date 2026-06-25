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
import {
  SPLASH_ACCENT,
  SPLASH_BG_LIGHT,
  SPLASH_BG_LIGHT_TOP,
  SPLASH_TEXT,
  SPLASH_TEXT_MUTED,
} from "./splashConstants";

const LOGO_W = 200;
const LOGO_H = 74;
const PROGRESS_W = 168;

type Props = {
  /** Overrides i18n `splash.preparing`. */
  message?: string;
};

/**
 * First-launch / cold-start splash — light brand canvas, logo settle-in,
 * and a single indeterminate progress track (no shimmer dots).
 */
export function BrandBootScreen({ message }: Props) {
  const { t } = useTranslation();
  const statusText = message ?? t("splash.preparing", { defaultValue: "Getting things ready" });
  const tagline = t("splash.tagline", { defaultValue: "Live coaching, anywhere" });

  const enter = useSharedValue(0);
  const track = useSharedValue(0);

  useEffect(() => {
    enter.value = withTiming(1, {
      duration: 520,
      easing: Easing.out(Easing.cubic),
    });
    track.value = withDelay(
      180,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.cubic) }),
          withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.cubic) })
        ),
        -1,
        false
      )
    );
  }, [enter, track]);

  const stackStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: interpolate(enter.value, [0, 1], [10, 0]) }],
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0, 0.4, 1], [0, 0.85, 1]),
    transform: [{ scale: interpolate(enter.value, [0, 1], [0.94, 1]) }],
  }));

  const fillStyle = useAnimatedStyle(() => {
    const t = track.value;
    const width = interpolate(t, [0, 0.5, 1], [0.22, 0.78, 0.35]);
    const translate = interpolate(t, [0, 1], [-PROGRESS_W * 0.08, PROGRESS_W * 0.08]);
    return {
      width: PROGRESS_W * width,
      transform: [{ translateX: translate }],
    };
  });

  return (
    <View style={styles.root}>
      <View style={styles.topWash} pointerEvents="none" />
      <Animated.View style={[styles.stack, stackStyle]}>
        <Animated.View style={logoStyle}>
          <Image
            source={brandImages.netqwixPin}
            style={styles.pin}
            contentFit="contain"
            accessibilityLabel="NetQwix"
          />
          <Image
            source={brandImages.netqwixWordmark}
            style={styles.logo}
            contentFit="contain"
            accessibilityLabel="NetQwix"
          />
        </Animated.View>

        <Text style={styles.tagline}>{tagline}</Text>

        <View style={styles.progressTrack} accessibilityRole="progressbar">
          <Animated.View style={[styles.progressFill, fillStyle]} />
        </View>

        <Text style={styles.status}>{statusText}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SPLASH_BG_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  topWash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "42%",
    backgroundColor: SPLASH_BG_LIGHT_TOP,
  },
  stack: {
    alignItems: "center",
    maxWidth: 300,
  },
  pin: {
    width: 56,
    height: 56,
    marginBottom: 10,
  },
  logo: {
    width: LOGO_W,
    height: LOGO_H,
  },
  tagline: {
    ...typography.bodySm,
    color: SPLASH_TEXT_MUTED,
    marginTop: 14,
    textAlign: "center",
    letterSpacing: 0.2,
  },
  progressTrack: {
    width: PROGRESS_W,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(25, 118, 210, 0.14)",
    marginTop: 32,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: SPLASH_ACCENT,
  },
  status: {
    ...typography.caption,
    color: SPLASH_TEXT,
    marginTop: 14,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
