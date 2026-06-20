import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, space, typography, useThemedStyles } from "../../../theme";
import { navigateToWalletSecurity } from "../../../navigation/navigationRef";

type Props = {
  onSetupPin?: () => void;
};

/** Shown when a wallet payment needs step-up auth but the trainee has no PIN yet. */
export function WalletPinSetupBanner({ onSetupPin }: Props) {
  const styles = useThemedStyles((c) =>
    StyleSheet.create({
      box: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: space.sm,
        padding: space.md,
        borderRadius: radii.md,
        backgroundColor: c.surfaceElevated,
        borderWidth: 1,
        borderColor: c.border,
      },
      textCol: { flex: 1, gap: 4 },
      title: { ...typography.label, color: c.text, fontWeight: "700" },
      body: { ...typography.bodySm, color: c.textMuted, lineHeight: 18 },
      link: { ...typography.label, color: c.brandNavy, fontWeight: "700", marginTop: 4 },
    })
  );

  return (
    <View style={styles.box}>
      <Ionicons name="lock-closed-outline" size={20} color={styles.title.color} />
      <View style={styles.textCol}>
        <Text style={styles.title}>Wallet PIN required</Text>
        <Text style={styles.body}>
          Payments this size need a 6-digit wallet PIN. Create one first, then return to complete
          payment.
        </Text>
        <Pressable
          onPress={() => {
            if (onSetupPin) onSetupPin();
            else navigateToWalletSecurity();
          }}
          accessibilityRole="button"
        >
          <Text style={styles.link}>Set up PIN in Wallet security</Text>
        </Pressable>
      </View>
    </View>
  );
}
