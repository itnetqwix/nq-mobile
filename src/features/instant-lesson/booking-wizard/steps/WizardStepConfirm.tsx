import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { radii, space, useStaticStyles, useThemeColors } from "../../../../theme";
import { INSTANT_LESSON_DURATIONS } from "../constants";
import { useSharedStepStyles } from "../sharedStepStyles";

type Props = {
  trainerName: string;
  durationMinutes: number;
  selectedClipIds: string[];
  couponCode: string;
  chargingPrice: number;
  isSubmitting: boolean;
  onSubmit: () => void;
};

export function WizardStepConfirm({
  trainerName,
  durationMinutes,
  selectedClipIds,
  couponCode,
  chargingPrice,
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
        <View style={styles.summaryLine}>
          <Text style={styles.summaryKey}>Price</Text>
          <Text style={styles.summaryValue}>
            {chargingPrice > 0 ? `$${chargingPrice.toFixed(2)}` : "Free"}
          </Text>
        </View>
        {couponCode.trim() ? (
          <View style={styles.summaryLine}>
            <Text style={styles.summaryKey}>Promo</Text>
            <Text style={styles.summaryValue}>{couponCode.trim()}</Text>
          </View>
        ) : null}
      </View>
      <Text style={sharedStepStyles.muted}>
        We create the instant booking, attach any clips you chose, then send the request to the coach (same sequence
        as the web student flow).
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
