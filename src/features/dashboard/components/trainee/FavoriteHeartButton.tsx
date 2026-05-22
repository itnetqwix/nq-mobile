import React, { useRef } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useThemeColors, useThemedStyles } from "../../../../theme";

type Props = {
  active: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
};

export function FavoriteHeartButton({
  active,
  onPress,
  accessibilityLabel,
  size = 26,
}: Props) {
  const c = useThemeColors();
  const styles = useStyles();
  const scale = useRef(new Animated.Value(1)).current;

  const bump = () => {
    scale.setValue(0.82);
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      tension: 180,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    void Haptics.impactAsync(
      active ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium
    );
    bump();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={12}
    >
      <Animated.View
        style={[
          styles.circle,
          active && styles.circleActive,
          { transform: [{ scale }] },
        ]}
      >
        <Ionicons
          name={active ? "heart" : "heart-outline"}
          size={size}
          color={active ? "#E53935" : c.textMuted}
        />
      </Animated.View>
    </Pressable>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      circle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.border,
      },
      circleActive: {
        backgroundColor: "#FFEBEE",
        borderColor: "#E53935",
      },
    })
  );
}
