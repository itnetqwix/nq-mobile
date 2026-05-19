import { DrawerActions, useNavigation } from "@react-navigation/native";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { NetqwixMark } from "../components/brand/NetqwixMark";
import { useThemeColors } from "../theme";

type Props = {
  size?: number;
};

/** Opens the dashboard drawer; shows the NetQwix mark instead of a hamburger icon. */
export const DrawerMarkButton = React.forwardRef<View, Props>(function DrawerMarkButton(
  { size = 32 },
  ref
) {
  const navigation = useNavigation();
  const c = useThemeColors();

  return (
    <Pressable
      ref={ref}
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      style={({ pressed }) => [
        styles.hit,
        { backgroundColor: c.surfaceElevated, borderColor: c.border },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Open menu"
    >
      <NetqwixMark size={size} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  hit: {
    marginLeft: 12,
    minWidth: 44,
    minHeight: 44,
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.85,
  },
});
