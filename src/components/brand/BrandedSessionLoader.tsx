import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Easing, Image, StyleSheet, View } from "react-native";
import { brandImages } from "../../constants/images";
import { colors, space } from "../../theme";

/**
 * First screen while the app restores the session (reads SecureStore + calls `/user/me`).
 * Uses the same logo as the website with a subtle pulse so it reads as a loader, not a static image.
 */
export function BrandedSessionLoader() {
  const pulse = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.55,
          duration: 850,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.root} accessibilityLabel="Loading NetQwix">
      <Animated.Image
        source={brandImages.netquixLogo}
        resizeMode="contain"
        style={[styles.logo, { opacity: pulse }]}
      />
      <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    paddingHorizontal: space.xl,
  },
  logo: {
    width: 240,
    maxWidth: "88%",
    height: 88,
  },
  spinner: {
    marginTop: space.lg,
  },
});
