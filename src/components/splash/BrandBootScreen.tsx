import { Image } from "expo-image";
import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { brandImages } from "../../constants/images";
import { SPLASH_BRAND_NAVY } from "./splashConstants";

const LOGO_W = 220;
const LOGO_H = 80;

/** Shared cold-start / session-restore screen — logo on brand navy, subtle spinner. */
export function BrandBootScreen() {
  return (
    <View style={styles.root}>
      <Image
        source={brandImages.netqwixWordmark}
        style={styles.logo}
        contentFit="contain"
        accessibilityLabel="NetQwix"
      />
      <ActivityIndicator
        style={styles.spinner}
        color="rgba(255,255,255,0.5)"
        size="small"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SPLASH_BRAND_NAVY,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  logo: {
    width: LOGO_W,
    height: LOGO_H,
  },
  spinner: {
    marginTop: 28,
  },
});
