import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { radii, space, useStaticStyles, useThemeColors } from "../../../theme";
import { useSharedStepStyles } from "../../instant-lesson/booking-wizard/sharedStepStyles";
import { PricingBreakdownSummary } from "../../payments/PricingBreakdownSummary";
import type { PricingQuote } from "../../payments/pricingTypes";
import { chargeTotalDollars } from "../../payments/pricingTypes";

type PromoResult = {
  valid: boolean;
  discount_amount?: number;
  final_amount?: number;
  display_label?: string;
} | null;

type Props = {
  trainerName: string;
  sessionTimeSummary: string;
  trainerTimeLabel: string | null;
  durationMinutes: number;
  expectedPrice: number;
  promoResult: PromoResult;
  chargingPrice: number;
  pricingQuote?: PricingQuote | null;
  couponCode: string;
  selectedClipIds: string[];
  isSubmitting: boolean;
  onSubmit: () => void;
};

export function ScheduleStepConfirm({
  trainerName,
  sessionTimeSummary,
  trainerTimeLabel,
  durationMinutes,
  expectedPrice,
  promoResult,
  chargingPrice,
  pricingQuote,
  couponCode,
  selectedClipIds,
  isSubmitting,
  onSubmit,
}: Props) {
  const c = useThemeColors();
  const shared = useSharedStepStyles();
  const styles = useStyles();

  return (
    <View style={shared.card}>
      <Text style={shared.sectionTitle}>Review & request</Text>
      <View style={styles.summaryBox}>
        <Row label="Coach" value={trainerName} />
        <Row label="When" value={sessionTimeSummary} />
        {trainerTimeLabel ? <Row label="Trainer time" value={trainerTimeLabel} /> : null}
        <Row label="Duration" value={`${durationMinutes} minutes`} />
        <Row
          label="Clips"
          value={selectedClipIds.length === 0 ? "None" : `${selectedClipIds.length} selected`}
        />
        {promoResult?.valid && (promoResult.discount_amount ?? 0) > 0 ? (
          <>
            <Row label="Subtotal" value={`$${expectedPrice.toFixed(2)}`} />
            <Row
              label="Discount"
              value={`-$${(promoResult.discount_amount ?? 0).toFixed(2)}`}
              valueStyle={{ color: c.success }}
            />
          </>
        ) : null}
        {couponCode.trim() ? <Row label="Promo" value={couponCode.trim()} /> : null}
      </View>
      <PricingBreakdownSummary
        sessionSubtotal={expectedPrice}
        pricingQuote={pricingQuote}
        chargeTotal={
          chargeTotalDollars(pricingQuote) ?? (chargingPrice > 0 ? chargingPrice : undefined)
        }
        promoDiscount={
          promoResult?.valid ? promoResult.discount_amount : undefined
        }
        promoLabel={promoResult?.display_label}
      />
      <Text style={shared.muted}>
        Your coach must confirm this request before the session is scheduled. You will see it as
        awaiting confirmation in Upcoming.
      </Text>
      <Pressable
        style={[shared.primaryBtn, isSubmitting && shared.btnDisabled]}
        disabled={isSubmitting}
        onPress={onSubmit}
      >
        {isSubmitting ? (
          <ActivityIndicator color={c.brandTextOn} />
        ) : (
          <>
            <Ionicons name="calendar-outline" size={18} color={c.brandTextOn} />
            <Text style={shared.primaryBtnText}>Request session</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

function Row({
  label,
  value,
  bold,
  valueStyle,
}: {
  label: string;
  value: string;
  bold?: boolean;
  valueStyle?: object;
}) {
  const styles = useStyles();
  return (
    <View style={styles.summaryLine}>
      <Text style={styles.summaryKey}>{label}</Text>
      <Text style={[styles.summaryValue, bold && styles.bold, valueStyle]}>{value}</Text>
    </View>
  );
}

function useStyles() {
  return useStaticStyles((palette) =>
    StyleSheet.create({
      summaryBox: {
        backgroundColor: palette.surfaceMuted,
        borderRadius: radii.md,
        padding: space.md,
        gap: 8,
      },
      summaryLine: { flexDirection: "row", gap: 12 },
      summaryKey: { fontSize: 15, fontWeight: "700", color: palette.iconPrimary, width: 100 },
      summaryValue: { flex: 1, fontSize: 15, color: palette.text },
      bold: { fontWeight: "700" },
    })
  );
}
