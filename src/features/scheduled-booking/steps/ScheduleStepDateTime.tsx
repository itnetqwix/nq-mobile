import { Ionicons } from "@expo/vector-icons";
import { DateTime } from "luxon";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { radii, space, typography, useStaticStyles, useThemeColors } from "../../../theme";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import type { SmartScheduleSuggestion } from "../../ai/smartScheduleApi";
import { ScheduleBookingCalendar } from "../components/ScheduleBookingCalendar";
import {
  ScheduleActionFooter,
  ScheduleFlowSteps,
  ScheduleInfoChip,
  ScheduleSection,
  ScheduleStepHero,
} from "../components/ScheduleStepChrome";
import {
  SCHEDULED_BOOKING_BUFFER_MINUTES,
  SCHEDULED_DURATIONS,
  SCHEDULED_MIN_LEAD_TIME_MINUTES,
  SCHEDULE_BOOKING_HORIZON_DAYS,
} from "../constants";
import { useMonthAvailabilityMap } from "../hooks/useMonthAvailabilityMap";
import {
  groupTimeSlotsByPeriod,
  TIME_OF_DAY_ORDER,
  type TimeOfDayGroup,
} from "../lib/groupTimeSlots";
import { formatDisplayTime } from "../timeSlotUtils";

type Props = {
  trainerId?: string;
  trainerName?: string;
  traineeTz: string;
  trainerTimezone: string | null;
  selectedDate: string;
  onSelectDate: (isoDate: string) => void;
  durationMinutes: number;
  onDurationChange: (minutes: number) => void;
  availableDurations: number[];
  startCandidates: DateTime[];
  selectedStartIso: string | null;
  onSelectStart: (iso: string) => void;
  loading: boolean;
  errorMessage?: string;
  smartSuggestions?: SmartScheduleSuggestion[];
  smartSuggestionsLoading?: boolean;
  onApplySuggestion?: (suggestion: SmartScheduleSuggestion) => void;
  onNext: () => void;
  stepTransitioning?: boolean;
};

const PERIOD_ICONS: Record<TimeOfDayGroup, keyof typeof Ionicons.glyphMap> = {
  morning: "sunny-outline",
  afternoon: "partly-sunny-outline",
  evening: "moon-outline",
};

export function ScheduleStepDateTime({
  trainerId,
  trainerName,
  traineeTz,
  trainerTimezone,
  selectedDate,
  onSelectDate,
  durationMinutes,
  onDurationChange,
  availableDurations,
  startCandidates,
  selectedStartIso,
  onSelectStart,
  loading,
  errorMessage,
  smartSuggestions = [],
  smartSuggestionsLoading = false,
  onApplySuggestion,
  onNext,
  stepTransitioning = false,
}: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();
  const leadHours = SCHEDULED_MIN_LEAD_TIME_MINUTES / 60;

  const selectedDay = useMemo(
    () => DateTime.fromISO(selectedDate.split("T")[0]!, { zone: traineeTz }),
    [selectedDate, traineeTz]
  );

  const [calendarMonth, setCalendarMonth] = useState(() => selectedDay.startOf("month"));

  useEffect(() => {
    const month = selectedDay.startOf("month");
    if (!month.hasSame(calendarMonth, "month")) {
      setCalendarMonth(month);
    }
  }, [selectedDay, calendarMonth]);

  const { weeks, getDayState, isMonthLoading } = useMonthAvailabilityMap({
    trainerId,
    traineeTz,
    month: calendarMonth,
    durationMinutes,
    enabled: !!trainerId,
  });

  const selectedStart = useMemo(() => {
    if (!selectedStartIso) return null;
    return DateTime.fromISO(selectedStartIso, { zone: traineeTz });
  }, [selectedStartIso, traineeTz]);

  const groupedSlots = useMemo(
    () => groupTimeSlotsByPeriod(startCandidates),
    [startCandidates]
  );

  const canContinue = !!selectedStartIso && availableDurations.includes(durationMinutes);

  const hasDuration = availableDurations.includes(durationMinutes);
  const hasTime = !!selectedStartIso;
  const timesReady = !loading && !errorMessage && startCandidates.length > 0;

  const flowSteps = useMemo(
    () => [
      {
        label: t("scheduledBooking.datetime.flowDuration"),
        done: hasDuration,
        active: !hasDuration,
      },
      {
        label: t("scheduledBooking.datetime.flowDay"),
        done: hasTime || timesReady,
        active: hasDuration && !hasTime && !timesReady,
      },
      {
        label: t("scheduledBooking.datetime.flowTime"),
        done: hasTime,
        active: hasDuration && timesReady && !hasTime,
      },
    ],
    [hasDuration, hasTime, timesReady, t]
  );

  const selectionSummary = selectedStart
    ? `${selectedStart.toFormat("ccc, MMM d")} · ${formatDisplayTime(selectedStart)} · ${durationMinutes} min`
    : undefined;

  const selectionHint = trainerTimezone
    ? t("scheduledBooking.datetime.trainerTz", { tz: trainerTimezone })
    : undefined;

  return (
    <View testID="schedule-step-datetime" style={styles.root}>
      <ScheduleStepHero
        trainerName={trainerName}
        title={t("scheduledBooking.datetime.title")}
        subtitle={t("scheduledBooking.datetime.subtitle")}
      />

      <ScheduleInfoChip
        message={t("scheduledBooking.datetime.leadBanner", { hours: leadHours })}
      />

      <ScheduleFlowSteps steps={flowSteps} />

      <ScheduleSection title={t("scheduledBooking.datetime.durationFirst")}>
        <View style={styles.durationRow}>
          {SCHEDULED_DURATIONS.map((min) => {
            const on = durationMinutes === min;
            const enabled = availableDurations.length === 0 || availableDurations.includes(min);
            return (
              <Pressable
                key={min}
                testID={`schedule-datetime-duration-${min}`}
                style={[
                  styles.durationChip,
                  on && enabled && styles.durationChipOn,
                  !enabled && styles.durationChipDisabled,
                ]}
                onPress={() => enabled && onDurationChange(min)}
                disabled={!enabled}
              >
                <Text style={[styles.durationNum, on && enabled && styles.durationNumOn]}>
                  {min}
                </Text>
                <Text
                  style={[
                    styles.durationUnit,
                    on && enabled && styles.durationUnitOn,
                    !enabled && styles.durationUnitDisabled,
                  ]}
                >
                  min
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScheduleSection>

      {smartSuggestionsLoading ? (
        <View style={styles.suggestionLoading}>
          <ActivityIndicator color={c.brandNavy} size="small" />
          <Text style={styles.suggestionLoadingText}>{t("scheduledBooking.datetime.smartLoading")}</Text>
        </View>
      ) : smartSuggestions.length > 0 ? (
        <ScheduleSection
          title={t("scheduledBooking.datetime.smartTitle")}
          subtitle={t("scheduledBooking.datetime.smartSub")}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestionStrip}
          >
            {smartSuggestions.slice(0, 4).map((s, i) => (
              <Pressable
                key={`${s.day}-${s.time}-${i}`}
                style={({ pressed }) => [styles.suggestionCard, pressed && { opacity: 0.92 }]}
                onPress={() => onApplySuggestion?.(s)}
                disabled={!onApplySuggestion}
                accessibilityRole="button"
                accessibilityLabel={t("scheduledBooking.datetime.applySuggestion")}
              >
                <View style={styles.suggestionIcon}>
                  <Ionicons name="sparkles" size={16} color={c.brandAccent} />
                </View>
                <Text style={styles.suggestionDay} numberOfLines={1}>
                  {s.day}
                </Text>
                <Text style={styles.suggestionTime} numberOfLines={1}>
                  {s.time}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </ScheduleSection>
      ) : null}

      <ScheduleSection
        title={t("scheduledBooking.datetime.pickDate")}
        subtitle={t("scheduledBooking.calendar.horizonNote", { days: SCHEDULE_BOOKING_HORIZON_DAYS })}
      >
        <ScheduleBookingCalendar
          traineeTz={traineeTz}
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          selectedDateIso={selectedDate}
          onSelectDate={onSelectDate}
          weeks={weeks}
          getDayState={getDayState}
          isMonthLoading={isMonthLoading}
        />
      </ScheduleSection>

      <ScheduleSection
        title={`${t("scheduledBooking.datetime.timesTitle")} · ${selectedDay.toFormat("EEE, MMM d")}`}
        subtitle={
          loading
            ? t("scheduledBooking.datetime.loading")
            : t("scheduledBooking.datetime.timesSub", {
                count: startCandidates.length,
                tz: traineeTz,
              })
        }
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={c.brandNavy} />
            <Text style={styles.loadingText}>{t("scheduledBooking.datetime.loading")}</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.emptyCard}>
            <Ionicons name="alert-circle-outline" size={28} color={c.danger} />
            <Text style={styles.emptyTitle}>{errorMessage}</Text>
          </View>
        ) : startCandidates.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="calendar-clear-outline" size={32} color={c.textMuted} />
            <Text style={styles.emptyTitle}>{t("scheduledBooking.datetime.emptyTitle")}</Text>
            <Text style={styles.emptySub}>{t("scheduledBooking.datetime.emptySub")}</Text>
            <Text style={styles.emptyHint}>{t("scheduledBooking.datetime.tryAnotherDuration")}</Text>
          </View>
        ) : (
          <View style={styles.timeSections}>
            {TIME_OF_DAY_ORDER.map((period) => {
              const slots = groupedSlots[period];
              if (slots.length === 0) return null;
              return (
                <View key={period} style={styles.periodBlock}>
                  <View style={styles.periodHeader}>
                    <Ionicons name={PERIOD_ICONS[period]} size={16} color={c.brandNavy} />
                    <Text style={styles.periodTitle}>
                      {t(`scheduledBooking.datetime.${period}`)}
                    </Text>
                    <Text style={styles.periodCount}>{slots.length}</Text>
                  </View>
                  <View style={styles.timeGrid}>
                    {slots.map((dt) => {
                      const iso = dt.toISO()!;
                      const on = selectedStartIso === iso;
                      return (
                        <Pressable
                          key={iso}
                          testID="schedule-time-slot"
                          style={[styles.timeChip, on && styles.timeChipOn]}
                          onPress={() => onSelectStart(iso)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                        >
                          <Text style={[styles.timeChipText, on && styles.timeChipTextOn]}>
                            {dt.toFormat("h:mm a")}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScheduleSection>

      <ScheduleActionFooter
        testID="schedule-datetime-continue"
        summary={selectionSummary}
        summaryHint={selectionHint}
        label={t("scheduledBooking.datetime.continue")}
        onPress={onNext}
        disabled={!canContinue}
        loading={stepTransitioning}
        finePrint={t("scheduledBooking.datetime.bufferNote", {
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
      durationRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: space.sm,
      },
      durationChip: {
        flex: 1,
        minWidth: 72,
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: radii.lg,
        borderWidth: 1.5,
        borderColor: palette.border,
        backgroundColor: palette.surfaceElevated,
      },
      durationChipOn: {
        backgroundColor: palette.brandNavy,
        borderColor: palette.brandNavy,
      },
      durationChipDisabled: { opacity: 0.38 },
      durationNum: {
        fontSize: 20,
        fontWeight: "800",
        color: palette.text,
      },
      durationNumOn: { color: palette.brandTextOn },
      durationUnit: {
        fontSize: 11,
        fontWeight: "700",
        color: palette.textMuted,
        marginTop: 2,
        textTransform: "uppercase",
        letterSpacing: 0.3,
      },
      durationUnitOn: { color: palette.brandTextOn + "CC" },
      durationUnitDisabled: { color: palette.textMuted },
      suggestionLoading: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        paddingVertical: space.xs,
      },
      suggestionLoadingText: {
        ...typography.caption,
        color: palette.textMuted,
      },
      suggestionStrip: { gap: space.sm, paddingVertical: space.xs },
      suggestionCard: {
        width: 132,
        padding: space.md,
        borderRadius: radii.lg,
        backgroundColor: palette.surfaceElevated,
        borderWidth: 1,
        borderColor: palette.brandAccent + "55",
        gap: 4,
      },
      suggestionIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: palette.brandSubtle,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 4,
      },
      suggestionDay: {
        ...typography.caption,
        fontWeight: "700",
        color: palette.text,
      },
      suggestionTime: {
        fontSize: 16,
        fontWeight: "800",
        color: palette.brandNavy,
      },
      loadingBox: {
        alignItems: "center",
        paddingVertical: space.lg,
        gap: space.sm,
      },
      loadingText: { ...typography.bodySm, color: palette.textMuted },
      emptyCard: {
        alignItems: "center",
        paddingVertical: space.lg,
        paddingHorizontal: space.md,
        borderRadius: radii.lg,
        backgroundColor: palette.surfaceMuted,
        borderWidth: 1,
        borderColor: palette.border,
        gap: space.sm,
      },
      emptyTitle: {
        ...typography.titleSm,
        color: palette.text,
        fontWeight: "700",
        textAlign: "center",
      },
      emptySub: {
        ...typography.bodySm,
        color: palette.textMuted,
        textAlign: "center",
        lineHeight: 20,
      },
      emptyHint: {
        ...typography.caption,
        color: palette.textSecondary,
        textAlign: "center",
      },
      timeSections: { gap: space.md },
      periodBlock: { gap: space.sm },
      periodHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      },
      periodTitle: {
        ...typography.label,
        color: palette.text,
        fontWeight: "700",
        flex: 1,
      },
      periodCount: {
        ...typography.caption,
        color: palette.textMuted,
        fontWeight: "700",
      },
      timeGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
      },
      timeChip: {
        paddingVertical: 11,
        paddingHorizontal: 14,
        borderRadius: radii.pill,
        backgroundColor: palette.surfaceElevated,
        borderWidth: 1.5,
        borderColor: palette.border,
        minWidth: 88,
        alignItems: "center",
      },
      timeChipOn: {
        backgroundColor: palette.brandNavy,
        borderColor: palette.brandNavy,
      },
      timeChipText: { fontSize: 14, fontWeight: "700", color: palette.text },
      timeChipTextOn: { color: palette.brandTextOn },
    })
  );
}
