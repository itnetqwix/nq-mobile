import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { space, useThemedStyles } from "../../theme";

export type DividerProps = {
  inset?: number;
  vertical?: boolean;
  style?: ViewStyle;
};

export function Divider({ inset = 0, vertical, style }: DividerProps) {
  const styles = useThemedStyles((c) =>
    StyleSheet.create({
      horizontal: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: c.border,
        width: "100%",
        marginVertical: space.xs,
      },
      vertical: {
        width: StyleSheet.hairlineWidth,
        backgroundColor: c.border,
        alignSelf: "stretch",
      },
    })
  );

  if (vertical) {
    return <View style={[styles.vertical, { marginHorizontal: inset }, style]} />;
  }
  return <View style={[styles.horizontal, { marginHorizontal: inset }, style]} />;
}
