import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";

type Item = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
};

/**
 * Trainee-facing copy for how wallet balance, escrow, PIN, and refunds work.
 */
export function WalletPaymentExplainer() {
  const { t } = useTranslation();
  const c = useThemeColors();
  const styles = useStyles();

  const items: Item[] = [
    {
      icon: "shield-checkmark-outline",
      title: t("wallet.explainer.escrowTitle", { defaultValue: "Escrow protection" }),
      text: t("wallet.explainer.escrowText", {
        defaultValue:
          "Lesson payments are held in escrow until the session completes. Your coach is paid only after the lesson ends and ratings are in.",
      }),
    },
    {
      icon: "lock-closed-outline",
      title: t("wallet.explainer.pinTitle", { defaultValue: "Wallet PIN" }),
      text: t("wallet.explainer.pinText", {
        defaultValue:
          "Set a PIN under Wallet security for larger payments and withdrawals. You may be asked to verify before booking or topping up.",
      }),
    },
    {
      icon: "return-down-back-outline",
      title: t("wallet.explainer.refundTitle", { defaultValue: "Cancellations & refunds" }),
      text: t("wallet.explainer.refundText", {
        defaultValue:
          "If a coach declines or you cancel before confirmation, funds return to your wallet or card automatically. Track status in Activity.",
      }),
    },
  ];

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>
        {t("wallet.explainer.heading", { defaultValue: "How payments work" })}
      </Text>
      {items.map((item) => (
        <View key={item.title} style={styles.row}>
          <View style={[styles.icon, { backgroundColor: c.brandSubtle }]}>
            <Ionicons name={item.icon} size={20} color={c.brandNavy} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.text}>{item.text}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      wrap: {
        marginTop: space.md,
        marginBottom: space.md,
        padding: space.md,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surfaceElevated,
        gap: space.md,
      },
      heading: { ...typography.subtitle, fontWeight: "700", color: palette.text },
      row: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
      icon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
      },
      title: { ...typography.bodyMd, fontWeight: "700", color: palette.text },
      text: { ...typography.bodySm, color: palette.textMuted, marginTop: 2, lineHeight: 18 },
    })
  );
}
