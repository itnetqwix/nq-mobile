import { DrawerActions, useNavigation } from "@react-navigation/native";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { NetqwixMark } from "../components/brand/NetqwixMark";
import { radii, useThemeColors } from "../theme";

const BOX_SIZE = 40;
/** Pin art fits inside the frame with padding (PNG has a dark matte). */
const MARK_SIZE = 30;

/** Opens the drawer; pin logo sits inside a rounded frame. */
export function DrawerMarkButton() {
  const navigation = useNavigation();
  const c = useThemeColors();

  return (
    <Pressable
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      style={({ pressed }) => [styles.hit, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Open menu"
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
        <NetqwixMark size={MARK_SIZE} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    justifyContent: "center",
    alignItems: "center",
  },
  pressed: {
    opacity: 0.88,
  },
  frame: {
    width: BOX_SIZE,
    height: BOX_SIZE,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
