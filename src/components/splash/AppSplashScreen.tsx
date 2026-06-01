import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { brandImages } from "../../constants/images";
import { useAppTranslation } from "../../i18n/useAppTranslation";
import { space, typography } from "../../theme";
import { SPLASH_BRAND_NAVY, SPLASH_EXIT_ANIMATION_MS } from "./splashConstants";

const LOGO_W = 260;
const LOGO_H = 94;

type Props = {
  /** 0–1 bootstrap progress (auth, locale, etc.). */
  progress: number;
  /** When true, runs exit animation (parent hides native splash after). */
  exiting?: boolean;
};

export function AppSplashScreen({ progress, exiting = false }: Props) {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const [trackWidth, setTrackWidth] = useState(0);

  const rootOpacity = useSharedValue(1);
  const rootScale = useSharedValue(1);
  const logoEnter = useSharedValue(0);
  const taglineEnter = useSharedValue(0);
  const orbA = useSharedValue(0);
  const orbB = useSharedValue(0);
  const progressAnim = useSharedValue(0);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    logoEnter.value = withSpring(1, { damping: 14, stiffness: 120 });
    taglineEnter.value = withDelay(220, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));

    orbA.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2_400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2_400, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    orbB.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2_800, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 2_800, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );

    shimmer.value = withRepeat(
      withTiming(1, { duration: 1_800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [logoEnter, taglineEnter, orbA, orbB, shimmer]);

  useEffect(() => {
    progressAnim.value = withTiming(Math.min(1, Math.max(0, progress)), {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, progressAnim]);

  useEffect(() => {
    if (!exiting) return;
    rootOpacity.value = withTiming(0, {
      duration: SPLASH_EXIT_ANIMATION_MS,
      easing: Easing.in(Easing.cubic),
    });
    rootScale.value = withTiming(1.04, {
      duration: SPLASH_EXIT_ANIMATION_MS,
      easing: Easing.in(Easing.cubic),
    });
  }, [exiting, rootOpacity, rootScale]);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: rootOpacity.value,
    transform: [{ scale: rootScale.value }],
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoEnter.value,
    transform: [
      { scale: interpolate(logoEnter.value, [0, 1], [0.82, 1]) },
      { translateY: interpolate(logoEnter.value, [0, 1], [18, 0]) },
    ],
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineEnter.value,
    transform: [{ translateY: interpolate(taglineEnter.value, [0, 1], [10, 0]) }],
  }));

  const orbAStyle = useAnimatedStyle(() => ({
    opacity: interpolate(orbA.value, [0, 1], [0.12, 0.32]),
    transform: [{ scale: interpolate(orbA.value, [0, 1], [0.95, 1.08]) }],
  }));

  const orbBStyle = useAnimatedStyle(() => ({
    opacity: interpolate(orbB.value, [0, 1], [0.08, 0.22]),
    transform: [{ scale: interpolate(orbB.value, [0, 1], [1.02, 0.92]) }],
  }));

  const barFillStyle = useAnimatedStyle(() => {
    const w = trackWidth > 0 ? Math.max(8, trackWidth * progressAnim.value) : 8;
    return { width: w };
  });

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.15, 0.45]),
    transform: [{ translateX: interpolate(shimmer.value, [0, 1], [-LOGO_W, LOGO_W * 0.3]) }],
  }));

  return (
    <Animated.View style={[styles.root, rootStyle]}>
      <Animated.View style={[styles.orb, styles.orbTopLeft, orbAStyle]} />
      <Animated.View style={[styles.orb, styles.orbBottomRight, orbBStyle]} />

      <View style={styles.center}>
        <Animated.View style={[styles.logoWrap, logoStyle]}>
          <Animated.View style={[styles.shimmer, shimmerStyle]} />
          <Image
            source={brandImages.netqwixWordmark}
            style={styles.logo}
            contentFit="contain"
            accessibilityLabel="NetQwix"
          />
        </Animated.View>

        <Animated.Text style={[styles.tagline, taglineStyle]}>
          {t("splash.tagline")}
        </Animated.Text>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
        <Text style={styles.statusText}>{t("splash.preparing")}</Text>
        <View
          style={styles.track}
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        >
          <Animated.View style={[styles.fill, barFillStyle]} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SPLASH_BRAND_NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
  orb: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#ffffff",
  },
  orbTopLeft: { top: -80, left: -100 },
  orbBottomRight: { bottom: -120, right: -90 },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xl,
    maxWidth: 360,
  },
  logoWrap: {
    width: LOGO_W,
    height: LOGO_H,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 12,
  },
  shimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 72,
    backgroundColor: "#ffffff",
    borderRadius: 8,
  },
  logo: {
    width: LOGO_W,
    height: LOGO_H,
  },
  tagline: {
    ...typography.bodyMd,
    color: "rgba(255,255,255,0.88)",
    textAlign: "center",
    marginTop: space.lg,
    letterSpacing: 0.2,
    fontWeight: "500",
  },
  footer: {
    position: "absolute",
    left: space.xl,
    right: space.xl,
    bottom: 0,
    gap: space.sm,
  },
  statusText: {
    ...typography.caption,
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    letterSpacing: 0.4,
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: "#ffffff",
  },
});
