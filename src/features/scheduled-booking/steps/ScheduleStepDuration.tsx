import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radii, space, useStaticStyles, useThemeColors } from "../../../theme";
import { useSharedStepStyles } from "../../instant-lesson/booking-wizard/sharedStepStyles";
import { SCHEDULED_DURATIONS } from "../constants";
import { PricingBreakdownSummary } from "../../payments/PricingBreakdownSummary";
import type { PricingQuote } from "../../payments/pricingTypes";
import { chargeTotalDollars } from "../../payments/pricingTypes";

type Props = {
  durationMinutes: number;
  onDurationChange: (minutes: number) => void;
  hourlyRate: number;
  expectedPrice: number;
  durationPreviewQuote?: PricingQuote | null;
  sessionTimeSummary: string;
  trainerTimeLabel: string | null;
  onNext: () => void;
};

export function ScheduleStepDuration({
  durationMinutes,
  onDurationChange,
  hourlyRate,
  expectedPrice,
  durationPreviewQuote,
  sessionTimeSummary,
  trainerTimeLabel,
  onNext,
}: Props) {
  const c = useThemeColors();
  const shared = useSharedStepStyles();
  const styles = useStyles();

  return (
    <View style={shared.card}>
      <Text style={shared.sectionTitle}>Session length</Text>
      {sessionTimeSummary ? <Text style={shared.muted}>{sessionTimeSummary}</Text> : null}
      {trainerTimeLabel ? (
        <Text style={shared.mutedSmall}>Trainer time: {trainerTimeLabel}</Text>
      ) : null}

      <View style={styles.durationGrid}>
        {SCHEDULED_DURATIONS.map((min) => {
          const on = durationMinutes === min;
          return (
            <Pressable
              key={min}
              style={[styles.durationTile, on && styles.durationTileOn]}
              onPress={() => onDurationChange(min)}
            >
              <Text style={[styles.durationLabel, on && styles.durationLabelOn]}>{min} min</Text>
            </Pressable>
          );
        })}
      </View>

      {hourlyRate > 0 ? (
        <PricingBreakdownSummary
          sessionSubtotal={expectedPrice}
          pricingQuote={durationPreviewQuote}
          chargeTotal={chargeTotalDollars(durationPreviewQuote) ?? expectedPrice}
          showSubtotalWhenNoFees
        />
      ) : (
        <View style={styles.priceBox}>
          <Text style={styles.priceLabel}>Estimated price</Text>
          <Text style={styles.priceValue}>Free</Text>
        </View>
      )}
      {hourlyRate > 0 ? (
        <Text style={shared.mutedSmall}>Coach rate: ${hourlyRate}/hr</Text>
      ) : null}

      <Pressable style={shared.primaryBtn} onPress={onNext}>
        <Text style={shared.primaryBtnText}>Next: clips</Text>
        <Ionicons name="arrow-forward" size={18} color={c.brandTextOn} />
      </Pressable>
    </View>
  );
}

function useStyles() {
  return useStaticStyles((palette) =>
    StyleSheet.create({
      durationGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginTop: space.sm,
      },
      durationTile: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: radii.md,
        backgroundColor: palette.surfaceMuted,
        borderWidth: 1,
        borderColor: palette.border,
        minWidth: "30%",
        alignItems: "center",
      },
      durationTileOn: { backgroundColor: palette.brandNavy, borderColor: palette.brandNavy },
      durationLabel: { fontSize: 15, fontWeight: "700", color: palette.text },
      durationLabelOn: { color: palette.brandTextOn },
      priceBox: {
        marginTop: space.md,
        padding: space.md,
        borderRadius: radii.md,
        backgroundColor: palette.surfaceMuted,
      },
      priceLabel: { fontSize: 13, color: palette.textMuted, marginBottom: 4 },
      priceValue: { fontSize: 18, fontWeight: "700", color: palette.text },
    })
  );
}
