import React from "react";
import { View, type ViewStyle } from "react-native";
import { space } from "../../theme";

type Direction = "row" | "column";
type SpaceKey = keyof typeof space;

export type StackProps = {
  direction?: Direction;
  gap?: SpaceKey;
  align?: ViewStyle["alignItems"];
  justify?: ViewStyle["justifyContent"];
  flex?: number;
  wrap?: boolean;
  style?: ViewStyle;
  children?: React.ReactNode;
};

/**
 * Layout primitive — direction + spacing + alignment in one place.
 * Replaces a lot of `style={{ flexDirection: "row", gap: 8 }}` repetition
 * across screens.
 */
export function Stack({
  direction = "column",
  gap = "sm",
  align,
  justify,
  flex,
  wrap,
  style,
  children,
}: StackProps) {
  return (
    <View
      style={[
        {
          flexDirection: direction,
          gap: space[gap],
          alignItems: align,
          justifyContent: justify,
          flex,
          flexWrap: wrap ? "wrap" : undefined,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
