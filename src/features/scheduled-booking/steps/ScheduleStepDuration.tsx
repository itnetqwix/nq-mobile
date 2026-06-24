import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radii, space, typography, useStaticStyles, useThemeColors } from "../../../theme";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { useSharedStepStyles } from "../../instant-lesson/booking-wizard/sharedStepStyles";
import { SCHEDULED_DURATIONS, SCHEDULED_BOOKING_BUFFER_MINUTES } from "../constants";
import { PricingBreakdownSummary } from "../../payments/PricingBreakdownSummary";
import type { PricingQuote } from "../../payments/pricingTypes";
import { chargeTotalDollars } from "../../payments/pricingTypes";

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
  const shared = useSharedStepStyles();
  const styles = useStyles();

  const canContinue = availableDurations.includes(durationMinutes);
  const noDurations = availableDurations.length === 0;

  return (
    <View style={styles.root}>
      <Text style={styles.heroTitle}>{t("scheduledBooking.duration.title")}</Text>

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
      ) : null}

      {sessionTimeSummary ? (
        <View style={styles.timeCard}>
          <View style={styles.timeIcon}>
            <Ionicons name="calendar-outline" size={20} color={c.brandNavy} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.timeLabel}>{t("scheduledBooking.duration.selectedTime")}</Text>
            <Text style={styles.timeValue}>{sessionTimeSummary}</Text>
            {trainerTimeLabel ? (
              <Text style={styles.trainerTz}>
                {t("scheduledBooking.duration.trainerLocalTime", { time: trainerTimeLabel })}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      <Text style={styles.bufferNote}>
        {t("scheduledBooking.duration.bufferNote", { buffer: SCHEDULED_BOOKING_BUFFER_MINUTES })}
      </Text>

      <View style={styles.durationGrid}>
        {SCHEDULED_DURATIONS.map((min) => {
          const on = durationMinutes === min;
          const enabled = availableDurations.includes(min);
          return (
            <Pressable
              key={min}
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
                <Text style={styles.unavailableHint}>{t("scheduledBooking.duration.unavailable")}</Text>
              ) : null}
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
        <Text style={styles.rateNote}>
          {t("scheduledBooking.duration.coachRate", { rate: `$${hourlyRate}` })}
        </Text>
      ) : null}

      <Pressable
        style={[shared.primaryBtn, (!canContinue || noDurations) && shared.btnDisabled]}
        disabled={!canContinue || noDurations}
        onPress={onNext}
      >
        <Text style={shared.primaryBtnText}>{t("scheduledBooking.duration.next")}</Text>
        <Ionicons name="arrow-forward" size={18} color={c.brandTextOn} />
      </Pressable>
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
      timeCard: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: space.sm,
        padding: space.md,
        borderRadius: radii.lg,
        backgroundColor: palette.surfaceElevated,
        borderWidth: 2,
        borderColor: palette.brandAccent + "44",
      },
      timeIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: palette.brandSubtle,
        alignItems: "center",
        justifyContent: "center",
      },
      timeLabel: {
        ...typography.caption,
        color: palette.textMuted,
        fontWeight: "600",
      },
      timeValue: {
        ...typography.bodySm,
        color: palette.text,
        fontWeight: "700",
        marginTop: 2,
      },
      trainerTz: {
        ...typography.caption,
        color: palette.textSecondary,
        marginTop: 4,
      },
      bufferNote: {
        ...typography.caption,
        color: palette.textMuted,
        fontStyle: "italic",
      },
      durationGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
      },
      durationTile: {
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: radii.lg,
        backgroundColor: palette.surfaceElevated,
        borderWidth: 1.5,
        borderColor: palette.border,
        minWidth: "30%",
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
        borderRadius: radii.md,
        backgroundColor: palette.surfaceMuted,
      },
      priceLabel: { fontSize: 13, color: palette.textMuted, marginBottom: 4 },
      priceValue: { fontSize: 18, fontWeight: "700", color: palette.text },
      rateNote: { ...typography.caption, color: palette.textMuted },
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
