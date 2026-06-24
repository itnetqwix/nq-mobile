import { Ionicons } from "@expo/vector-icons";
import { DateTime } from "luxon";
import React, { useMemo } from "react";
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
import {
  SCHEDULED_BOOKING_BUFFER_MINUTES,
  SCHEDULED_MIN_LEAD_TIME_MINUTES,
} from "../constants";
import {
  formatDisplayTime,
  groupStartCandidatesByPeriod,
  nextDays,
  type TimePeriodGroup,
} from "../timeSlotUtils";
import type { SmartScheduleSuggestion } from "../../ai/smartScheduleApi";

type Props = {
  trainerName?: string;
  traineeTz: string;
  trainerTimezone: string | null;
  selectedDate: string;
  onSelectDate: (isoDate: string) => void;
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

const PERIOD_ORDER: TimePeriodGroup[] = ["morning", "afternoon", "evening"];
const PERIOD_ICON: Record<TimePeriodGroup, keyof typeof Ionicons.glyphMap> = {
  morning: "sunny-outline",
  afternoon: "partly-sunny-outline",
  evening: "moon-outline",
};

export function ScheduleStepDateTime({
  trainerName,
  traineeTz,
  trainerTimezone,
  selectedDate,
  onSelectDate,
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
  const days = nextDays(14, traineeTz);
  const leadHours = SCHEDULED_MIN_LEAD_TIME_MINUTES / 60;

  const selectedDay = useMemo(
    () => DateTime.fromISO(selectedDate.split("T")[0]!, { zone: traineeTz }),
    [selectedDate, traineeTz]
  );

  const todayIso = DateTime.now().setZone(traineeTz).toISODate();
  const earliestBookable = useMemo(
    () => DateTime.now().setZone(traineeTz).plus({ minutes: SCHEDULED_MIN_LEAD_TIME_MINUTES }),
    [traineeTz]
  );

  const grouped = useMemo(
    () => groupStartCandidatesByPeriod(startCandidates),
    [startCandidates]
  );

  const selectedStart = useMemo(() => {
    if (!selectedStartIso) return null;
    return DateTime.fromISO(selectedStartIso, { zone: traineeTz });
  }, [selectedStartIso, traineeTz]);

  const periodLabel = (key: TimePeriodGroup) =>
    t(`scheduledBooking.datetime.${key}` as "scheduledBooking.datetime.morning");

  return (
    <View style={styles.root}>
      {trainerName ? (
        <Text style={styles.trainerName}>{trainerName}</Text>
      ) : null}
      <Text style={styles.heroTitle}>{t("scheduledBooking.datetime.title")}</Text>

      <View style={styles.leadBanner}>
        <View style={styles.leadIconWrap}>
          <Ionicons name="time-outline" size={20} color={c.brandNavy} />
        </View>
        <View style={styles.leadTextWrap}>
          <Text style={styles.leadBannerText}>
            {t("scheduledBooking.datetime.leadBanner", { hours: leadHours })}
          </Text>
          <Text style={styles.leadEarliest}>
            {t("scheduledBooking.datetime.earliestLabel")}:{" "}
            <Text style={styles.leadEarliestValue}>
              {earliestBookable.toFormat("ccc, MMM d · h:mm a")}
            </Text>
          </Text>
        </View>
      </View>

      {smartSuggestionsLoading ? (
        <ActivityIndicator color={c.brandNavy} style={{ marginBottom: space.sm }} />
      ) : smartSuggestions.length > 0 ? (
        <View style={styles.smartCard}>
          <Text style={styles.smartTitle}>{t("scheduledBooking.datetime.smartTitle")}</Text>
          <Text style={styles.smartSub}>{t("scheduledBooking.datetime.smartSub")}</Text>
          {smartSuggestions.slice(0, 3).map((s, i) => (
            <Pressable
              key={`${s.day}-${s.time}-${i}`}
              style={({ pressed }) => [styles.smartRow, pressed && styles.smartRowPressed]}
              onPress={() => onApplySuggestion?.(s)}
              disabled={!onApplySuggestion}
              accessibilityRole="button"
              accessibilityHint={t("scheduledBooking.datetime.applySuggestion")}
            >
              <Ionicons name="sparkles-outline" size={16} color={c.brandAccent} />
              <View style={styles.smartTextWrap}>
                <Text style={styles.smartWhen}>
                  {s.day} · {s.time}
                </Text>
                {!!s.reason && <Text style={styles.smartReason}>{s.reason}</Text>}
              </View>
              {onApplySuggestion ? (
                <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>{t("scheduledBooking.datetime.pickDate")}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dateStrip}
      >
        {days.map((d) => {
          const iso = d.toISODate()!;
          const on = selectedDate.startsWith(iso);
          const isToday = iso === todayIso;
          return (
            <Pressable
              key={iso}
              style={[styles.dateChip, on && styles.dateChipOn]}
              onPress={() => onSelectDate(iso)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              {isToday ? (
                <Text style={[styles.dateTodayBadge, on && styles.dateTodayBadgeOn]}>
                  {t("scheduledBooking.datetime.today")}
                </Text>
              ) : (
                <Text style={[styles.dateChipDay, on && styles.dateChipTextOn]}>
                  {d.toFormat("ccc")}
                </Text>
              )}
              <Text style={[styles.dateChipNum, on && styles.dateChipTextOn]}>{d.toFormat("d")}</Text>
              <Text style={[styles.dateChipMonth, on && styles.dateChipTextOn]}>
                {d.toFormat("MMM")}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.timesHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionLabel}>{t("scheduledBooking.datetime.timesTitle")}</Text>
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
        <View style={styles.datePill}>
          <Ionicons name="calendar-outline" size={14} color={c.brandNavy} />
          <Text style={styles.datePillText}>{selectedDay.toFormat("EEE, MMM d")}</Text>
        </View>
      </View>

      <Text style={styles.bufferNote}>
        {t("scheduledBooking.datetime.bufferNote", { buffer: SCHEDULED_BOOKING_BUFFER_MINUTES })}
      </Text>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={c.brandNavy} size="large" />
          <Text style={styles.loadingText}>{t("scheduledBooking.datetime.loading")}</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.emptyCard}>
          <Ionicons name="alert-circle-outline" size={32} color={c.danger} />
          <Text style={styles.emptyTitle}>{errorMessage}</Text>
        </View>
      ) : startCandidates.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="calendar-clear-outline" size={36} color={c.textMuted} />
          <Text style={styles.emptyTitle}>{t("scheduledBooking.datetime.emptyTitle")}</Text>
          <Text style={styles.emptySub}>{t("scheduledBooking.datetime.emptySub")}</Text>
        </View>
      ) : (
        <View style={styles.periodsWrap}>
          {PERIOD_ORDER.map((period) => {
            const slots = grouped[period];
            if (!slots.length) return null;
            return (
              <View key={period} style={styles.periodBlock}>
                <View style={styles.periodHeader}>
                  <Ionicons name={PERIOD_ICON[period]} size={16} color={c.textSecondary} />
                  <Text style={styles.periodTitle}>{periodLabel(period)}</Text>
                  <Text style={styles.periodCount}>{slots.length}</Text>
                </View>
                <View style={styles.timeGrid}>
                  {slots.map((dt) => {
                    const iso = dt.toISO()!;
                    const on = selectedStartIso === iso;
                    return (
                      <Pressable
                        key={iso}
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

      {selectedStart ? (
        <View style={styles.selectedCard}>
          <View style={styles.selectedIcon}>
            <Ionicons name="checkmark-circle" size={22} color={c.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.selectedLabel}>{t("scheduledBooking.datetime.selectedLabel")}</Text>
            <Text style={styles.selectedValue}>
              {selectedStart.toFormat("cccc, MMMM d")} · {formatDisplayTime(selectedStart)}
            </Text>
          </View>
        </View>
      ) : null}

      <Pressable
        style={[shared.primaryBtn, !selectedStartIso && shared.btnDisabled, styles.cta]}
        disabled={!selectedStartIso}
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
      root: {
        gap: space.md,
      },
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
      leadBanner: {
        flexDirection: "row",
        gap: space.sm,
        padding: space.md,
        borderRadius: radii.lg,
        backgroundColor: palette.brandSubtle,
        borderWidth: 1,
        borderColor: palette.brandAccent + "44",
      },
      leadIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: palette.surfaceElevated,
        alignItems: "center",
        justifyContent: "center",
      },
      leadTextWrap: { flex: 1, gap: 4 },
      leadBannerText: {
        ...typography.bodySm,
        color: palette.brandNavy,
        fontWeight: "600",
        lineHeight: 20,
      },
      leadEarliest: {
        ...typography.caption,
        color: palette.textMuted,
      },
      leadEarliestValue: {
        fontWeight: "700",
        color: palette.text,
      },
      smartCard: {
        padding: space.md,
        borderRadius: radii.lg,
        backgroundColor: palette.surfaceElevated,
        borderWidth: 1,
        borderColor: palette.border,
        gap: space.xs,
      },
      smartTitle: { ...typography.label, fontWeight: "700", color: palette.text },
      smartSub: { ...typography.caption, color: palette.textMuted, marginBottom: 4 },
      smartRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 6,
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderRadius: radii.md,
      },
      smartRowPressed: { backgroundColor: palette.surfaceMuted },
      smartTextWrap: { flex: 1, gap: 2 },
      smartWhen: { fontSize: 14, fontWeight: "600", color: palette.text },
      smartReason: { ...typography.caption, color: palette.textMuted, lineHeight: 16 },
      sectionLabel: {
        ...typography.label,
        color: palette.text,
        fontWeight: "700",
      },
      dateStrip: {
        gap: space.sm,
        paddingVertical: space.xs,
      },
      dateChip: {
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: radii.lg,
        backgroundColor: palette.surfaceElevated,
        borderWidth: 1.5,
        borderColor: palette.border,
        minWidth: 72,
      },
      dateChipOn: {
        backgroundColor: palette.brandNavy,
        borderColor: palette.brandNavy,
      },
      dateTodayBadge: {
        fontSize: 10,
        fontWeight: "800",
        color: palette.brandNavy,
        letterSpacing: 0.3,
        textTransform: "uppercase",
      },
      dateTodayBadgeOn: { color: palette.brandTextOn },
      dateChipDay: { fontSize: 12, color: palette.textMuted, fontWeight: "600" },
      dateChipNum: { fontSize: 22, fontWeight: "800", color: palette.text, marginTop: 2 },
      dateChipMonth: { fontSize: 11, color: palette.textMuted, fontWeight: "600" },
      dateChipTextOn: { color: palette.brandTextOn },
      timesHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: space.sm,
        marginTop: space.xs,
      },
      timesSub: {
        ...typography.caption,
        color: palette.textMuted,
        marginTop: 2,
      },
      trainerTz: {
        ...typography.caption,
        color: palette.textSecondary,
        marginTop: 2,
      },
      datePill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: radii.pill,
        backgroundColor: palette.surfaceMuted,
        borderWidth: 1,
        borderColor: palette.border,
      },
      datePillText: {
        fontSize: 12,
        fontWeight: "700",
        color: palette.brandNavy,
      },
      bufferNote: {
        ...typography.caption,
        color: palette.textMuted,
        fontStyle: "italic",
      },
      loadingBox: {
        alignItems: "center",
        paddingVertical: space.xl,
        gap: space.sm,
      },
      loadingText: { ...typography.bodySm, color: palette.textMuted },
      emptyCard: {
        alignItems: "center",
        paddingVertical: space.xl,
        paddingHorizontal: space.lg,
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
      periodsWrap: { gap: space.lg },
      periodBlock: { gap: space.sm },
      periodHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      },
      periodTitle: {
        ...typography.label,
        color: palette.textSecondary,
        fontWeight: "700",
        flex: 1,
      },
      periodCount: {
        ...typography.caption,
        color: palette.textMuted,
        fontWeight: "600",
      },
      timeGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
      },
      timeChip: {
        paddingVertical: 11,
        paddingHorizontal: 16,
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
      timeChipText: { fontSize: 15, fontWeight: "700", color: palette.text },
      timeChipTextOn: { color: palette.brandTextOn },
      selectedCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        padding: space.md,
        borderRadius: radii.lg,
        backgroundColor: palette.surfaceElevated,
        borderWidth: 2,
        borderColor: palette.success + "55",
      },
      selectedIcon: { marginTop: 2 },
      selectedLabel: {
        ...typography.caption,
        color: palette.textMuted,
        fontWeight: "600",
      },
      selectedValue: {
        ...typography.bodySm,
        color: palette.text,
        fontWeight: "700",
        marginTop: 2,
      },
      cta: { marginTop: space.xs },
    })
  );
}
