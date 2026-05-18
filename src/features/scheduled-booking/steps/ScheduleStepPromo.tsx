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
import { radii, space, useStaticStyles, useThemeColors } from "../../../theme";
import { useSharedStepStyles } from "../../instant-lesson/booking-wizard/sharedStepStyles";

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
  onApplyPromo: () => void;
  onRemovePromo: () => void;
  visiblePromos: VisiblePromo[];
  expectedPrice: number;
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
  onNext,
  onSkip,
}: Props) {
  const c = useThemeColors();
  const shared = useSharedStepStyles();
  const styles = useStyles();

  return (
    <View style={shared.card}>
      <Text style={shared.sectionTitle}>Promo code (optional)</Text>
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
          style={[styles.input, { flex: 1 }, couponError ? styles.inputError : null]}
          autoCapitalize="characters"
        />
        {promoResult ? (
          <Pressable style={styles.applyBtn} onPress={onRemovePromo}>
            <Text style={styles.applyBtnText}>Remove</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.applyBtn, promoValidating && styles.applyBtnDisabled]}
            onPress={onApplyPromo}
            disabled={promoValidating}
          >
            {promoValidating ? (
              <ActivityIndicator color={c.brandTextOn} size="small" />
            ) : (
              <Text style={styles.applyBtnText}>Apply</Text>
            )}
          </Pressable>
        )}
      </View>
      {couponError ? <Text style={styles.errorText}>{couponError}</Text> : null}
      {promoResult?.valid ? (
        <Text style={styles.successText}>
          Applied! Total: $
          {(promoResult.final_amount ?? expectedPrice).toFixed(2)}
          {promoResult.display_label ? ` (${promoResult.display_label})` : ""}
        </Text>
      ) : null}

      {visiblePromos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.promoList}>
          {visiblePromos.map((p) => (
            <Pressable
              key={p.code}
              style={styles.promoChip}
              onPress={() => {
                onCouponCodeChange(p.code);
                onCouponErrorClear();
              }}
            >
              <Text style={styles.promoChipCode}>{p.code}</Text>
              <Text style={styles.promoChipLabel}>
                {p.display_label ||
                  (p.discount_type === "percentage"
                    ? `${p.discount_value}% off`
                    : `$${p.discount_value} off`)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <Pressable style={shared.primaryBtn} onPress={onNext}>
        <Text style={shared.primaryBtnText}>Continue</Text>
        <Ionicons name="arrow-forward" size={18} color={c.brandTextOn} />
      </Pressable>
      <Pressable style={shared.secondaryBtn} onPress={onSkip}>
        <Text style={shared.secondaryBtnText}>Skip promo</Text>
      </Pressable>
    </View>
  );
}

function useStyles() {
  return useStaticStyles((palette) =>
    StyleSheet.create({
      promoRow: { flexDirection: "row", gap: 8, alignItems: "center" },
      input: {
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: radii.md,
        padding: space.md,
        backgroundColor: palette.input,
        color: palette.text,
      },
      inputError: { borderColor: palette.danger },
      applyBtn: {
        backgroundColor: palette.brandNavy,
        borderRadius: radii.md,
        paddingHorizontal: 16,
        paddingVertical: 14,
      },
      applyBtnDisabled: { opacity: 0.6 },
      applyBtnText: { color: palette.brandTextOn, fontWeight: "700" },
      errorText: { color: palette.danger, fontSize: 13 },
      successText: { color: palette.success, fontWeight: "600" },
      promoList: { marginTop: space.sm },
      promoChip: {
        marginRight: 8,
        padding: space.sm,
        borderRadius: radii.md,
        backgroundColor: palette.surfaceMuted,
        borderWidth: 1,
        borderColor: palette.border,
      },
      promoChipCode: { fontWeight: "700", color: palette.text },
      promoChipLabel: { fontSize: 12, color: palette.textMuted },
    })
  );
}
