import { Ionicons } from "@expo/vector-icons";
import { DateTime } from "luxon";
import React, { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { radii, space, typography, useStaticStyles, useThemeColors } from "../../../theme";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { SCHEDULE_BOOKING_HORIZON_DAYS } from "../constants";
import type { DayAvailabilityState } from "../hooks/useMonthAvailabilityMap";
import type { CalendarMonthCell } from "../timeSlotUtils";

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

type Props = {
  traineeTz: string;
  month: DateTime;
  onMonthChange: (month: DateTime) => void;
  selectedDateIso: string;
  onSelectDate: (isoDate: string) => void;
  weeks: CalendarMonthCell[][];
  getDayState: (cell: CalendarMonthCell) => { state: DayAvailabilityState; slotCount: number };
  isMonthLoading?: boolean;
  horizonDays?: number;
};

export function ScheduleBookingCalendar({
  traineeTz,
  month,
  onMonthChange,
  selectedDateIso,
  onSelectDate,
  weeks,
  getDayState,
  isMonthLoading = false,
  horizonDays = SCHEDULE_BOOKING_HORIZON_DAYS,
}: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();

  const today = DateTime.now().setZone(traineeTz).startOf("day");
  const minMonth = today.startOf("month");
  const maxMonth = today.plus({ days: horizonDays - 1 }).startOf("month");

  const monthLabel = month.toFormat("MMMM yyyy");
  const canGoPrev = month > minMonth;
  const canGoNext = month < maxMonth;

  const weekdayLabels = useMemo(
    () => WEEKDAY_KEYS.map((key) => t(`scheduledBooking.calendar.${key}`)),
    [t]
  );

  const shiftMonth = (delta: number) => {
    const next = month.plus({ months: delta }).startOf("month");
    if (next < minMonth) {
      onMonthChange(minMonth);
      return;
    }
    if (next > maxMonth) {
      onMonthChange(maxMonth);
      return;
    }
    onMonthChange(next);
  };

  return (
    <View style={styles.root}>
      <View style={styles.monthHeader}>
        <Pressable
          onPress={() => canGoPrev && shiftMonth(-1)}
          disabled={!canGoPrev}
          hitSlop={10}
          style={[styles.navBtn, !canGoPrev && styles.navBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel={t("scheduledBooking.calendar.prevMonth")}
        >
          <Ionicons name="chevron-back" size={20} color={canGoPrev ? c.text : c.textMuted} />
        </Pressable>
        <View style={styles.monthTitleWrap}>
          <Text style={styles.monthTitle}>{monthLabel}</Text>
          {isMonthLoading ? <ActivityIndicator size="small" color={c.brandNavy} /> : null}
        </View>
        <Pressable
          onPress={() => canGoNext && shiftMonth(1)}
          disabled={!canGoNext}
          hitSlop={10}
          style={[styles.navBtn, !canGoNext && styles.navBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel={t("scheduledBooking.calendar.nextMonth")}
        >
          <Ionicons name="chevron-forward" size={20} color={canGoNext ? c.text : c.textMuted} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {weekdayLabels.map((label) => (
          <Text key={label} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {weeks.map((week, wi) => (
          <View key={`week-${wi}`} style={styles.weekRow}>
            {week.map((cell) => {
              const { state, slotCount } = getDayState(cell);
              const on = selectedDateIso.startsWith(cell.iso);
              const isToday = cell.iso === today.toISODate();
              const disabled = !cell.isBookable || state === "disabled";
              return (
                <Pressable
                  key={cell.iso}
                  style={[
                    styles.dayCell,
                    !cell.inMonth && styles.dayCellOutside,
                    on && styles.dayCellOn,
                    disabled && styles.dayCellDisabled,
                  ]}
                  onPress={() => !disabled && onSelectDate(cell.iso)}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on, disabled }}
                  accessibilityLabel={cell.dt.toFormat("cccc, MMMM d")}
                >
                  <Text
                    style={[
                      styles.dayNum,
                      !cell.inMonth && styles.dayNumOutside,
                      on && styles.dayNumOn,
                      disabled && styles.dayNumDisabled,
                      isToday && !on && styles.dayNumToday,
                    ]}
                  >
                    {cell.dt.day}
                  </Text>
                  {cell.inMonth && cell.isBookable ? (
                    state === "loading" ? (
                      <View style={styles.dotLoading} />
                    ) : state === "available" ? (
                      <View style={[styles.dot, on && styles.dotOn]} />
                    ) : (
                      <View style={styles.dotNone} />
                    )
                  ) : (
                    <View style={styles.dotSpacer} />
                  )}
                  {cell.inMonth && state === "available" && slotCount > 0 && !on ? (
                    <Text style={styles.slotHint}>{slotCount > 9 ? "9+" : slotCount}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.legendDotAvailable]} />
          <Text style={styles.legendText}>{t("scheduledBooking.calendar.legendAvailable")}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.legendDotUnavailable]} />
          <Text style={styles.legendText}>{t("scheduledBooking.calendar.legendUnavailable")}</Text>
        </View>
      </View>
    </View>
  );
}

function useStyles() {
  return useStaticStyles((palette) =>
    StyleSheet.create({
      root: {
        gap: space.sm,
        padding: space.md,
        borderRadius: radii.lg,
        backgroundColor: palette.surfaceElevated,
        borderWidth: 1,
        borderColor: palette.border,
      },
      monthHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      },
      navBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: palette.surfaceMuted,
      },
      navBtnDisabled: { opacity: 0.35 },
      monthTitleWrap: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
      },
      monthTitle: {
        ...typography.subtitle,
        fontWeight: "800",
        color: palette.text,
      },
      weekdayRow: {
        flexDirection: "row",
        marginTop: space.xs,
      },
      weekdayLabel: {
        flex: 1,
        textAlign: "center",
        ...typography.caption,
        fontWeight: "700",
        color: palette.textMuted,
        fontSize: 11,
      },
      grid: { gap: 4 },
      weekRow: { flexDirection: "row" },
      dayCell: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 6,
        borderRadius: radii.md,
        minHeight: 46,
      },
      dayCellOutside: { opacity: 0.25 },
      dayCellOn: {
        backgroundColor: palette.brandNavy,
      },
      dayCellDisabled: { opacity: 0.4 },
      dayNum: {
        fontSize: 15,
        fontWeight: "700",
        color: palette.text,
      },
      dayNumOutside: { color: palette.textMuted },
      dayNumOn: { color: palette.brandTextOn },
      dayNumDisabled: { color: palette.textMuted },
      dayNumToday: { color: palette.brandNavy },
      dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: palette.success,
        marginTop: 2,
      },
      dotOn: { backgroundColor: palette.brandTextOn },
      dotNone: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: palette.border,
        marginTop: 3,
      },
      dotLoading: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: palette.textMuted,
        opacity: 0.5,
        marginTop: 2,
      },
      dotSpacer: { height: 8 },
      slotHint: {
        fontSize: 8,
        fontWeight: "700",
        color: palette.success,
        marginTop: 1,
      },
      legendRow: {
        flexDirection: "row",
        justifyContent: "center",
        gap: space.lg,
        marginTop: space.xs,
      },
      legendItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      },
      legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
      },
      legendDotAvailable: { backgroundColor: palette.success },
      legendDotUnavailable: { backgroundColor: palette.border },
      legendText: {
        ...typography.caption,
        color: palette.textMuted,
        fontSize: 11,
      },
    })
  );
}
