import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, space } from "../../../../theme/tokens";
import { INSTANT_LESSON_DURATIONS } from "../constants";
import { sharedStepStyles } from "../sharedStepStyles";

type Props = {
  trainerName: string;
  durationMinutes: number;
  selectedClipIds: string[];
  couponCode: string;
  isSubmitting: boolean;
  onSubmit: () => void;
};

export function WizardStepConfirm({
  trainerName,
  durationMinutes,
  selectedClipIds,
  couponCode,
  isSubmitting,
  onSubmit,
}: Props) {
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
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="flash" size={18} color="#fff" />
            <Text style={sharedStepStyles.primaryBtnText}>Send request to coach</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryBox: {
    backgroundColor: colors.surface,
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
  summaryKey: { fontSize: 15, fontWeight: "700", color: colors.brandNavy, width: 76 },
  summaryValue: { flex: 1, fontSize: 15, color: colors.text },
});
