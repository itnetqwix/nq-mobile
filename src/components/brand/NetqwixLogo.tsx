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
  /** Use full horizontal wordmark (`netquix_logo_v1.png`) across the container width. */
  fullWidth?: boolean;
  /** Horizontal alignment inside the wrapper */
  align?: "center" | "start";
};

export function NetqwixLogo({
  variant = "wordmark",
  maxWidth,
  height,
  style,
  compact,
  fullWidth,
  align = "center",
}: Props) {
  const c = useThemeColors();
  const [failed, setFailed] = useState(false);

  const isPin = variant === "pin";
  const wordmarkFull = !isPin && fullWidth;
  const width = wordmarkFull ? "100%" : (maxWidth ?? (isPin ? 52 : 220));
  const imgHeight = height ?? (isPin ? 52 : wordmarkFull ? 88 : 72);
  const maxW = wordmarkFull ? (maxWidth ?? 340) : undefined;
  const source = isPin ? brandImages.netqwixPin : brandImages.netqwixWordmark;

  if (failed) {
    return (
      <View style={[styles.wrap, compact && styles.wrapCompact]}>
        <Text style={[styles.fallbackWordmark, { color: c.brandNavy }]}>NetQwix</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.wrap,
        compact && styles.wrapCompact,
        align === "start" && styles.wrapStart,
      ]}
    >
      <Image
        accessibilityRole="image"
        accessibilityLabel="NetQwix"
        source={source}
        contentFit="contain"
        style={[
          wordmarkFull
            ? { width: "100%", maxWidth: maxW, height: imgHeight }
            : { width, height: imgHeight },
          style,
        ]}
        onError={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    marginBottom: space.md,
    marginTop: 0,
    alignSelf: "stretch",
  },
  wrapCompact: {
    marginBottom: 0,
    marginTop: 0,
  },
  wrapStart: {
    alignItems: "flex-start",
    alignSelf: "stretch",
  },
  fallbackWordmark: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
