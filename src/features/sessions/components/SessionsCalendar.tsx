import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, space, typography } from "../../../theme";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Props = {
  /** First day of the visible month. */
  monthAnchor: Date;
  selectedDate: string | null;
  sessionDates: Set<string>;
  onMonthChange: (delta: number) => void;
  onSelectDate: (key: string | null) => void;
  todayKey: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function SessionsCalendar({
  monthAnchor,
  selectedDate,
  sessionDates,
  onMonthChange,
  onSelectDate,
  todayKey,
}: Props) {
  const { weeks, monthTitle } = useMemo(() => {
    const year = monthAnchor.getFullYear();
    const month = monthAnchor.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startPad = first.getDay();
    const totalDays = last.getDate();

    const cells: Array<{ key: string; day: number; inMonth: boolean; date: Date } | null> = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month, d);
      cells.push({ key: dateKey(date), day: d, inMonth: true, date });
    }
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks: Array<Array<(typeof cells)[0]>> = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }

    const monthTitle = first.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    return { weeks, monthTitle };
  }, [monthAnchor]);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable
          onPress={() => onMonthChange(-1)}
          hitSlop={12}
          style={styles.navBtn}
          accessibilityLabel="Previous month"
        >
          <Ionicons name="chevron-back" size={22} color={colors.brandNavy} />
        </Pressable>
        <Text style={styles.monthTitle}>{monthTitle}</Text>
        <Pressable
          onPress={() => onMonthChange(1)}
          hitSlop={12}
          style={styles.navBtn}
          accessibilityLabel="Next month"
        >
          <Ionicons name="chevron-forward" size={22} color={colors.brandNavy} />
        </Pressable>
      </View>

      <View style={styles.quickRow}>
        <Pressable
          style={[styles.quickPill, !selectedDate && styles.quickPillActive]}
          onPress={() => onSelectDate(null)}
        >
          <Text style={[styles.quickText, !selectedDate && styles.quickTextActive]}>All</Text>
        </Pressable>
        <Pressable
          style={[styles.quickPill, selectedDate === todayKey && styles.quickPillActive]}
          onPress={() => onSelectDate(todayKey)}
        >
          <Text style={[styles.quickText, selectedDate === todayKey && styles.quickTextActive]}>
            Today
          </Text>
        </Pressable>
      </View>

      <View style={styles.weekHeader}>
        {DAY_LABELS.map((d) => (
          <Text key={d} style={styles.weekLabel}>
            {d}
          </Text>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={`w-${wi}`} style={styles.weekRow}>
          {week.map((cell, ci) => {
            if (!cell) {
              return <View key={`e-${wi}-${ci}`} style={styles.dayCell} />;
            }
            const isSelected = selectedDate === cell.key;
            const isToday = cell.key === todayKey;
            const hasSession = sessionDates.has(cell.key);
            return (
              <Pressable
                key={cell.key}
                style={[
                  styles.dayCell,
                  isSelected && styles.daySelected,
                  isToday && !isSelected && styles.dayToday,
                ]}
                onPress={() => onSelectDate(isSelected ? null : cell.key)}
              >
                <Text
                  style={[
                    styles.dayNum,
                    isSelected && styles.dayNumSelected,
                    isToday && !isSelected && styles.dayNumToday,
                  ]}
                >
                  {cell.day}
                </Text>
                {hasSession ? (
                  <View style={[styles.dot, isSelected && styles.dotSelected]} />
                ) : (
                  <View style={styles.dotPlaceholder} />
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingBottom: space.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.xs,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  monthTitle: { ...typography.subtitle, color: colors.brandNavy, fontWeight: "700" },
  quickRow: {
    flexDirection: "row",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  quickPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickPillActive: {
    backgroundColor: colors.brandNavy,
    borderColor: colors.brandNavy,
  },
  quickText: { ...typography.label, color: colors.textMuted },
  quickTextActive: { color: colors.brandTextOn },
  weekHeader: {
    flexDirection: "row",
    paddingHorizontal: space.sm,
    marginBottom: 4,
  },
  weekLabel: {
    flex: 1,
    textAlign: "center",
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "600",
  },
  weekRow: { flexDirection: "row", paddingHorizontal: space.sm },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    margin: 2,
  },
  daySelected: { backgroundColor: colors.brandNavy },
  dayToday: { borderWidth: 1.5, borderColor: colors.brandNavy },
  dayNum: { ...typography.bodySm, color: colors.text, fontWeight: "600" },
  dayNumSelected: { color: colors.brandTextOn },
  dayNumToday: { color: colors.brandNavy },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.brandAccent,
    marginTop: 2,
  },
  dotSelected: { backgroundColor: colors.brandTextOn },
  dotPlaceholder: { width: 5, height: 5, marginTop: 2 },
});
