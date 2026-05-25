import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  PanResponder,
  PanResponderGestureState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { haptics } from "../../../../lib/haptics";
import { radii, space, typography, useThemedStyles, useThemeColors } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const START_HOUR = 6;
const END_HOUR = 23;
const SLOT_MINUTES = 30;
const ROWS_PER_HOUR = 60 / SLOT_MINUTES;
const TOTAL_ROWS = (END_HOUR - START_HOUR + 1) * ROWS_PER_HOUR;
const CELL_HEIGHT = 22;
const HEADER_HEIGHT = 28;
const LABEL_WIDTH = 44;

export type PainterRange = { start_time: string; end_time: string };
export type PainterDay = { day: string; slots: PainterRange[] };

type Props = {
  initialDays: PainterDay[];
  onChange: (days: PainterDay[]) => void;
};

/**
 * Drag-to-paint weekly availability grid. Each cell represents a 30 minute
 * block in the trainer's local week (Mon → Sun on x-axis, 06:00 → 23:30 on
 * y-axis). The whole grid lives behind one PanResponder so the trainer can
 * sweep diagonally across many cells in a single gesture instead of
 * tap-tap-tapping each one.
 *
 * On save, contiguous "on" cells are coalesced into `{start_time, end_time}`
 * ranges and pushed via the existing `postTrainerSlots` API which already
 * generates recurring weekly availability for the next 4 weeks.
 */
export function WeeklyAvailabilityPainter({ initialDays, onChange }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();

  const [cells, setCells] = useState<boolean[][]>(() =>
    daysToGrid(initialDays)
  );
  const cellsRef = useRef<boolean[][]>(cells);
  const paintModeRef = useRef<"set" | "clear" | null>(null);
  const lastCellRef = useRef<{ row: number; col: number } | null>(null);
  const gridLayoutRef = useRef<{ x: number; y: number; w: number; h: number }>({
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  });

  useEffect(() => {
    cellsRef.current = cells;
    onChange(gridToDays(cells));
  }, [cells, onChange]);

  useEffect(() => {
    setCells(daysToGrid(initialDays));
  }, [initialDays]);

  const onGridLayout = (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    gridLayoutRef.current = { x, y, w: width, h: height };
  };

  const findCell = (locationX: number, locationY: number) => {
    const layout = gridLayoutRef.current;
    if (!layout.w) return null;
    const colWidth = (layout.w - LABEL_WIDTH) / DAYS.length;
    const col = Math.floor((locationX - LABEL_WIDTH) / colWidth);
    const row = Math.floor((locationY - HEADER_HEIGHT) / CELL_HEIGHT);
    if (col < 0 || col >= DAYS.length) return null;
    if (row < 0 || row >= TOTAL_ROWS) return null;
    return { row, col };
  };

  const paintAt = (row: number, col: number) => {
    const target = paintModeRef.current === "set";
    if (cellsRef.current[row][col] === target) return;
    haptics.select();
    setCells((prev) => {
      const next = prev.map((r) => r.slice());
      next[row][col] = target;
      return next;
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        const cell = findCell(e.nativeEvent.locationX, e.nativeEvent.locationY);
        if (!cell) return;
        const current = cellsRef.current[cell.row][cell.col];
        paintModeRef.current = current ? "clear" : "set";
        lastCellRef.current = cell;
        paintAt(cell.row, cell.col);
      },
      onPanResponderMove: (
        e: GestureResponderEvent,
        _g: PanResponderGestureState
      ) => {
        const cell = findCell(e.nativeEvent.locationX, e.nativeEvent.locationY);
        if (!cell) return;
        if (
          lastCellRef.current &&
          lastCellRef.current.row === cell.row &&
          lastCellRef.current.col === cell.col
        ) {
          return;
        }
        lastCellRef.current = cell;
        paintAt(cell.row, cell.col);
      },
      onPanResponderRelease: () => {
        paintModeRef.current = null;
        lastCellRef.current = null;
      },
      onPanResponderTerminate: () => {
        paintModeRef.current = null;
        lastCellRef.current = null;
      },
    })
  ).current;

  const summary = useMemo(() => {
    let onCells = 0;
    for (const row of cells) for (const cell of row) if (cell) onCells++;
    return {
      hours: (onCells * SLOT_MINUTES) / 60,
      blocks: cells.reduce((acc, row) => acc + countBlocks(row), 0),
    };
  }, [cells]);

  return (
    <View style={styles.wrap}>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: c.brandAccent }]} />
          <Text style={styles.legendText}>
            {t("trainerSchedule.painterAvailable")}
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendDot,
              {
                backgroundColor: c.surfaceMuted,
                borderColor: c.border,
                borderWidth: 1,
              },
            ]}
          />
          <Text style={styles.legendText}>
            {t("trainerSchedule.painterClosed")}
          </Text>
        </View>
        <Text style={[styles.summary, { color: c.textMuted }]}>
          {t("trainerSchedule.painterSummary", {
            hours: summary.hours.toFixed(1),
            blocks: summary.blocks,
          })}
        </Text>
      </View>

      <Pressable
        onPress={() =>
          setCells(Array.from({ length: TOTAL_ROWS }, () => DAYS.map(() => false)))
        }
        style={styles.clearAllBtn}
        accessibilityRole="button"
      >
        <Ionicons name="trash-outline" size={14} color={c.textMuted} />
        <Text style={[styles.clearAllText, { color: c.textMuted }]}>
          {t("trainerSchedule.painterClearAll")}
        </Text>
      </Pressable>

      <View
        style={styles.gridShell}
        onLayout={onGridLayout}
        {...panResponder.panHandlers}
      >
        <View style={[styles.header, { height: HEADER_HEIGHT }]}>
          <View style={{ width: LABEL_WIDTH }} />
          {DAYS.map((d) => (
            <View key={d} style={styles.headerCell}>
              <Text
                style={[styles.headerText, { color: c.brandNavy }]}
                numberOfLines={1}
              >
                {d.slice(0, 3).toUpperCase()}
              </Text>
            </View>
          ))}
        </View>
        {Array.from({ length: TOTAL_ROWS }).map((_, rowIdx) => {
          const minutesFromStart = rowIdx * SLOT_MINUTES;
          const hour = START_HOUR + Math.floor(minutesFromStart / 60);
          const minute = minutesFromStart % 60;
          const isHourMark = minute === 0;
          return (
            <View
              key={rowIdx}
              style={[
                styles.rowWrap,
                {
                  height: CELL_HEIGHT,
                  borderTopWidth: isHourMark && rowIdx > 0 ? 1 : 0,
                  borderTopColor: c.borderSubtle,
                },
              ]}
            >
              <View style={[styles.labelCell, { width: LABEL_WIDTH }]}>
                {isHourMark ? (
                  <Text style={[styles.labelText, { color: c.textMuted }]}>
                    {formatHourLabel(hour)}
                  </Text>
                ) : null}
              </View>
              {DAYS.map((d, colIdx) => {
                const on = cells[rowIdx]?.[colIdx];
                return (
                  <View
                    key={`${rowIdx}-${colIdx}`}
                    style={[
                      styles.cell,
                      {
                        backgroundColor: on ? c.brandAccent : c.surfaceElevated,
                        borderColor: c.borderSubtle,
                      },
                    ]}
                  />
                );
              })}
            </View>
          );
        })}
      </View>

      <Text style={[styles.tipText, { color: c.textMuted }]}>
        {t("trainerSchedule.painterTip")}
      </Text>
    </View>
  );
}

function formatHourLabel(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12} ${period}`;
}

function daysToGrid(days: PainterDay[]): boolean[][] {
  const grid = Array.from({ length: TOTAL_ROWS }, () =>
    DAYS.map(() => false)
  );
  const colByDay = new Map<string, number>(DAYS.map((d, i) => [d, i]));
  for (const dayDoc of days) {
    const col = colByDay.get(String(dayDoc.day ?? "").toLowerCase());
    if (col == null) continue;
    for (const slot of dayDoc.slots ?? []) {
      const [sh, sm] = parseHm(slot.start_time);
      const [eh, em] = parseHm(slot.end_time);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      const gridStartMin = START_HOUR * 60;
      const startRow = Math.max(0, Math.floor((startMin - gridStartMin) / SLOT_MINUTES));
      const endRow = Math.min(
        TOTAL_ROWS,
        Math.ceil((endMin - gridStartMin) / SLOT_MINUTES)
      );
      for (let r = startRow; r < endRow; r++) {
        grid[r][col] = true;
      }
    }
  }
  return grid;
}

function gridToDays(grid: boolean[][]): PainterDay[] {
  return DAYS.map((day, col) => {
    const slots: PainterRange[] = [];
    let r = 0;
    while (r < TOTAL_ROWS) {
      if (!grid[r][col]) {
        r++;
        continue;
      }
      const start = r;
      while (r < TOTAL_ROWS && grid[r][col]) r++;
      const end = r;
      const startMin = START_HOUR * 60 + start * SLOT_MINUTES;
      const endMin = START_HOUR * 60 + end * SLOT_MINUTES;
      slots.push({
        start_time: formatHm(startMin),
        end_time: formatHm(endMin),
      });
    }
    return { day, slots };
  });
}

function countBlocks(row: boolean[]): number {
  let count = 0;
  let prev = false;
  for (const cell of row) {
    if (cell && !prev) count++;
    prev = cell;
  }
  return count;
}

function parseHm(s: string | null | undefined): [number, number] {
  if (!s) return [0, 0];
  const parts = s.split(":");
  return [Number(parts[0]) || 0, Number(parts[1]) || 0];
}

function formatHm(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}:${String(m).padStart(2, "0")}:00`;
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      wrap: { gap: space.sm },
      legendRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      },
      legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
      legendDot: { width: 12, height: 12, borderRadius: 3 },
      legendText: {
        fontSize: 11,
        fontWeight: "600",
        color: palette.textMuted,
      },
      summary: {
        fontSize: 11,
        fontWeight: "700",
        marginLeft: "auto",
      },
      clearAllBtn: {
        alignSelf: "flex-end",
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
      },
      clearAllText: { fontSize: 11, fontWeight: "700", textDecorationLine: "underline" },
      gridShell: {
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: palette.border,
        overflow: "hidden",
      },
      header: {
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
        backgroundColor: palette.surfaceMuted,
      },
      headerCell: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
      },
      headerText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6 },
      rowWrap: { flexDirection: "row", alignItems: "stretch" },
      labelCell: { justifyContent: "center", alignItems: "flex-end", paddingRight: 4 },
      labelText: { fontSize: 10, fontWeight: "600" },
      cell: {
        flex: 1,
        borderLeftWidth: 0.5,
      },
      tipText: { ...typography.caption, marginTop: 4 },
    })
  );
}
