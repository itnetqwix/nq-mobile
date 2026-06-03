import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { BrandBootScreen } from "./BrandBootScreen";
import { SPLASH_EXIT_ANIMATION_MS } from "./splashConstants";

type Props = {
  /** When true, fades out before revealing the app shell. */
  exiting?: boolean;
};

export function AppSplashScreen({ exiting = false }: Props) {
  const rootOpacity = useSharedValue(1);

  useEffect(() => {
    if (!exiting) return;
    rootOpacity.value = withTiming(0, {
      duration: SPLASH_EXIT_ANIMATION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [exiting, rootOpacity]);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: rootOpacity.value,
  }));

  return (
    <Animated.View style={[styles.root, rootStyle]}>
      <BrandBootScreen />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
