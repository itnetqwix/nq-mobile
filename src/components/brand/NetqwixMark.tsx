import React from "react";
import { Image, type ImageStyle, type StyleProp, StyleSheet } from "react-native";
import { brandImages } from "../../constants/images";

type Props = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

/** Compact app mark (icon only) — for headers / drawer toggle, not the full wordmark. */
export function NetqwixMark({ size = 32, style }: Props) {
  return (
    <Image
      accessibilityRole="image"
      accessibilityLabel="Open menu"
      source={brandImages.netqwixMark}
      resizeMode="contain"
      style={[styles.mark, { width: size, height: size }, style]}
    />
  );
}

const styles = StyleSheet.create({
  mark: {},
});
