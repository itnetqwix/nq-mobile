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
import { useSharedStepStyles } from "../../instant-lesson/booking-wizard/sharedStepStyles";
import type { SmartScheduleSuggestion } from "../../ai/smartScheduleApi";
import { ScheduleBookingCalendar } from "../components/ScheduleBookingCalendar";
import {
  SCHEDULED_BOOKING_BUFFER_MINUTES,
  SCHEDULED_DURATIONS,
  SCHEDULED_MIN_LEAD_TIME_MINUTES,
  SCHEDULE_BOOKING_HORIZON_DAYS,
} from "../constants";
import { useMonthAvailabilityMap } from "../hooks/useMonthAvailabilityMap";
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
}: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const shared = useSharedStepStyles();
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

  const weekStrip = useMemo(() => {
    const start = selectedDay.startOf("week");
    return Array.from({ length: 7 }, (_, i) => start.plus({ days: i })).filter((d) => {
      const today = DateTime.now().setZone(traineeTz).startOf("day");
      const horizonEnd = today.plus({ days: SCHEDULE_BOOKING_HORIZON_DAYS - 1 });
      return d >= today && d <= horizonEnd;
    });
  }, [selectedDay, traineeTz]);

  const todayIso = DateTime.now().setZone(traineeTz).toISODate();

  const selectedStart = useMemo(() => {
    if (!selectedStartIso) return null;
    return DateTime.fromISO(selectedStartIso, { zone: traineeTz });
  }, [selectedStartIso, traineeTz]);

  const canContinue =
    !!selectedStartIso && availableDurations.includes(durationMinutes);

  return (
    <View testID="schedule-step-datetime" style={styles.root}>
      {trainerName ? (
        <Text style={styles.trainerName}>{trainerName}</Text>
      ) : null}
      <Text style={styles.heroTitle}>{t("scheduledBooking.datetime.title")}</Text>
      <Text style={styles.leadLine}>
        {t("scheduledBooking.datetime.leadBanner", { hours: leadHours })}
      </Text>

      <View style={styles.durationSection}>
        <Text style={styles.sectionLabel}>{t("scheduledBooking.datetime.durationFirst")}</Text>
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
                <Text
                  style={[
                    styles.durationChipText,
                    on && enabled && styles.durationChipTextOn,
                    !enabled && styles.durationChipTextDisabled,
                  ]}
                >
                  {min}m
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {smartSuggestionsLoading ? (
        <ActivityIndicator color={c.brandNavy} />
      ) : smartSuggestions.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.suggestionStrip}
        >
          {smartSuggestions.slice(0, 3).map((s, i) => (
            <Pressable
              key={`${s.day}-${s.time}-${i}`}
              style={({ pressed }) => [styles.suggestionChip, pressed && { opacity: 0.9 }]}
              onPress={() => onApplySuggestion?.(s)}
              disabled={!onApplySuggestion}
            >
              <Ionicons name="sparkles-outline" size={14} color={c.brandAccent} />
              <Text style={styles.suggestionText} numberOfLines={1}>
                {s.day} · {s.time}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

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

      {weekStrip.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.weekStripScroll}
          contentContainerStyle={styles.weekStrip}
        >
          {weekStrip.map((d) => {
            const iso = d.toISODate()!;
            const on = selectedDate.startsWith(iso);
            const isToday = iso === todayIso;
            return (
              <Pressable
                key={iso}
                style={[styles.weekChip, on && styles.weekChipOn]}
                onPress={() => onSelectDate(iso)}
              >
                <Text style={[styles.weekChipDay, on && styles.weekChipTextOn]}>
                  {isToday ? t("scheduledBooking.datetime.today") : d.toFormat("ccc")}
                </Text>
                <Text style={[styles.weekChipNum, on && styles.weekChipTextOn]}>{d.toFormat("d")}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={styles.timesHeader}>
        <Text style={styles.sectionLabel}>
          {t("scheduledBooking.datetime.timesTitle")} · {selectedDay.toFormat("EEE, MMM d")}
        </Text>
        <Text style={styles.timesSub}>
          {loading
            ? t("scheduledBooking.datetime.loading")
            : t("scheduledBooking.datetime.timesSub", {
                count: startCandidates.length,
                tz: traineeTz,
              })}
        </Text>
        {trainerTimezone ? (
          <Text style={styles.trainerTz}>
            {t("scheduledBooking.datetime.trainerTz", { tz: trainerTimezone })}
          </Text>
        ) : null}
      </View>

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
          <Text style={styles.emptyHint}>
            {t("scheduledBooking.datetime.tryAnotherDuration", {
              defaultValue: "Try a shorter session or pick a green day on the calendar.",
            })}
          </Text>
        </View>
      ) : (
        <View style={styles.timeGrid}>
          {startCandidates.map((dt) => {
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
      )}

      <Text style={styles.bufferNote}>
        {t("scheduledBooking.datetime.bufferNote", { buffer: SCHEDULED_BOOKING_BUFFER_MINUTES })}
      </Text>

      {selectedStart ? (
        <View style={styles.selectedCard}>
          <Ionicons name="checkmark-circle" size={22} color={c.success} />
          <View style={{ flex: 1 }}>
            <Text style={styles.selectedValue}>
              {selectedStart.toFormat("cccc, MMM d")} · {formatDisplayTime(selectedStart)} ·{" "}
              {durationMinutes} min
            </Text>
          </View>
        </View>
      ) : null}

      <Pressable
        testID="schedule-datetime-continue"
        style={[shared.primaryBtn, !canContinue && shared.btnDisabled, styles.cta]}
        disabled={!canContinue}
        onPress={onNext}
      >
        <Text style={shared.primaryBtnText}>{t("scheduledBooking.datetime.continue")}</Text>
        <Ionicons name="arrow-forward" size={18} color={c.brandTextOn} />
      </Pressable>
    </View>
  );
}

function useStyles() {
  return useStaticStyles((palette) =>
    StyleSheet.create({
      root: { gap: space.md },
      trainerName: {
        ...typography.caption,
        color: palette.textMuted,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 0.4,
      },
      heroTitle: {
        ...typography.titleMd,
        color: palette.text,
        fontWeight: "800",
      },
      leadLine: {
        ...typography.caption,
        color: palette.textMuted,
        lineHeight: 18,
      },
      durationSection: { gap: space.xs },
      sectionLabel: {
        ...typography.label,
        color: palette.text,
        fontWeight: "700",
      },
      durationRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
      },
      durationChip: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: radii.pill,
        borderWidth: 1.5,
        borderColor: palette.border,
        backgroundColor: palette.surfaceElevated,
      },
      durationChipOn: {
        backgroundColor: palette.brandNavy,
        borderColor: palette.brandNavy,
      },
      durationChipDisabled: { opacity: 0.4 },
      durationChipText: {
        fontSize: 14,
        fontWeight: "700",
        color: palette.text,
      },
      durationChipTextOn: { color: palette.brandTextOn },
      durationChipTextDisabled: { color: palette.textMuted },
      suggestionStrip: { gap: space.sm },
      suggestionChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surfaceMuted,
        maxWidth: 220,
      },
      suggestionText: {
        ...typography.caption,
        fontWeight: "600",
        color: palette.text,
        flexShrink: 1,
      },
      weekStripScroll: { flexGrow: 0, flexShrink: 0 },
      weekStrip: { gap: space.sm, paddingVertical: space.xs },
      weekChip: {
        alignItems: "center",
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surfaceElevated,
        minWidth: 52,
      },
      weekChipOn: {
        backgroundColor: palette.brandSubtle,
        borderColor: palette.brandNavy,
      },
      weekChipDay: {
        fontSize: 11,
        fontWeight: "600",
        color: palette.textMuted,
      },
      weekChipNum: {
        fontSize: 16,
        fontWeight: "800",
        color: palette.text,
        marginTop: 2,
      },
      weekChipTextOn: { color: palette.brandNavy },
      timesHeader: { gap: 2 },
      timesSub: {
        ...typography.caption,
        color: palette.textMuted,
      },
      trainerTz: {
        ...typography.caption,
        color: palette.textSecondary,
      },
      bufferNote: {
        ...typography.caption,
        color: palette.textMuted,
        fontStyle: "italic",
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
      timeGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
      },
      timeChip: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: radii.pill,
        backgroundColor: palette.surfaceElevated,
        borderWidth: 1.5,
        borderColor: palette.border,
        minWidth: 84,
        alignItems: "center",
      },
      timeChipOn: {
        backgroundColor: palette.brandNavy,
        borderColor: palette.brandNavy,
      },
      timeChipText: { fontSize: 14, fontWeight: "700", color: palette.text },
      timeChipTextOn: { color: palette.brandTextOn },
      selectedCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        padding: space.md,
        borderRadius: radii.lg,
        backgroundColor: palette.surfaceElevated,
        borderWidth: 1,
        borderColor: palette.success + "55",
      },
      selectedValue: {
        ...typography.bodySm,
        color: palette.text,
        fontWeight: "700",
      },
      cta: { marginTop: space.xs },
    })
  );
}
