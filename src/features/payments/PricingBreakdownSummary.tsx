import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { radii, space, useStaticStyles } from "../../theme";
import { useActiveCurrency, useCurrencyFormatter } from "../../lib/intl";
import type { PricingQuote } from "./pricingTypes";
import { chargeTotalDollars, feeRowsFromQuote } from "./pricingTypes";

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

  return (
    <View style={styles.box}>
      {showSubtotalWhenNoFees || hasFees || hasPromo ? (
        <Line
          label="Session subtotal"
          value={
            sessionSubtotal > 0
              ? fmt(sessionSubtotal, { currency: activeCurrency })
              : "Free"
          }
        />
      ) : null}
      {hasPromo ? (
        <Line
          label="Discount"
          value={`-${fmt(promoDiscount!, { currency: activeCurrency })}${promoLabel ? ` (${promoLabel})` : ""}`}
          valueAccent
        />
      ) : null}
      {fees.map((row) => (
        <Line
          key={row.key}
          label={row.label}
          value={fmt(row.amountMinor / 100, { currency: activeCurrency })}
        />
      ))}
      {walletPortion != null && walletPortion > 0 && cardPortion != null && cardPortion > 0 ? (
        <>
          <Line
            label="Wallet portion"
            value={fmt(walletPortion, { currency: activeCurrency })}
          />
          <Line
            label="Card portion"
            value={fmt(cardPortion, { currency: activeCurrency })}
          />
        </>
      ) : null}
      <Line
        label="Total charged"
        value={total > 0 ? fmt(total, { currency: activeCurrency }) : "Free"}
        bold
      />
      {hasFees ? (
        <Text style={styles.hint}>
          Includes platform, payment processing, and applicable taxes.
        </Text>
      ) : null}
    </View>
  );
}

function Line({
  label,
  value,
  bold,
  valueAccent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  valueAccent?: boolean;
}) {
  const styles = useStyles();
  return (
    <View style={styles.line}>
      <Text style={styles.key}>{label}</Text>
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
      line: { flexDirection: "row", gap: 12 },
      key: { flex: 1, fontSize: 14, color: palette.textMuted },
      value: { fontSize: 14, color: palette.text, fontWeight: "500" },
      bold: { fontWeight: "700" },
      accent: { color: palette.success },
      hint: {
        fontSize: 12,
        color: palette.textMuted,
        marginTop: 4,
      },
    })
  );
}
