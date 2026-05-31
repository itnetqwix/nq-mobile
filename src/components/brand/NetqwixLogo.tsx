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
  /** `pin` = compact mark. `wordmark` = full logo (`netqwix_logo-fulll.png`). */
  variant?: "pin" | "wordmark";
  maxWidth?: number;
  height?: number;
  style?: StyleProp<ImageStyle>;
  compact?: boolean;
  /** Scale the full logo to the container width (keeps aspect ratio). */
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
  const imgHeight = height ?? (isPin ? 52 : wordmarkFull ? 96 : 80);
  const frameMaxWidth = isPin
    ? (maxWidth ?? 52)
    : (maxWidth ?? (wordmarkFull ? 340 : 220));
  const source = isPin ? brandImages.netqwixPin : brandImages.netqwixWordmark;

  if (failed) {
    return (
      <View style={[styles.wrap, compact && styles.wrapCompact]}>
        <Text style={[styles.fallbackWordmark, { color: c.brandNavy }]}>NetQwix</Text>
      </View>
    );
  }

  const imageStyle = isPin
    ? [{ width: frameMaxWidth, height: imgHeight }, style]
    : [{ width: "100%", height: imgHeight }, style];

  return (
    <View
      style={[
        styles.wrap,
        compact && styles.wrapCompact,
        align === "start" && styles.wrapStart,
        align === "center" && styles.wrapCenter,
        !isPin && { width: "100%", maxWidth: frameMaxWidth },
      ]}
    >
      <Image
        accessibilityRole="image"
        accessibilityLabel="NetQwix"
        source={source}
        contentFit="contain"
        style={imageStyle}
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
  wrapCenter: {
    alignItems: "center",
    alignSelf: "center",
  },
  fallbackWordmark: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
