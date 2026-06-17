import React, { useEffect } from "react";
import { StyleProp, ViewStyle } from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { durations, easings } from "../../theme/motion";

type FadeInViewProps = {
  children: React.ReactNode;
  /** Stagger index for list rows (ms offset = index * 40, capped). */
  index?: number;
  style?: StyleProp<ViewStyle>;
  /** Slide up slightly on enter (default) or down. */
  direction?: "up" | "down";
};

const MAX_STAGGER_MS = 200;
const STAGGER_STEP_MS = 40;

/**
 * Subtle enter animation for lists and cards. Keep durations small so the
 * app feels responsive, not theatrical.
 */
export function FadeInView({
  children,
  index = 0,
  style,
  direction = "up",
}: FadeInViewProps) {
  const delay = Math.min(index * STAGGER_STEP_MS, MAX_STAGGER_MS);
  const entering =
    direction === "down"
      ? FadeInDown.duration(durations.base).delay(delay)
      : FadeInUp.duration(durations.base).delay(delay);

  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}

type FadeInOpacityProps = {
  children: React.ReactNode;
  visible?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Cross-fade when toggling tab bodies without layout animation jank. */
export function FadeInOpacity({ children, visible = true, style }: FadeInOpacityProps) {
  const opacity = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, {
      duration: durations.fast,
      easing: easings.decelerate,
    });
  }, [opacity, visible]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
