import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { radii, space, useStaticStyles, useThemeColors } from "../../../../theme";
import { INSTANT_LESSON_DURATIONS } from "../constants";
import { useSharedStepStyles } from "../sharedStepStyles";
import { PricingBreakdownSummary } from "../../../payments/PricingBreakdownSummary";
import type { PricingQuote } from "../../../payments/pricingTypes";
import { chargeTotalDollars } from "../../../payments/pricingTypes";

type PromoResultShape = {
  valid: boolean;
  discount_amount?: number;
  final_amount?: number;
  display_label?: string;
};

type Props = {
  trainerName: string;
  durationMinutes: number;
  selectedClipIds: string[];
  couponCode: string;
  expectedPrice: number;
  promoResult: PromoResultShape | null;
  chargingPrice: number;
  pricingQuote?: PricingQuote | null;
  isSubmitting: boolean;
  onSubmit: () => void;
};

export function WizardStepConfirm({
  trainerName,
  durationMinutes,
  selectedClipIds,
  couponCode,
  expectedPrice,
  promoResult,
  chargingPrice,
  pricingQuote,
  isSubmitting,
  onSubmit,
}: Props) {
  const c = useThemeColors();
  const sharedStepStyles = useSharedStepStyles();
  const styles = useConfirmStyles();
  const lengthLabel =
    INSTANT_LESSON_DURATIONS.find((d) => d.minutes === durationMinutes)?.label ?? `${durationMinutes} min`;

  return (
    <View style={sharedStepStyles.card}>
      <Text style={sharedStepStyles.sectionTitle}>Review & send</Text>
      <View style={styles.summaryBox}>
        <View style={styles.summaryLine}>
          <Text style={styles.summaryKey}>Coach</Text>
          <Text style={styles.summaryValue}>{trainerName}</Text>
        </View>
        <View style={styles.summaryLine}>
          <Text style={styles.summaryKey}>Length</Text>
          <Text style={styles.summaryValue}>{lengthLabel}</Text>
        </View>
        <View style={styles.summaryLine}>
          <Text style={styles.summaryKey}>Clips</Text>
          <Text style={styles.summaryValue}>
            {selectedClipIds.length === 0 ? "None" : `${selectedClipIds.length} selected`}
          </Text>
        </View>
        {promoResult?.valid && (promoResult.discount_amount ?? 0) > 0 ? (
          <>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryKey}>Subtotal</Text>
              <Text style={styles.summaryValue}>${expectedPrice.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryKey}>Discount</Text>
              <Text style={[styles.summaryValue, { color: c.success }]}>
                -${(promoResult.discount_amount ?? 0).toFixed(2)}
              </Text>
            </View>
          </>
        ) : null}
        {couponCode.trim() ? (
          <View style={styles.summaryLine}>
            <Text style={styles.summaryKey}>Promo</Text>
            <Text style={styles.summaryValue}>{couponCode.trim()}</Text>
          </View>
        ) : null}
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
      <Text style={sharedStepStyles.muted}>
        We create the instant booking, attach any clips you choose, then send the request to the coach.
      </Text>

      <Pressable
        style={[sharedStepStyles.primaryBtn, isSubmitting && sharedStepStyles.btnDisabled]}
        disabled={isSubmitting}
        onPress={onSubmit}
      >
        {isSubmitting ? (
          <ActivityIndicator color={c.brandTextOn} />
        ) : (
          <>
            <Ionicons name="flash" size={18} color={c.brandTextOn} />
            <Text style={sharedStepStyles.primaryBtnText}>Send request to coach</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

function useConfirmStyles() {
  return useStaticStyles((palette) =>
    StyleSheet.create({
      summaryBox: {
        backgroundColor: palette.surfaceMuted,
        borderRadius: radii.md,
        padding: space.md,
        gap: 8,
        marginTop: 4,
      },
      summaryLine: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
      },
      summaryKey: { fontSize: 15, fontWeight: "700", color: palette.iconPrimary, width: 76 },
      summaryValue: { flex: 1, fontSize: 15, color: palette.text },
    })
  );
}
