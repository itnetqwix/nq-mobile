import React, { useRef } from "react";
import { Animated, Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReduceMotion } from "../../lib/a11y";
import { floatingTabBarBottomInset } from "../../navigation/FloatingTabBar";
import { useThemeColors, typography } from "../../theme";

/** Extra gap so the FAB clears the floating tab pill. */
const FAB_CLEARANCE_ABOVE_TAB = 12;

type Props = {
  onPress: () => void;
  label?: string;
};

export default function AIFloatingButton({ onPress, label }: Props) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const bottom = floatingTabBarBottomInset(insets.bottom) + FAB_CLEARANCE_ABOVE_TAB;

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const reduceMotion = useReduceMotion();

  React.useEffect(() => {
    if (reduceMotion) {
      pulseAnim.setValue(0.55);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.8, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 1500, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim, reduceMotion]);

  const handlePressIn = () => {
    if (reduceMotion) {
      scaleAnim.setValue(0.96);
      return;
    }
    Animated.spring(scaleAnim, { toValue: 0.9, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    if (reduceMotion) {
      scaleAnim.setValue(1);
      return;
    }
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
  };

  return (
    <Animated.View
      style={[styles.wrapper, { bottom, transform: [{ scale: scaleAnim }] }]}
    >
      {/* Pulse ring */}
      <Animated.View
        style={[
          styles.pulseRing,
          {
            backgroundColor: colors.brandAccent,
            opacity: pulseAnim,
          },
        ]}
      />
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.button, { backgroundColor: colors.brand }]}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label} (NetQwix AI assistant)` : "Open NetQwix AI assistant"}
      >
        <Ionicons name="sparkles" size={22} color="#fff" />
        {label && (
          <Text style={[typography.label, styles.label]}>{label}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    right: 20,
    zIndex: 999,
  },
  pulseRing: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    top: -4,
    left: -4,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    flexDirection: "row",
  },
  label: {
    color: "#fff",
    marginLeft: 6,
  },
});
