import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";

type Props = {
  daysRemaining: number;
  onCompleteVerification?: () => void;
};

export function GracePeriodBanner({ daysRemaining, onCompleteVerification }: Props) {
  const c = useThemeColors();
  const styles = useStyles();
  const daysLabel = daysRemaining === 1 ? "1 day" : `${daysRemaining} days`;

  return (
    <Pressable
      style={[styles.overlay, styles.wrap] as ViewStyle[]}
      onPress={onCompleteVerification}
      disabled={!onCompleteVerification}
    >
      <Ionicons name="time-outline" size={20} color={c.brand} style={styles.icon} />
      <View style={styles.body}>
        <Text style={styles.title}>Trainer verification</Text>
        <Text style={styles.text}>
          You have {daysLabel} left to complete verification. You can keep using the app until then.
        </Text>
        {onCompleteVerification ? (
          <Text style={styles.link}>Start verification →</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      overlay: {
        position: "absolute",
        top: 52,
        left: 0,
        right: 0,
        zIndex: 50,
        elevation: 8,
      },
      wrap: {
        flexDirection: "row",
        alignItems: "flex-start",
        backgroundColor: palette.brandSubtle,
        borderRadius: radii.md,
        padding: space.md,
        marginHorizontal: space.md,
        borderWidth: 1,
        borderColor: palette.border,
        shadowColor: palette.neutral900,
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      icon: { marginRight: space.sm, marginTop: 2 },
      body: { flex: 1 },
      title: { ...typography.subtitle, color: palette.brand, marginBottom: 4 },
      text: { ...typography.bodySm, color: palette.textSecondary },
      link: {
        ...typography.label,
        color: palette.brand,
        marginTop: space.sm,
        fontWeight: "600",
      },
    })
  );
}
