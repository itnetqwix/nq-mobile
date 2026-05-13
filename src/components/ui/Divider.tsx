import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { colors, space } from "../../theme";

export type DividerProps = {
  inset?: number;
  vertical?: boolean;
  style?: ViewStyle;
};

export function Divider({ inset = 0, vertical, style }: DividerProps) {
  if (vertical) {
    return <View style={[styles.vertical, { marginHorizontal: inset }, style]} />;
  }
  return <View style={[styles.horizontal, { marginHorizontal: inset }, style]} />;
}

const styles = StyleSheet.create({
  horizontal: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    width: "100%",
    marginVertical: space.xs,
  },
  vertical: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    alignSelf: "stretch",
  },
});
