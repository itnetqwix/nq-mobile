import { DrawerActions, useNavigation } from "@react-navigation/native";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { NetqwixMark } from "../components/brand/NetqwixMark";

type Props = {
  /** Image width/height inside the tap target */
  size?: number;
};

/** Opens the dashboard drawer; shows the NetQwix pin mark. */
export const DrawerMarkButton = React.forwardRef<View, Props>(function DrawerMarkButton(
  { size = 34 },
  ref
) {
  const navigation = useNavigation();

  return (
    <Pressable
      ref={ref}
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      style={({ pressed }) => [styles.hit, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Open menu"
    >
      <NetqwixMark size={size} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  hit: {
    marginLeft: 8,
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  pressed: {
    opacity: 0.82,
  },
});
