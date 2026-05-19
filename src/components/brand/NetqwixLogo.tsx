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
  /** Max width; height scales with aspect ratio. */
  maxWidth?: number;
  height?: number;
  style?: StyleProp<ImageStyle>;
  /** Hide bottom margin (e.g. nav header). */
  compact?: boolean;
};

/** Header logo — `netquix_logo_v1.png` (web login / sign-up asset). */
export function NetqwixLogo({ maxWidth = 220, height = 72, style, compact }: Props) {
  const c = useThemeColors();
  const [failed, setFailed] = useState(false);

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
        source={brandImages.netquixLogo}
        contentFit="contain"
        style={[{ width: maxWidth, height }, style]}
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
