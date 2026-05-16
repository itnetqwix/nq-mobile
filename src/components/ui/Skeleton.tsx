import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";
import { durations, easings, radii, useThemedStyles } from "../../theme";

export type SkeletonProps = {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: ViewStyle;
};

/** Shimmer placeholder for list / card loading states. */
export function Skeleton({ width = "100%", height = 16, radius = radii.sm, style }: SkeletonProps) {
  const styles = useThemedStyles((c) =>
    StyleSheet.create({
      base: {
        backgroundColor: c.surfaceMuted,
        overflow: "hidden",
      },
      shimmer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: c.neutral200,
      },
    })
  );

  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: durations.slow * 2,
          easing: easings.standard,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: durations.slow * 2,
          easing: easings.standard,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.8] });

  return (
    <View
      style={[
        { width: width as ViewStyle["width"], height, borderRadius: radius },
        styles.base,
        style,
      ]}
    >
      <Animated.View style={[styles.shimmer, { borderRadius: radius, opacity }]} />
    </View>
  );
}
