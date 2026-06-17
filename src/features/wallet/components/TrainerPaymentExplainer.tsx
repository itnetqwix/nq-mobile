import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";

/**
 * Trainer-facing copy for earnings, escrow release, refunds, and payouts.
 */
export function TrainerPaymentExplainer() {
  const { t } = useTranslation();
  const c = useThemeColors();
  const styles = useStyles();

  const items = [
    {
      icon: "hourglass-outline" as const,
      title: t("wallet.trainerExplainer.escrowTitle", { defaultValue: "Session escrow" }),
      text: t("wallet.trainerExplainer.escrowText", {
        defaultValue:
          "Trainee payments sit in escrow until the lesson ends and both parties rate. Then funds move to your available balance.",
      }),
    },
    {
      icon: "return-down-back-outline" as const,
      title: t("wallet.trainerExplainer.refundTitle", { defaultValue: "Cancellations" }),
      text: t("wallet.trainerExplainer.refundText", {
        defaultValue:
          "If you decline or a session is cancelled before it starts, the trainee is refunded automatically from escrow.",
      }),
    },
    {
      icon: "cash-outline" as const,
      title: t("wallet.trainerExplainer.payoutTitle", { defaultValue: "Getting paid out" }),
      text: t("wallet.trainerExplainer.payoutText", {
        defaultValue:
          "Connect your bank via Stripe, choose fast wallet or standard bank payout, then withdraw from available earnings.",
      }),
    },
  ];

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>
        {t("wallet.trainerExplainer.heading", { defaultValue: "Earnings & payouts" })}
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
