import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { radii, space, typography, useThemedStyles } from "../../../../theme";

function PulseOrb({ delayMs, size, color }: { delayMs: number; size: number; color: string }) {
  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    const start = () => {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.85, { duration: 2200, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.12, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.32, { duration: 2200, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    };
    const timer = setTimeout(start, delayMs);
    return () => clearTimeout(timer);
  }, [delayMs, opacity, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

/**
 * Branded footer for locker surfaces — fills the tab-bar clearance with motion
 * instead of empty scroll padding.
 */
export function LockerBrandFooter() {
  const { t } = useAppTranslation();
  const styles = useStyles();
  const orbColor = styles.orbColor.color;

  return (
    <View style={styles.wrap} accessibilityRole="text">
      <View style={styles.art}>
        <PulseOrb delayMs={0} size={120} color={orbColor} />
        <PulseOrb delayMs={700} size={88} color={orbColor} />
        <View style={styles.iconBadge}>
          <Ionicons name="shield-checkmark" size={22} color={styles.iconColor.color} />
        </View>
      </View>
      <Text style={styles.title}>
        {t("locker.brandFooterTitle", { defaultValue: "Your NetQwix Locker" })}
      </Text>
      <Text style={styles.sub}>
        {t("locker.brandFooterSub", {
          defaultValue: "Clips, game plans & session assets — synced across devices.",
        })}
      </Text>
    </View>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      wrap: {
        alignItems: "center",
        paddingTop: space.lg,
        paddingBottom: space.md,
        marginTop: space.sm,
      },
      art: {
        width: 132,
        height: 132,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: space.sm,
      },
      iconBadge: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: palette.brandSubtle,
        borderWidth: 1,
        borderColor: palette.brandAccentSubtle,
      },
      iconColor: { color: palette.brandNavy },
      title: {
        ...typography.titleSm,
        color: palette.text,
        fontWeight: "700",
        textAlign: "center",
      },
      sub: {
        ...typography.caption,
        color: palette.textMuted,
        textAlign: "center",
        marginTop: 4,
        paddingHorizontal: space.lg,
        lineHeight: 18,
      },
      orbColor: { color: palette.brandAccent },
    })
  );
}
