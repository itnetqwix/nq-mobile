import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { radii, space, useStaticStyles, useThemeColors } from "../../../../theme";
import { INSTANT_LESSON_DURATIONS } from "../constants";
import { useSharedStepStyles } from "../sharedStepStyles";
import { PricingBreakdownSummary } from "../../../payments/PricingBreakdownSummary";
import type { PricingQuote } from "../../../payments/pricingTypes";
import { chargeTotalDollars } from "../../../payments/pricingTypes";

type PromoResult = {
  valid: boolean;
  discount_type?: string;
  discount_value?: number;
  discount_amount?: number;
  final_amount?: number;
  display_label?: string;
} | null;

type VisiblePromo = {
  code: string;
  display_label?: string;
  discount_type: string;
  discount_value: number;
};

type Props = {
  durationMinutes: number;
  onDurationChange: (minutes: number) => void;
  couponCode: string;
  onCouponCodeChange: (value: string) => void;
  couponError: string;
  onCouponErrorClear: () => void;
  onNext: () => void;
  promoValidating?: boolean;
  promoResult?: PromoResult;
  onApplyPromo?: () => void;
  onRemovePromo?: () => void;
  visiblePromos?: VisiblePromo[];
  expectedPrice?: number;
  durationPreviewQuote?: PricingQuote | null;
  eligibility?: { eligible: boolean; reasons: string[]; totalWindowMinutes?: number } | null;
  eligibilityLoading?: boolean;
};

export function WizardStepDuration({
  durationMinutes,
  onDurationChange,
  couponCode,
  onCouponCodeChange,
  couponError,
  onCouponErrorClear,
  onNext,
  promoValidating,
  promoResult,
  onApplyPromo,
  onRemovePromo,
  visiblePromos = [],
  expectedPrice = 0,
  durationPreviewQuote,
  eligibility,
  eligibilityLoading,
}: Props) {
  const c = useThemeColors();
  const sharedStepStyles = useSharedStepStyles();
  const styles = useDurationStyles();
  return (
    <View style={sharedStepStyles.card}>
      <Text style={sharedStepStyles.sectionTitle}>Select lesson duration</Text>
      <View style={styles.durationGrid}>
        {INSTANT_LESSON_DURATIONS.map((opt) => {
          const on = durationMinutes === opt.minutes;
          return (
            <Pressable
              key={opt.minutes}
              style={[styles.durationTile, on && styles.durationTileOn]}
              onPress={() => onDurationChange(opt.minutes)}
            >
              <Text style={[styles.durationLabel, on && styles.durationLabelOn]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {eligibilityLoading ? (
        <ActivityIndicator color={c.brandNavy} style={{ marginVertical: space.sm }} />
      ) : eligibility && !eligibility.eligible ? (
        <View style={styles.eligibilityBox}>
          <Text style={styles.eligibilityTitle}>Not available right now</Text>
          {eligibility.reasons.map((r) => (
            <Text key={r} style={styles.eligibilityReason}>
              • {r}
            </Text>
          ))}
        </View>
      ) : eligibility?.eligible && eligibility.totalWindowMinutes ? (
        <Text style={styles.eligibilityOk}>
          Coach is available. Lesson: {durationMinutes} min
        </Text>
   
      ) : null}

      <Text style={[sharedStepStyles.sectionTitle, styles.promoTitle]}>Promo code (optional)</Text>
      <View style={styles.promoRow}>
        <TextInput
          value={couponCode}
          onChangeText={(t) => {
            onCouponCodeChange(t);
            onCouponErrorClear();
          }}
          editable={!promoResult}
          placeholder="Enter promo code"
          placeholderTextColor={c.textMuted}
          style={[
            styles.input,
            { flex: 1 },
            couponError ? styles.inputError : null,
            promoResult ? styles.inputSuccess : null,
          ]}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={50}
        />
        {promoResult ? (
          <Pressable style={styles.removeBtn} onPress={onRemovePromo}>
            <Text style={styles.removeBtnText}>Remove</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.applyBtn, (!couponCode.trim() || promoValidating) && styles.applyBtnDisabled]}
            onPress={onApplyPromo}
            disabled={!couponCode.trim() || promoValidating}
          >
            {promoValidating ? (
              <ActivityIndicator size="small" color={c.brandTextOn} />
            ) : (
              <Text style={styles.applyBtnText}>Apply</Text>
            )}
          </Pressable>
        )}
      </View>
      {!!couponError && <Text style={styles.errorText}>{couponError}</Text>}

      {promoResult && (
        <View style={styles.discountCard}>
          <View style={styles.discountRow}>
            <Text style={styles.discountLabel}>Original Price</Text>
            <Text style={[styles.discountLabel, styles.discountPrice]}>${expectedPrice.toFixed(2)}</Text>
          </View>
          <View style={styles.discountRow}>
            <Text style={styles.discountGreen} numberOfLines={1} ellipsizeMode="tail">
              Discount ({promoResult.display_label || couponCode})
            </Text>
            <Text style={[styles.discountGreen, styles.discountPrice]}>
              -${promoResult.discount_amount?.toFixed(2)}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.discountRow}>
            <Text style={styles.discountFinal}>Final Price</Text>
            <Text style={[styles.discountFinal, styles.discountPrice]}>${promoResult.final_amount?.toFixed(2)}</Text>
          </View>
        </View>
      )}

      {visiblePromos.length > 0 && !promoResult && (
        <View style={styles.availableSection}>
          <Text style={styles.availableTitle}>Available Promos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.availableScroll}>
            {visiblePromos.map((p) => (
              <Pressable
                key={p.code}
                style={[styles.promoChip, couponCode === p.code && styles.promoChipActive]}
                onPress={() => onCouponCodeChange(p.code)}
              >
                <Text style={styles.promoChipText}>
                  {p.code}{" "}
                  {p.discount_type === "percentage"
                    ? `(${p.discount_value}% off)`
                    : `($${p.discount_value} off)`}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {expectedPrice > 0 ? (
        <PricingBreakdownSummary
          sessionSubtotal={expectedPrice}
          pricingQuote={durationPreviewQuote}
          chargeTotal={chargeTotalDollars(durationPreviewQuote) ?? expectedPrice}
        />
      ) : null}

      <Pressable
        style={[
          sharedStepStyles.primaryBtn,
          eligibility && !eligibility.eligible ? sharedStepStyles.btnDisabled : null,
        ]}
        onPress={onNext}
        disabled={Boolean(eligibility && !eligibility.eligible)}
      >
        <Text style={sharedStepStyles.primaryBtnText}>Next</Text>
        <Ionicons name="arrow-forward" size={18} color={c.brandTextOn} />
      </Pressable>
    </View>
  );
}

function useDurationStyles() {
  return useStaticStyles((palette) =>
    StyleSheet.create({
      durationGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
      durationTile: {
        width: "47%",
        paddingVertical: 14,
        borderRadius: radii.md,
        borderWidth: 2,
        borderColor: palette.iconPrimary,
        alignItems: "center",
        backgroundColor: palette.surfaceElevated,
      },
      durationTileOn: {
        borderColor: palette.success,
        backgroundColor: palette.successSubtle,
      },
      durationLabel: { fontSize: 15, fontWeight: "700", color: palette.iconPrimary },
      durationLabelOn: { color: palette.success },
      promoTitle: { marginTop: space.lg },
      promoRow: { flexDirection: "row", gap: 8, alignItems: "center" },
      input: {
        flex: 1,
        borderWidth: 2,
        borderColor: palette.borderStrong,
        borderRadius: radii.md,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: palette.text,
        backgroundColor: palette.input,
      },
      inputError: { borderColor: palette.danger },
      inputSuccess: { borderColor: palette.success },
      errorText: { color: palette.danger, fontSize: 13, marginTop: 4 },
      applyBtn: {
        backgroundColor: palette.brandNavy,
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: radii.md,
        justifyContent: "center",
        alignItems: "center",
      },
      applyBtnDisabled: { opacity: 0.5 },
      applyBtnText: { color: palette.brandTextOn, fontWeight: "700", fontSize: 14 },
      removeBtn: {
        backgroundColor: palette.danger,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: radii.md,
        justifyContent: "center",
        alignItems: "center",
      },
      removeBtnText: { color: palette.dangerTextOn, fontWeight: "700", fontSize: 14 },
      discountCard: {
        marginTop: 10,
        padding: 12,
        backgroundColor: palette.successSubtle,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: palette.success,
      },
      discountRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 4,
        gap: 8,
      },
      discountLabel: { flex: 1, color: palette.textMuted, fontSize: 14 },
      discountGreen: { flex: 1, color: palette.success, fontSize: 14, fontWeight: "600" },
      discountPrice: { flex: 0, flexShrink: 0, textAlign: "right", minWidth: 64 },
      divider: { height: 1, backgroundColor: palette.success, marginVertical: 6 },
      discountFinal: { color: palette.iconPrimary, fontSize: 16, fontWeight: "700" },
      availableSection: { marginTop: 12 },
      availableTitle: {
        fontSize: 13,
        color: palette.textMuted,
        fontWeight: "600",
        marginBottom: 8,
      },
      availableScroll: { gap: 8 },
      promoChip: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: palette.iconPrimary,
        backgroundColor: palette.surfaceMuted,
      },
      promoChipActive: { backgroundColor: palette.brandSubtle },
      promoChipText: { fontSize: 13, fontWeight: "600", color: palette.iconPrimary },
      eligibilityBox: {
        marginTop: space.md,
        padding: space.md,
        borderRadius: radii.md,
        backgroundColor: palette.dangerSubtle ?? "#FEE2E2",
        borderWidth: 1,
        borderColor: palette.danger,
      },
      eligibilityTitle: { fontWeight: "700", color: palette.danger, marginBottom: 6 },
      eligibilityReason: { fontSize: 13, color: palette.text, marginBottom: 4 },
      eligibilityOk: {
        marginTop: space.md,
        fontSize: 13,
        color: palette.success,
        fontWeight: "600",
      },
    })
  );
}
