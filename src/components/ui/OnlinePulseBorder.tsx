import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { radii } from "../../theme";

const GREEN_LIGHT = "#86efac";
const GREEN_DARK = "#15803d";

type Props = {
  active: boolean;
  children: React.ReactNode;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Pulsing green outer ring for online trainers / coaches. */
export function OnlinePulseBorder({
  active,
  children,
  borderRadius = radii.lg,
  style,
}: Props) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  if (!active) {
    return <View style={style}>{children}</View>;
  }

  const borderColor = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [GREEN_LIGHT, GREEN_DARK],
  });

  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.45],
  });

  return (
    <Animated.View
      style={[
        styles.outer,
        style,
        {
          borderRadius,
          borderColor,
          shadowOpacity: glowOpacity,
        },
      ]}
    >
      <View style={[styles.inner, { borderRadius: Math.max(0, borderRadius - 2) }]}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderWidth: 2.5,
    shadowColor: GREEN_DARK,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    elevation: 3,
  },
  inner: {
    overflow: "hidden",
  },
});
