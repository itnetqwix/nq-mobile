import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radii, space, typography, useStaticStyles, useThemeColors } from "../../../theme";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { PricingBreakdownSummary } from "../../payments/PricingBreakdownSummary";
import type { PricingQuote } from "../../payments/pricingTypes";
import { chargeTotalDollars } from "../../payments/pricingTypes";
import {
  ScheduleActionFooter,
  ScheduleInfoChip,
  ScheduleSection,
  ScheduleSessionSummary,
  ScheduleStepHero,
} from "../components/ScheduleStepChrome";
import { SCHEDULED_DURATIONS, SCHEDULED_BOOKING_BUFFER_MINUTES } from "../constants";

type Props = {
  durationMinutes: number;
  onDurationChange: (minutes: number) => void;
  availableDurations: number[];
  hourlyRate: number;
  expectedPrice: number;
  durationPreviewQuote?: PricingQuote | null;
  sessionTimeSummary: string;
  trainerTimeLabel: string | null;
  onNext: () => void;
  onPickAnotherTime?: () => void;
};

export function ScheduleStepDuration({
  durationMinutes,
  onDurationChange,
  availableDurations,
  hourlyRate,
  expectedPrice,
  durationPreviewQuote,
  sessionTimeSummary,
  trainerTimeLabel,
  onNext,
  onPickAnotherTime,
}: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();

  const canContinue = availableDurations.includes(durationMinutes);
  const noDurations = availableDurations.length === 0;

  return (
    <View testID="schedule-step-duration" style={styles.root}>
      <ScheduleStepHero
        title={t("scheduledBooking.duration.title")}
        subtitle={t("scheduledBooking.duration.subtitle")}
      />

      {sessionTimeSummary ? (
        <ScheduleSessionSummary
          label={t("scheduledBooking.duration.selectedTime")}
          value={sessionTimeSummary}
          hint={
            trainerTimeLabel
              ? t("scheduledBooking.duration.trainerLocalTime", { time: trainerTimeLabel })
              : undefined
          }
        />
      ) : null}

      {noDurations ? (
        <View style={styles.emptyCard}>
          <Ionicons name="time-outline" size={32} color={c.textMuted} />
          <Text style={styles.emptyTitle}>{t("scheduledBooking.alerts.noDurationsTitle")}</Text>
          <Text style={styles.emptySub}>{t("scheduledBooking.alerts.noDurationsBody")}</Text>
          {onPickAnotherTime ? (
            <Pressable style={styles.pickAnotherBtn} onPress={onPickAnotherTime}>
              <Text style={styles.pickAnotherText}>
                {t("scheduledBooking.duration.pickAnotherTime")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <>
          <ScheduleSection title={t("scheduledBooking.duration.sessionLength")}>
            <View style={styles.durationGrid}>
              {SCHEDULED_DURATIONS.map((min) => {
                const on = durationMinutes === min;
                const enabled = availableDurations.includes(min);
                return (
                  <Pressable
                    key={min}
                    testID={`schedule-duration-${min}`}
                    style={[
                      styles.durationTile,
                      on && enabled && styles.durationTileOn,
                      !enabled && styles.durationTileDisabled,
                    ]}
                    onPress={() => enabled && onDurationChange(min)}
                    disabled={!enabled}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on, disabled: !enabled }}
                  >
                    <Text
                      style={[
                        styles.durationLabel,
                        on && enabled && styles.durationLabelOn,
                        !enabled && styles.durationLabelDisabled,
                      ]}
                    >
                      {min} min
                    </Text>
                    {!enabled ? (
                      <Text style={styles.unavailableHint}>
                        {t("scheduledBooking.duration.unavailable")}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </ScheduleSection>

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
            <ScheduleInfoChip
              icon="cash-outline"
              message={t("scheduledBooking.duration.coachRate", { rate: `$${hourlyRate}` })}
            />
          ) : null}
        </>
      )}

      <ScheduleActionFooter
        testID="schedule-duration-continue"
        label={t("scheduledBooking.duration.next")}
        onPress={onNext}
        disabled={!canContinue || noDurations}
        finePrint={t("scheduledBooking.duration.bufferNote", {
          buffer: SCHEDULED_BOOKING_BUFFER_MINUTES,
        })}
      />
    </View>
  );
}

function useStyles() {
  return useStaticStyles((palette) =>
    StyleSheet.create({
      root: { gap: space.lg, paddingBottom: space.md },
      durationGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: space.sm,
      },
      durationTile: {
        flex: 1,
        minWidth: "28%",
        paddingVertical: 16,
        paddingHorizontal: 12,
        borderRadius: radii.lg,
        backgroundColor: palette.surfaceElevated,
        borderWidth: 1.5,
        borderColor: palette.border,
        alignItems: "center",
        gap: 4,
      },
      durationTileOn: {
        backgroundColor: palette.brandNavy,
        borderColor: palette.brandNavy,
      },
      durationTileDisabled: {
        opacity: 0.45,
        backgroundColor: palette.surfaceMuted,
      },
      durationLabel: { fontSize: 16, fontWeight: "800", color: palette.text },
      durationLabelOn: { color: palette.brandTextOn },
      durationLabelDisabled: { color: palette.textMuted },
      unavailableHint: {
        fontSize: 10,
        fontWeight: "600",
        color: palette.textMuted,
        textAlign: "center",
      },
      priceBox: {
        padding: space.md,
        borderRadius: radii.lg,
        backgroundColor: palette.surfaceMuted,
        borderWidth: 1,
        borderColor: palette.border,
      },
      priceLabel: { fontSize: 13, color: palette.textMuted, marginBottom: 4 },
      priceValue: { fontSize: 18, fontWeight: "700", color: palette.text },
      emptyCard: {
        alignItems: "center",
        padding: space.lg,
        borderRadius: radii.lg,
        backgroundColor: palette.surfaceMuted,
        borderWidth: 1,
        borderColor: palette.border,
        gap: space.sm,
      },
      emptyTitle: {
        ...typography.titleSm,
        fontWeight: "700",
        color: palette.text,
        textAlign: "center",
      },
      emptySub: {
        ...typography.bodySm,
        color: palette.textMuted,
        textAlign: "center",
        lineHeight: 20,
      },
      pickAnotherBtn: {
        marginTop: space.sm,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: radii.pill,
        backgroundColor: palette.brandNavy,
      },
      pickAnotherText: {
        color: palette.brandTextOn,
        fontWeight: "700",
        fontSize: 14,
      },
    })
  );
}
