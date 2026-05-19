import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useMemo } from "react";
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

/** Swipe right to go back on nested stack screens. */
export function StackSwipeBackShell({ children, enabled = true, onBack }: Props) {
  const navigation = useNavigation();

  const goBack = useCallback(() => {
    if (onBack) {
      onBack();
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation, onBack]);

  const canSwipe = enabled && (onBack != null || navigation.canGoBack());

  const gesture = useMemo(() => {
    return Gesture.Pan()
      .enabled(canSwipe)
      .activeOffsetX([28, 9999])
      .failOffsetY([-18, 18])
      .onEnd((e) => {
        if (e.translationX >= SWIPE_THRESHOLD) {
          runOnJS(goBack)();
        }
      });
  }, [canSwipe, goBack]);

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.fill}>{children}</View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
