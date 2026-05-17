import React, { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { space, typography, useThemedStyles } from "../../../theme";
import { useRotatingLoaderTip } from "./useRotatingLoaderTip";

type Props = {
  active?: boolean;
};

/** Plain tip text shown directly under the logo loader. */
export function LoaderTipCarousel({ active = true }: Props) {
  const tip = useRotatingLoaderTip(active);
  const opacity = useSharedValue(0);

  const styles = useThemedStyles((palette) =>
    StyleSheet.create({
      text: {
        ...typography.bodySm,
        color: palette.textMuted,
        textAlign: "center",
        lineHeight: 22,
        maxWidth: 320,
        marginTop: space.lg,
        paddingHorizontal: space.md,
      },
    })
  );

  useEffect(() => {
    opacity.value = 0;
    opacity.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
  }, [tip, opacity]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!tip) return null;

  return (
    <Animated.Text style={[styles.text, fadeStyle]} pointerEvents="none">
      {tip}
    </Animated.Text>
  );
}
