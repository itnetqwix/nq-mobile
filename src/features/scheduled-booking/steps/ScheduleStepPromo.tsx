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
import { radii, space, typography, useStaticStyles, useThemeColors } from "../../../theme";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import {
  ScheduleActionFooter,
  ScheduleSection,
  ScheduleSessionSummary,
  ScheduleStepHero,
} from "../components/ScheduleStepChrome";

type PromoResult = {
  valid: boolean;
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
  couponCode: string;
  onCouponCodeChange: (v: string) => void;
  couponError: string;
  onCouponErrorClear: () => void;
  promoValidating: boolean;
  promoResult: PromoResult;
  onApplyPromo: (code?: string) => void;
  onRemovePromo: () => void;
  visiblePromos: VisiblePromo[];
  expectedPrice: number;
  sessionTimeSummary?: string;
  onNext: () => void;
  onSkip: () => void;
};

export function ScheduleStepPromo({
  couponCode,
  onCouponCodeChange,
  couponError,
  onCouponErrorClear,
  promoValidating,
  promoResult,
  onApplyPromo,
  onRemovePromo,
  visiblePromos,
  expectedPrice,
  sessionTimeSummary,
  onNext,
  onSkip,
}: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();

  const appliedTotal = (promoResult?.final_amount ?? expectedPrice).toFixed(2);

  const promoChipLabel = (p: VisiblePromo) =>
    p.display_label ||
    (p.discount_type === "percentage"
      ? t("scheduledBooking.promo.percentOff", { value: p.discount_value })
      : t("scheduledBooking.promo.amountOff", { value: `$${p.discount_value}` }));

  return (
    <View testID="schedule-step-promo" style={styles.root}>
      <ScheduleStepHero
        title={t("scheduledBooking.promo.title")}
        subtitle={t("scheduledBooking.promo.subtitle")}
        badge={t("scheduledBooking.promo.optional")}
      />

      {sessionTimeSummary ? (
        <ScheduleSessionSummary
          icon="calendar-outline"
          value={sessionTimeSummary}
          hint={`${t("scheduledBooking.promo.sessionSubtotal")}: $${expectedPrice.toFixed(2)}`}
        />
      ) : (
        <ScheduleSessionSummary
          icon="cash-outline"
          value={`${t("scheduledBooking.promo.sessionSubtotal")}: $${expectedPrice.toFixed(2)}`}
        />
      )}

      <ScheduleSection title={t("scheduledBooking.promo.enterCode")}>
        <View style={styles.inputCard}>
          <View style={styles.promoRow}>
            <TextInput
              value={couponCode}
              onChangeText={(text) => {
                onCouponCodeChange(text);
                onCouponErrorClear();
              }}
              editable={!promoResult}
              placeholder={t("scheduledBooking.promo.placeholder")}
              placeholderTextColor={c.textMuted}
              style={[styles.input, couponError ? styles.inputError : null]}
              autoCapitalize="characters"
              accessibilityLabel={t("scheduledBooking.promo.placeholder")}
            />
            {promoResult ? (
              <Pressable style={styles.applyBtn} onPress={onRemovePromo}>
                <Text style={styles.applyBtnText}>{t("scheduledBooking.promo.remove")}</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.applyBtn, promoValidating && styles.applyBtnDisabled]}
                onPress={() => onApplyPromo()}
                disabled={promoValidating}
              >
                {promoValidating ? (
                  <ActivityIndicator color={c.brandTextOn} size="small" />
                ) : (
                  <Text style={styles.applyBtnText}>{t("scheduledBooking.promo.apply")}</Text>
                )}
              </Pressable>
            )}
          </View>
          {couponError ? <Text style={styles.errorText}>{couponError}</Text> : null}
          {promoResult?.valid ? (
            <View style={styles.successRow}>
              <Ionicons name="checkmark-circle" size={18} color={c.success} />
              <Text style={styles.successText}>
                {promoResult.display_label
                  ? t("scheduledBooking.promo.appliedWithLabel", {
                      total: `$${appliedTotal}`,
                      label: promoResult.display_label,
                    })
                  : t("scheduledBooking.promo.applied", { total: `$${appliedTotal}` })}
              </Text>
            </View>
          ) : null}
        </View>
      </ScheduleSection>

      {visiblePromos.length > 0 ? (
        <ScheduleSection title={t("scheduledBooking.promo.availableTitle")}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promoList}>
            {visiblePromos.map((p) => {
              const selected = couponCode.trim().toUpperCase() === p.code.toUpperCase();
              return (
                <Pressable
                  key={p.code}
                  style={[styles.promoChip, selected && styles.promoChipOn]}
                  onPress={() => {
                    onCouponCodeChange(p.code);
                    onCouponErrorClear();
                    if (!promoResult) onApplyPromo(p.code);
                  }}
                  disabled={promoValidating || !!promoResult}
                  accessibilityRole="button"
                  accessibilityHint={t("scheduledBooking.promo.tapToApply")}
                >
                  <Text style={[styles.promoChipCode, selected && styles.promoChipCodeOn]}>{p.code}</Text>
                  <Text style={[styles.promoChipLabel, selected && styles.promoChipLabelOn]}>
                    {promoChipLabel(p)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </ScheduleSection>
      ) : null}

      <ScheduleActionFooter
        testID="schedule-promo-continue"
        label={t("scheduledBooking.promo.continue")}
        onPress={onNext}
      />

      <Pressable testID="schedule-promo-skip" style={styles.skipBtn} onPress={onSkip}>
        <Text style={styles.skipText}>{t("scheduledBooking.promo.skip")}</Text>
      </Pressable>
    </View>
  );
}

function useStyles() {
  return useStaticStyles((palette) =>
    StyleSheet.create({
      root: { gap: space.lg, paddingBottom: space.md },
      inputCard: {
        padding: space.md,
        borderRadius: radii.lg,
        backgroundColor: palette.surfaceElevated,
        borderWidth: 1,
        borderColor: palette.border,
        gap: space.sm,
      },
      promoRow: { flexDirection: "row", gap: 8, alignItems: "center" },
      input: {
        flex: 1,
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: radii.md,
        padding: space.md,
        backgroundColor: palette.input,
        color: palette.text,
        fontSize: 16,
        fontWeight: "600",
      },
      inputError: { borderColor: palette.danger },
      applyBtn: {
        backgroundColor: palette.brandNavy,
        borderRadius: radii.md,
        paddingHorizontal: 16,
        paddingVertical: 14,
        minWidth: 88,
        alignItems: "center",
      },
      applyBtnDisabled: { opacity: 0.6 },
      applyBtnText: { color: palette.brandTextOn, fontWeight: "700" },
      errorText: { color: palette.danger, fontSize: 13 },
      successRow: { flexDirection: "row", alignItems: "center", gap: 6 },
      successText: { color: palette.success, fontWeight: "600", flex: 1 },
      promoList: { gap: 8, paddingVertical: space.xs },
      promoChip: {
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: radii.lg,
        backgroundColor: palette.surfaceMuted,
        borderWidth: 1.5,
        borderColor: palette.border,
        minWidth: 120,
      },
      promoChipOn: {
        backgroundColor: palette.brandNavy,
        borderColor: palette.brandNavy,
      },
      promoChipCode: { fontWeight: "800", color: palette.text, fontSize: 15 },
      promoChipCodeOn: { color: palette.brandTextOn },
      promoChipLabel: { fontSize: 12, color: palette.textMuted, marginTop: 4 },
      promoChipLabelOn: { color: palette.brandTextOn + "CC" },
      skipBtn: {
        alignItems: "center",
        paddingVertical: space.sm,
      },
      skipText: {
        ...typography.bodySm,
        color: palette.textMuted,
        fontWeight: "600",
      },
    })
  );
}
