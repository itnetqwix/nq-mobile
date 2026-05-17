import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { space, typography, useTheme, useThemedStyles } from "../../../theme";
import { useRotatingLoaderTip } from "./useRotatingLoaderTip";

type Props = {
  active?: boolean;
};

export function LoaderTipCarousel({ active = true }: Props) {
  const tip = useRotatingLoaderTip(active);
  const insets = useSafeAreaInsets();
  const { scheme } = useTheme();
  const isDark = scheme === "dark";
  const opacity = useSharedValue(0);

  const styles = useThemedStyles((palette) =>
    StyleSheet.create({
      root: {
        position: "absolute",
        left: space.lg,
        right: space.lg,
        bottom: Math.max(insets.bottom, space.lg) + space.md,
        alignItems: "center",
      },
      pill: {
        maxWidth: 360,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        borderRadius: 16,
        backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.1)",
      },
      label: {
        ...typography.caption,
        color: palette.brandAccent,
        textTransform: "uppercase",
        letterSpacing: 1.1,
        marginBottom: space.xs,
        fontWeight: "600",
      },
      text: {
        ...typography.bodySm,
        color: palette.textMuted,
        textAlign: "center",
        lineHeight: 20,
      },
    })
  );

  useEffect(() => {
    opacity.value = 0;
    opacity.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
  }, [tip, opacity]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!tip) return null;

  return (
    <View style={styles.root} pointerEvents="none">
      <Animated.View style={[styles.pill, fadeStyle]}>
        <Text style={styles.label}>Sports tip</Text>
        <Text style={styles.text}>{tip}</Text>
      </Animated.View>
    </View>
  );
}
