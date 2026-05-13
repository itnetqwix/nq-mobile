import React from "react";
import { Image, type ImageStyle, type StyleProp, StyleSheet, View } from "react-native";
import { brandImages } from "../../constants/images";
import { space } from "../../theme";

type Props = {
  /** Max width; height scales with aspect ratio. */
  maxWidth?: number;
  style?: StyleProp<ImageStyle>;
};

/** Header logo — `netquix_logo_v1.png` (web login / sign-up asset). */
export function NetqwixLogo({ maxWidth = 220, style }: Props) {
  return (
    <View style={styles.wrap}>
      <Image
        accessibilityRole="image"
        accessibilityLabel="NetQwix"
        source={brandImages.netquixLogo}
        resizeMode="contain"
        style={[{ width: maxWidth, height: 72 }, style]}
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
});
