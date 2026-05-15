import React, { useRef } from "react";
import { Animated, Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors, typography } from "../../theme";

/** Screen content already ends at the tab bar; only a small inset is needed. */
const GAP_ABOVE_TAB_BAR = 20;

type Props = {
  onPress: () => void;
  label?: string;
};

export default function AIFloatingButton({ onPress, label }: Props) {
  const colors = useThemeColors();
  const bottom = GAP_ABOVE_TAB_BAR;

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  React.useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.8, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 1500, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.9, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
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
