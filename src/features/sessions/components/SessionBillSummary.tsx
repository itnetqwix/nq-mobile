/**
 * SessionBillSummary
 * ------------------
 * Swiggy-style detailed bill breakdown shown to trainees after a session.
 * Mirrors the visual pattern: line items → divider → Grand Total → discounts → To Pay → savings strip.
 */

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { radii, space, useThemeColors } from "../../../theme";

type Extension = {
  minutes: number;
  amount: number;
  status: string;
};

type Props = {
  /** Base session price (dollars). */
  sessionAmount: number;
  /** Duration booked (minutes). */
  durationMinutes?: number | null;
  /** Platform fee (dollars). */
  platformFee?: number | null;
  /** Payment processing fee (dollars). */
  processingFee?: number | null;
  /** Tax amount (dollars). */
  tax?: number | null;
  /** Promo/coupon discount (dollars, positive). */
  promoDiscount?: number | null;
  /** Code used (e.g. "NEWMEAL"). */
  promoCode?: string | null;
  /** Referral first-lesson discount (dollars, positive). */
  referralDiscount?: number | null;
  /** Paid extension line items. */
  extensions?: Extension[];
  /** Final amount actually charged (dollars). If null, computed from above. */
  chargeTotal?: number | null;
  currency?: string;
};

function fmt(amount: number, currency = "$") {
  return `${currency}${amount.toFixed(2)}`;
}

export function SessionBillSummary({
  sessionAmount,
  durationMinutes,
  platformFee,
  processingFee,
  tax,
  promoDiscount,
  promoCode,
  referralDiscount,
  extensions = [],
  chargeTotal,
  currency = "$",
}: Props) {
  const c = useThemeColors();

  const sessionLabel = durationMinutes
    ? `Session (${durationMinutes} min)`
    : "Session fee";

  const appliedExtensions = extensions.filter(
    (e) => e.status === "applied" && e.amount > 0
  );

  // Compute grand total (before discounts)
  const grandTotal =
    sessionAmount +
    (platformFee ?? 0) +
    (processingFee ?? 0) +
    (tax ?? 0) +
    appliedExtensions.reduce((s, e) => s + e.amount, 0);

  const totalDiscounts = (promoDiscount ?? 0) + (referralDiscount ?? 0);

  const toPay = chargeTotal != null ? chargeTotal : Math.max(0, grandTotal - totalDiscounts);

  const hasFees = !!(platformFee || processingFee || tax);
  const hasDiscounts = totalDiscounts > 0;

  return (
    <View style={[styles.container, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}>
      {/* Header */}
      <Text style={[styles.heading, { color: c.text }]}>Bill Summary</Text>

      {/* ── Line items ── */}
      <BillRow
        label={sessionLabel}
        value={fmt(sessionAmount, currency)}
        c={c}
      />

      {appliedExtensions.map((ext, i) => (
        <BillRow
          key={`ext-${i}`}
          label={`+${ext.minutes} min extension`}
          value={fmt(ext.amount, currency)}
          c={c}
          muted
        />
      ))}

      {platformFee ? (
        <BillRow
          label="Platform fee"
          value={fmt(platformFee, currency)}
          c={c}
          muted
        />
      ) : null}

      {processingFee ? (
        <BillRow
          label="Payment processing"
          value={fmt(processingFee, currency)}
          c={c}
          muted
        />
      ) : null}

      {tax ? (
        <BillRow
          label="Taxes & charges"
          value={fmt(tax, currency)}
          c={c}
          muted
        />
      ) : null}

      {/* ── Divider + Grand Total ── */}
      <View style={[styles.divider, { borderColor: c.border }]} />

      <BillRow
        label="Grand Total"
        value={fmt(grandTotal, currency)}
        c={c}
        bold
      />

      {/* ── Discounts ── */}
      {promoDiscount && promoDiscount > 0 ? (
        <BillRow
          label={promoCode ? `Coupon  (${promoCode})` : "Coupon discount"}
          value={`- ${fmt(promoDiscount, currency)}`}
          c={c}
          accent
        />
      ) : null}

      {referralDiscount && referralDiscount > 0 ? (
        <BillRow
          label="Referral discount"
          value={`- ${fmt(referralDiscount, currency)}`}
          c={c}
          accent
        />
      ) : null}

      {/* ── To Pay ── */}
      <View style={[styles.toPayRow, { borderTopColor: c.border }]}>
        <Text style={[styles.toPayLabel, { color: c.text }]}>To Pay</Text>
        <Text style={[styles.toPayValue, { color: c.text }]}>
          {fmt(toPay, currency)}
        </Text>
      </View>

      {/* ── Savings strip ── */}
      {hasDiscounts ? (
        <View style={[styles.savingsStrip, { backgroundColor: c.brandAccentSubtle ?? "#e8f5e9" }]}>
          <Ionicons name="pricetag" size={13} color={c.success ?? "#2e7d32"} />
          <Text style={[styles.savingsText, { color: c.success ?? "#2e7d32" }]}>
            {`You saved ${fmt(totalDiscounts, currency)} on this session`}
          </Text>
        </View>
      ) : null}

      {/* ── Footnote ── */}
      {hasFees ? (
        <Text style={[styles.footnote, { color: c.textMuted }]}>
          Platform and processing fees support secure payments and platform maintenance.
        </Text>
      ) : null}
    </View>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

type RowProps = {
  label: string;
  value: string;
  c: ReturnType<typeof useThemeColors>;
  bold?: boolean;
  muted?: boolean;
  accent?: boolean;
};

function BillRow({ label, value, c, bold, muted, accent }: RowProps) {
  return (
    <View style={styles.row}>
      <Text
        style={[
          styles.rowLabel,
          { color: muted ? c.textMuted : c.text },
          bold && styles.boldText,
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.rowValue,
          { color: accent ? (c.success ?? "#2e7d32") : muted ? c.textMuted : c.text },
          bold && styles.boldText,
          accent && styles.accentText,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginTop: space.sm,
  },
  heading: {
    fontSize: 17,
    fontWeight: "800",
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.sm,
    letterSpacing: -0.2,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingVertical: 9,
  },
  rowLabel: {
    fontSize: 14,
    flex: 1,
    paddingRight: 8,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  boldText: {
    fontWeight: "700",
    fontSize: 15,
  },
  accentText: {
    fontWeight: "700",
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginHorizontal: space.md,
    marginVertical: 4,
  },
  toPayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingVertical: 12,
    borderTopWidth: 1.5,
    marginTop: 4,
  },
  toPayLabel: {
    fontSize: 16,
    fontWeight: "800",
  },
  toPayValue: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  savingsStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 10,
  },
  savingsText: {
    fontSize: 13,
    fontWeight: "700",
  },
  footnote: {
    fontSize: 11,
    paddingHorizontal: space.md,
    paddingBottom: space.md,
    paddingTop: 4,
    lineHeight: 16,
  },
});
