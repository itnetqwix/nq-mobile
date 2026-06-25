import { DateTime } from "luxon";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ScheduleBookingCalendar } from "../../../scheduled-booking/components/ScheduleBookingCalendar";
import { SCHEDULE_BOOKING_HORIZON_DAYS } from "../../../scheduled-booking/constants";
import { space, typography, useThemeColors } from "../../../../theme";
import {
  buildTrainerMonthDayStateMap,
  slotsForWeekday,
  type WeeklySlotRow,
} from "../../lib/trainerWeeklyCalendarPreview";

type Props = {
  inventory: WeeklySlotRow[];
  trainerTz: string;
};

export function TrainerAvailabilityCalendarPreview({ inventory, trainerTz }: Props) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const zone = trainerTz.trim() || "America/New_York";
  const [month, setMonth] = useState(() => DateTime.now().setZone(zone).startOf("month"));
  const [selectedIso, setSelectedIso] = useState(() =>
    DateTime.now().setZone(zone).toISODate()!
  );

  const { weeks, getDayState } = useMemo(
    () =>
      buildTrainerMonthDayStateMap({
        inventory,
        month,
        zone,
        horizonDays: SCHEDULE_BOOKING_HORIZON_DAYS,
      }),
    [inventory, month, zone]
  );

  const selectedSlots = useMemo(
    () => slotsForWeekday(inventory, selectedIso, zone),
    [inventory, selectedIso, zone]
  );

  const selectedLabel = DateTime.fromISO(selectedIso, { zone }).toFormat("cccc, MMM d");

  return (
    <View style={styles.root}>
      <Text style={[styles.lead, { color: c.textMuted }]}>
        {t("schedule.horizonPreview", {
          defaultValue:
            "Trainees can book you on highlighted days for the next {{days}} days (based on your weekly hours).",
          days: SCHEDULE_BOOKING_HORIZON_DAYS,
        })}
      </Text>
      <ScheduleBookingCalendar
        traineeTz={zone}
        month={month}
        onMonthChange={setMonth}
        selectedDateIso={selectedIso}
        onSelectDate={setSelectedIso}
        weeks={weeks}
        getDayState={getDayState}
        horizonDays={SCHEDULE_BOOKING_HORIZON_DAYS}
      />
      <View style={styles.dayDetail}>
        <Text style={[styles.dayTitle, { color: c.text }]}>{selectedLabel}</Text>
        {selectedSlots.length === 0 ? (
          <Text style={[styles.dayEmpty, { color: c.textMuted }]}>
            {t("schedule.noSlotsThisDay", {
              defaultValue: "No weekly hours on this weekday — edit your schedule to open it.",
            })}
          </Text>
        ) : (
          selectedSlots.map((slot, i) => (
            <Text key={`${slot.start_time}-${slot.end_time}-${i}`} style={[styles.slotLine, { color: c.textSecondary }]}>
              {slot.start_time ?? "—"} – {slot.end_time ?? "—"}
            </Text>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.sm },
  lead: { ...typography.bodySm, lineHeight: 20 },
  dayDetail: {
    gap: 4,
    paddingTop: space.xs,
  },
  dayTitle: { ...typography.subtitle, fontWeight: "700" },
  dayEmpty: { ...typography.bodySm, fontStyle: "italic" },
  slotLine: { ...typography.bodySm },
});
