import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTranslation } from "../../i18n/useAppTranslation";
import { radii, space, useStaticStyles, useThemeColors } from "../../theme";
import { useActiveCurrency, useCurrencyFormatter } from "../../lib/intl";
import type { PricingQuote } from "./pricingTypes";
import { chargeTotalDollars, feeRowsFromQuote } from "./pricingTypes";
import { pricingChargeInfoI18nKey } from "./pricingChargeInfo";

type Props = {
  sessionSubtotal: number;
  pricingQuote?: PricingQuote | null;
  /** Shown when no quote yet (e.g. duration preview). */
  chargeTotal?: number;
  currency?: string;
  promoDiscount?: number;
  promoLabel?: string;
  showSubtotalWhenNoFees?: boolean;
  /** Mixed pay: wallet portion of charge total. */
  walletPortionDollars?: number;
};

export function PricingBreakdownSummary({
  sessionSubtotal,
  pricingQuote,
  chargeTotal,
  currency = "USD",
  promoDiscount,
  promoLabel,
  showSubtotalWhenNoFees = true,
  walletPortionDollars,
}: Props) {
  const { t } = useAppTranslation();
  const styles = useStyles();
  const activeCurrency = useActiveCurrency(currency);
  const fmt = useCurrencyFormatter();
  const fees = feeRowsFromQuote(pricingQuote);
  const total =
    chargeTotalDollars(pricingQuote) ??
    (chargeTotal != null ? chargeTotal : sessionSubtotal);
  const hasFees = fees.length > 0;
  const hasPromo = (promoDiscount ?? 0) > 0;
  const walletPortion =
    walletPortionDollars ??
    (pricingQuote?.walletPortionCents != null
      ? pricingQuote.walletPortionCents / 100
      : undefined);
  const cardPortion =
    pricingQuote?.cardPortionCents != null
      ? pricingQuote.cardPortionCents / 100
      : walletPortion != null && total > 0
        ? Math.max(0, total - walletPortion)
        : undefined;

  const showChargeInfo = (infoKey: string) => {
    const i18nKey = pricingChargeInfoI18nKey(infoKey);
    if (!i18nKey) return;
    Alert.alert(
      t(`${i18nKey}.title`),
      t(`${i18nKey}.body`)
    );
  };

  return (
    <View style={styles.box}>
      {showSubtotalWhenNoFees || hasFees || hasPromo ? (
        <Line
          label={t("pricing.breakdown.sessionSubtotal")}
          value={
            sessionSubtotal > 0
              ? fmt(sessionSubtotal, { currency: activeCurrency })
              : t("pricing.breakdown.free")
          }
          infoKey="sessionSubtotal"
          onInfo={showChargeInfo}
        />
      ) : null}
      {hasPromo ? (
        <Line
          label={t("pricing.breakdown.discount")}
          value={`-${fmt(promoDiscount!, { currency: activeCurrency })}${promoLabel ? ` (${promoLabel})` : ""}`}
          valueAccent
          infoKey="discount"
          onInfo={showChargeInfo}
        />
      ) : null}
      {fees.map((row) => (
        <Line
          key={row.key}
          label={row.label}
          value={fmt(row.amountMinor / 100, { currency: activeCurrency })}
          infoKey={row.key}
          onInfo={showChargeInfo}
        />
      ))}
      {walletPortion != null && walletPortion > 0 && cardPortion != null && cardPortion > 0 ? (
        <>
          <Line
            label={t("pricing.breakdown.walletPortion")}
            value={fmt(walletPortion, { currency: activeCurrency })}
            infoKey="wallet_portion"
            onInfo={showChargeInfo}
          />
          <Line
            label={t("pricing.breakdown.cardPortion")}
            value={fmt(cardPortion, { currency: activeCurrency })}
            infoKey="card_portion"
            onInfo={showChargeInfo}
          />
        </>
      ) : null}
      <Line
        label={t("pricing.breakdown.totalCharged")}
        value={total > 0 ? fmt(total, { currency: activeCurrency }) : t("pricing.breakdown.free")}
        bold
        infoKey="totalCharged"
        onInfo={showChargeInfo}
      />
      {hasFees ? (
        <Text style={styles.hint}>{t("pricing.breakdown.feesHint")}</Text>
      ) : null}
    </View>
  );
}

function Line({
  label,
  value,
  bold,
  valueAccent,
  infoKey,
  onInfo,
}: {
  label: string;
  value: string;
  bold?: boolean;
  valueAccent?: boolean;
  infoKey?: string;
  onInfo?: (key: string) => void;
}) {
  const c = useThemeColors();
  const styles = useStyles();
  const showInfo = infoKey && onInfo && pricingChargeInfoI18nKey(infoKey);

  return (
    <View style={styles.line}>
      <View style={styles.labelRow}>
        <Text style={[styles.key, bold && styles.bold]}>{label}</Text>
        {showInfo ? (
          <Pressable
            onPress={() => onInfo!(infoKey!)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Learn more about ${label}`}
            style={styles.infoBtn}
          >
            <Ionicons name="information-circle-outline" size={16} color={c.brandNavy} />
          </Pressable>
        ) : null}
      </View>
      <Text
        style={[
          styles.value,
          bold && styles.bold,
          valueAccent && styles.accent,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function useStyles() {
  return useStaticStyles((palette) =>
    StyleSheet.create({
      box: {
        backgroundColor: palette.surfaceMuted,
        borderRadius: radii.md,
        padding: space.md,
        gap: 8,
      },
      line: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
      labelRow: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
      },
      key: { flex: 1, fontSize: 14, color: palette.textMuted },
      infoBtn: { padding: 2 },
      value: { fontSize: 14, color: palette.text, fontWeight: "500", maxWidth: "42%" },
      bold: { fontWeight: "700", color: palette.text },
      accent: { color: palette.success },
      hint: {
        fontSize: 12,
        color: palette.textMuted,
        marginTop: 4,
      },
    })
  );
}
