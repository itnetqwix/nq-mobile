import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { radii, space, typography, useStaticStyles, useThemeColors } from "../../../theme";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
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
  const shared = useSharedStepStyles();
  const styles = useStyles();

  const clipsLabel =
    selectedClipIds.length === 0
      ? t("scheduledBooking.confirm.clipsNone")
      : t("scheduledBooking.confirm.clipsCount", { count: selectedClipIds.length });

  return (
    <View testID="schedule-step-confirm" style={styles.root}>
      <Text style={styles.heroTitle}>{t("scheduledBooking.confirm.title")}</Text>

      <View style={styles.summaryBox}>
        <SummaryRow icon="person-outline" label={t("scheduledBooking.confirm.coach")} value={trainerName} />
        <SummaryRow icon="calendar-outline" label={t("scheduledBooking.confirm.when")} value={sessionTimeSummary} />
        {trainerTimeLabel ? (
          <SummaryRow
            icon="globe-outline"
            label={t("scheduledBooking.confirm.trainerTime")}
            value={trainerTimeLabel}
          />
        ) : null}
        <SummaryRow
          icon="time-outline"
          label={t("scheduledBooking.confirm.duration")}
          value={t("scheduledBooking.confirm.durationValue", { minutes: durationMinutes })}
        />
        <SummaryRow icon="videocam-outline" label={t("scheduledBooking.confirm.clips")} value={clipsLabel} />
        {promoResult?.valid && (promoResult.discount_amount ?? 0) > 0 ? (
          <>
            <SummaryRow
              icon="pricetag-outline"
              label={t("scheduledBooking.confirm.subtotal")}
              value={`$${expectedPrice.toFixed(2)}`}
            />
            <SummaryRow
              icon="gift-outline"
              label={t("scheduledBooking.confirm.discount")}
              value={`-$${(promoResult.discount_amount ?? 0).toFixed(2)}`}
              valueColor={c.success}
            />
          </>
        ) : null}
        {couponCode.trim() ? (
          <SummaryRow
            icon="ticket-outline"
            label={t("scheduledBooking.confirm.promo")}
            value={couponCode.trim()}
          />
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

      <View style={styles.pendingBanner}>
        <Ionicons name="information-circle-outline" size={20} color={c.brandNavy} />
        <Text style={styles.pendingText}>{t("scheduledBooking.confirm.pendingNote")}</Text>
      </View>

      <Pressable
        testID="schedule-confirm-submit"
        style={[shared.primaryBtn, isSubmitting && shared.btnDisabled]}
        disabled={isSubmitting}
        onPress={onSubmit}
      >
        {isSubmitting ? (
          <ActivityIndicator color={c.brandTextOn} />
        ) : (
          <>
            <Ionicons name="calendar-outline" size={18} color={c.brandTextOn} />
            <Text style={shared.primaryBtnText}>{t("scheduledBooking.confirm.submit")}</Text>
          </>
        )}
      </Pressable>
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
        <Ionicons name={icon} size={16} color={c.textSecondary} />
      </View>
      <Text style={styles.summaryKey}>{label}</Text>
      <Text style={[styles.summaryValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

function useStyles() {
  return useStaticStyles((palette) =>
    StyleSheet.create({
      root: { gap: space.md },
      heroTitle: {
        ...typography.titleMd,
        color: palette.text,
        fontWeight: "800",
      },
      summaryBox: {
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.lg,
        padding: space.md,
        gap: 12,
        borderWidth: 1,
        borderColor: palette.border,
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
        fontSize: 14,
        fontWeight: "600",
        color: palette.textMuted,
        width: 88,
      },
      summaryValue: {
        flex: 1,
        fontSize: 15,
        fontWeight: "600",
        color: palette.text,
        lineHeight: 20,
      },
      pendingBanner: {
        flexDirection: "row",
        gap: space.sm,
        padding: space.md,
        borderRadius: radii.lg,
        backgroundColor: palette.brandSubtle,
        borderWidth: 1,
        borderColor: palette.brandAccent + "44",
      },
      pendingText: {
        flex: 1,
        ...typography.bodySm,
        color: palette.brandNavy,
        lineHeight: 20,
      },
    })
  );
}
