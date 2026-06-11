import { DrawerActions, useNavigation } from "@react-navigation/native";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { haptics } from "../lib/haptics";
import { useThemeColors } from "../theme";

/** Opens the drawer; shows a compact 3-line hamburger icon. */
export function DrawerMarkButton() {
  const navigation = useNavigation();
  const c = useThemeColors();

  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        navigation.dispatch(DrawerActions.openDrawer());
      }}
      style={({ pressed }) => [styles.hit, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Open menu"
      hitSlop={8}
    >
      <View style={styles.lines}>
        <View style={[styles.line, { backgroundColor: c.text }]} />
        <View style={[styles.line, styles.lineMid, { backgroundColor: c.text }]} />
        <View style={[styles.line, { backgroundColor: c.text }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    justifyContent: "center",
    alignItems: "center",
    padding: 8,
  },
  pressed: { opacity: 0.6 },
  lines: {
    width: 22,
    gap: 5,
  },
  line: {
    height: 2,
    borderRadius: 1,
    width: "100%",
  },
  lineMid: {
    width: "75%",
  },
});
