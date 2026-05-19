import { Image } from "expo-image";
import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
} from "react-native";
import { brandImages } from "../../constants/images";
import { space } from "../../theme";
import { useThemeColors } from "../../theme";

type Props = {
  /** `pin` = assets/netqwix_logo.png (home header). `wordmark` = login banner. */
  variant?: "pin" | "wordmark";
  maxWidth?: number;
  height?: number;
  style?: StyleProp<ImageStyle>;
  compact?: boolean;
};

export function NetqwixLogo({
  variant = "wordmark",
  maxWidth,
  height,
  style,
  compact,
}: Props) {
  const c = useThemeColors();
  const [failed, setFailed] = useState(false);

  const isPin = variant === "pin";
  const width = maxWidth ?? (isPin ? 52 : 220);
  const imgHeight = height ?? (isPin ? 52 : 72);
  const source = isPin ? brandImages.netqwixPin : brandImages.netqwixWordmark;

  if (failed) {
    return (
      <View style={[styles.wrap, compact && styles.wrapCompact]}>
        <Text style={[styles.fallbackWordmark, { color: c.brandNavy }]}>NetQwix</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Image
        accessibilityRole="image"
        accessibilityLabel="NetQwix"
        source={source}
        contentFit="contain"
        style={[{ width, height: imgHeight }, style]}
        onError={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    marginBottom: space.lg,
    marginTop: space.sm,
  },
  wrapCompact: {
    marginBottom: 0,
    marginTop: 0,
  },
  fallbackWordmark: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
