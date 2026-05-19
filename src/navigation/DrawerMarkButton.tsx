import { DrawerActions, useNavigation } from "@react-navigation/native";
import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { NetqwixMark } from "../components/brand/NetqwixMark";

type Props = {
  size?: number;
};

/** Opens the dashboard drawer; shows the NetQwix mark instead of a hamburger icon. */
export function DrawerMarkButton({ size = 32 }: Props) {
  const navigation = useNavigation();

  return (
    <Pressable
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      style={styles.hit}
      accessibilityRole="button"
      accessibilityLabel="Open menu"
    >
      <NetqwixMark size={size} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    marginLeft: 12,
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },
});
