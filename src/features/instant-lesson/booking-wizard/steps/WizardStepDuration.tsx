import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radii, space } from "../../../../theme";
import { INSTANT_LESSON_DURATIONS } from "../constants";
import { sharedStepStyles } from "../sharedStepStyles";

type Props = {
  durationMinutes: number;
  onDurationChange: (minutes: number) => void;
  couponCode: string;
  onCouponCodeChange: (value: string) => void;
  couponError: string;
  onCouponErrorClear: () => void;
  onNext: () => void;
};

export function WizardStepDuration({
  durationMinutes,
  onDurationChange,
  couponCode,
  onCouponCodeChange,
  couponError,
  onCouponErrorClear,
  onNext,
}: Props) {
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

      <Text style={[sharedStepStyles.sectionTitle, styles.promoTitle]}>Promo code (optional)</Text>
      <TextInput
        value={couponCode}
        onChangeText={(t) => {
          onCouponCodeChange(t);
          onCouponErrorClear();
        }}
        placeholder="Enter promo code"
        placeholderTextColor={colors.textMuted}
        style={[styles.input, couponError ? styles.inputError : null]}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={50}
      />
      {!!couponError && <Text style={styles.errorText}>{couponError}</Text>}
      <Text style={sharedStepStyles.mutedSmall}>
        Enter "free" for a 100% discount (if configured). Promo codes are validated with Stripe.
      </Text>

      <Pressable style={sharedStepStyles.primaryBtn} onPress={onNext}>
        <Text style={sharedStepStyles.primaryBtnText}>Next: clips</Text>
        <Ionicons name="arrow-forward" size={18} color={colors.brandTextOn} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  durationGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  durationTile: {
    width: "47%",
    paddingVertical: 14,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.brandNavy,
    alignItems: "center",
    backgroundColor: colors.background,
  },
  durationTileOn: {
    borderColor: colors.success,
    backgroundColor: colors.successSubtle,
  },
  durationLabel: { fontSize: 15, fontWeight: "700", color: colors.brandNavy },
  durationLabelOn: { color: colors.success },
  promoTitle: { marginTop: space.lg },
  input: {
    borderWidth: 2,
    borderColor: colors.brandNavy,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  inputError: { borderColor: colors.danger },
  errorText: { color: colors.danger, fontSize: 13 },
});
