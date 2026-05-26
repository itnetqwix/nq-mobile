import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

const SWIPE_THRESHOLD = 56;

type Props = {
  children: React.ReactNode;
  /** When false, swipe-back is disabled (e.g. root dashboard). */
  enabled?: boolean;
  /** Override back target (e.g. wallet root → exit shell). */
  onBack?: () => void;
};

/**
 * Owns the swipe-to-go-back gesture for every nested shell surface.
 *
 * Why this exists: the native-stack's iOS swipe-back is disabled globally
 * (`gestureEnabled: false` in `mainStackHeaderOptions`) because, when it
 * stayed enabled together with this RNGH pan, both gestures would fire and
 * the user could be popped TWO frames in a single swipe — sometimes back
 * to the root. With native swipe off, this shell is the single source of
 * truth for the swipe pop and it intentionally pops only one frame.
 */
export function StackSwipeBackShell({ children, enabled = true, onBack }: Props) {
  const navigation = useNavigation();
  /**
   * Belt-and-braces guard: even though `Gesture.Pan().onEnd` should run
   * once per gesture, `runOnJS` callbacks have historically been observed
   * to re-fire on cancellation in older RNGH versions. Latching here makes
   * the JS-side pop a no-op until the next pan begins.
   */
  const hasFiredRef = useRef(false);

  const goBack = useCallback(() => {
    if (hasFiredRef.current) return;
    hasFiredRef.current = true;
    if (onBack) {
      onBack();
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation, onBack]);

  const resetFired = useCallback(() => {
    hasFiredRef.current = false;
  }, []);

  const canSwipe = enabled && (onBack != null || navigation.canGoBack());

  const gesture = useMemo(() => {
    return Gesture.Pan()
      .enabled(canSwipe)
      .activeOffsetX([28, 9999])
      .failOffsetY([-18, 18])
      .onBegin(() => {
        runOnJS(resetFired)();
      })
      .onEnd((e) => {
        if (e.translationX >= SWIPE_THRESHOLD) {
          runOnJS(goBack)();
        }
      });
  }, [canSwipe, goBack, resetFired]);

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.fill}>{children}</View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
