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

/** Pin / Q mark (`assets/netqwix_logo.png`) — drawer toggle. */
export function NetqwixMark({ size = 34, style, containerStyle }: Props) {
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
    <View style={[styles.frame, { width: size, height: size }, containerStyle]}>
      <Image
        accessibilityRole="image"
        accessibilityLabel="Open menu"
        source={brandImages.netqwixMark}
        contentFit="contain"
        style={[styles.image, { width: size, height: size }, style]}
        onError={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  image: {
    backgroundColor: "transparent",
  },
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
