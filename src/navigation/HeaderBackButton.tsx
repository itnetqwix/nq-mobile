import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { haptics } from "../lib/haptics";
import { radii, useThemeColors } from "../theme";
import { useShellNestedBack } from "./ShellNestedBackContext";

const BOX_SIZE = 40;
const ICON_SIZE = 22;

/**
 * Compact circular back chevron used in the left slot of every nested
 * shell-surface header. Mirrors the framing of `DrawerMarkButton` so they
 * occupy the same footprint when one swaps for the other.
 *
 * iOS's native swipe-back is disabled (`gestureEnabled: false` in
 * `mainStackHeaderOptions`) and `StackSwipeBackShell` owns the swipe pop,
 * so this button is the only always-visible way to leave a deep screen
 * without using gestures.
 */
export function HeaderBackButton() {
  const navigation = useNavigation();
  const nestedBack = useShellNestedBack();
  const c = useThemeColors();

  const handleBack = () => {
    haptics.tap();
    if (nestedBack?.tryGoBack()) return;
    if (!navigation.canGoBack()) return;
    navigation.goBack();
  };

  return (
    <Pressable
      onPress={handleBack}
      style={({ pressed }) => [styles.hit, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={6}
    >
      <View
        style={[
          styles.frame,
          {
            borderColor: c.border,
            backgroundColor: c.surfaceElevated,
          },
        ]}
      >
        <Ionicons name="chevron-back" size={ICON_SIZE} color={c.text} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { justifyContent: "center", alignItems: "center" },
  pressed: { opacity: 0.85 },
  frame: {
    width: BOX_SIZE,
    height: BOX_SIZE,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
