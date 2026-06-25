import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { radii, space, typography, useStaticStyles, useThemeColors } from "../../../theme";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { useActiveCurrency, useCurrencyFormatter } from "../../../lib/intl";
import { PricingBreakdownSummary } from "../../payments/PricingBreakdownSummary";
import type { PricingQuote } from "../../payments/pricingTypes";
import { chargeTotalDollars } from "../../payments/pricingTypes";
import {
  ScheduleActionFooter,
  ScheduleInfoChip,
  ScheduleStepHero,
} from "../components/ScheduleStepChrome";

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
  promoDiscountAmount?: number;
  promoLabel?: string;
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
  promoDiscountAmount = 0,
  promoLabel,
  chargingPrice,
  pricingQuote,
  couponCode,
  selectedClipIds,
  isSubmitting,
  onSubmit,
}: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();
  const fmt = useCurrencyFormatter();
  const currency = useActiveCurrency();

  const clipsLabel =
    selectedClipIds.length === 0
      ? t("scheduledBooking.confirm.clipsNone")
      : t("scheduledBooking.confirm.clipsCount", { count: selectedClipIds.length });

  return (
    <View testID="schedule-step-confirm" style={styles.root}>
      <ScheduleStepHero
        title={t("scheduledBooking.confirm.title")}
        subtitle={t("scheduledBooking.confirm.subtitle")}
      />

      <View style={styles.summaryBox}>
        <SummaryRow icon="person-outline" label={t("scheduledBooking.confirm.coach")} value={trainerName} />
        <View style={styles.divider} />
        <SummaryRow icon="calendar-outline" label={t("scheduledBooking.confirm.when")} value={sessionTimeSummary} />
        {trainerTimeLabel ? (
          <>
            <View style={styles.divider} />
            <SummaryRow
              icon="globe-outline"
              label={t("scheduledBooking.confirm.trainerTime")}
              value={trainerTimeLabel}
            />
          </>
        ) : null}
        <View style={styles.divider} />
        <SummaryRow
          icon="time-outline"
          label={t("scheduledBooking.confirm.duration")}
          value={t("scheduledBooking.confirm.durationValue", { minutes: durationMinutes })}
        />
        <View style={styles.divider} />
        <SummaryRow icon="videocam-outline" label={t("scheduledBooking.confirm.clips")} value={clipsLabel} />
        {promoResult?.valid && (promoResult.discount_amount ?? 0) > 0 ? (
          <>
            <View style={styles.divider} />
            <SummaryRow
              icon="pricetag-outline"
              label={t("scheduledBooking.confirm.subtotal")}
              value={fmt(expectedPrice, { currency })}
            />
            <SummaryRow
              icon="gift-outline"
              label={t("scheduledBooking.confirm.discount")}
              value={`-${fmt(promoResult.discount_amount ?? 0, { currency })}`}
              valueColor={c.success}
            />
          </>
        ) : null}
        {couponCode.trim() ? (
          <>
            <View style={styles.divider} />
            <SummaryRow
              icon="ticket-outline"
              label={t("scheduledBooking.confirm.promo")}
              value={couponCode.trim()}
            />
          </>
        ) : null}
      </View>

      <PricingBreakdownSummary
        sessionSubtotal={expectedPrice}
        pricingQuote={pricingQuote}
        chargeTotal={
          chargeTotalDollars(pricingQuote) ?? (chargingPrice > 0 ? chargingPrice : undefined)
        }
        promoDiscount={
          promoDiscountAmount > 0
            ? promoDiscountAmount
            : promoResult?.valid
              ? promoResult.discount_amount
              : undefined
        }
        promoLabel={promoLabel ?? promoResult?.display_label}
      />

      <ScheduleInfoChip
        icon="information-circle-outline"
        message={t("scheduledBooking.confirm.pendingNote")}
      />

      <ScheduleActionFooter
        testID="schedule-confirm-submit"
        label={t("scheduledBooking.confirm.submit")}
        onPress={onSubmit}
        disabled={isSubmitting}
        loading={isSubmitting}
      />
    </View>
  );
}

function SummaryRow({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  valueColor?: string;
}) {
  const c = useThemeColors();
  const styles = useStyles();
  return (
    <View style={styles.summaryLine}>
      <View style={styles.summaryIcon}>
        <Ionicons name={icon} size={16} color={c.brandNavy} />
      </View>
      <Text style={styles.summaryKey}>{label}</Text>
      <Text style={[styles.summaryValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

function useStyles() {
  return useStaticStyles((palette) =>
    StyleSheet.create({
      root: { gap: space.lg, paddingBottom: space.md },
      summaryBox: {
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.lg,
        padding: space.md,
        gap: 0,
        borderWidth: 1,
        borderColor: palette.border,
      },
      divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: palette.border,
        marginVertical: 10,
      },
      summaryLine: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
      },
      summaryIcon: {
        width: 22,
        marginTop: 2,
        alignItems: "center",
      },
      summaryKey: {
        fontSize: 13,
        fontWeight: "600",
        color: palette.textMuted,
        width: 84,
      },
      summaryValue: {
        flex: 1,
        fontSize: 15,
        fontWeight: "700",
        color: palette.text,
        lineHeight: 20,
      },
    })
  );
}
