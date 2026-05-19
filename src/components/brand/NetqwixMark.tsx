import { Image } from "expo-image";
import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { brandImages } from "../../constants/images";
import { useThemeColors } from "../../theme";

type Props = {
  size?: number;
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
};

/** Compact app mark (icon only) — for headers / drawer toggle. */
export function NetqwixMark({ size = 32, style, containerStyle }: Props) {
  const c = useThemeColors();
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <View
        style={[
          styles.fallback,
          { width: size, height: size, backgroundColor: c.brandNavy },
          containerStyle,
        ]}
      >
        <Text style={[styles.fallbackText, { color: c.brandTextOn }]}>NQ</Text>
      </View>
    );
  }

  return (
    <Image
      accessibilityRole="image"
      accessibilityLabel="NetQwix"
      source={brandImages.netqwixMark}
      contentFit="contain"
      style={[{ width: size, height: size }, style]}
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
