import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

import { haptics } from "../../../../lib/haptics";
import {
  radii,
  space,
  typography,
  useThemedStyles,
  useThemeColors,
} from "../../../../theme";
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

/** Full 24-hour day; trainers paint anywhere from midnight to 11 PM block. */
const START_HOUR = 0;
const END_HOUR = 23;

type CellMinutes = 15 | 30 | 60;
const CELL_MINUTES_OPTIONS: CellMinutes[] = [15, 30, 60];
const DEFAULT_CELL_MINUTES: CellMinutes = 30;
const CELL_MINUTES_STORAGE_KEY = "nq.availability.cellMinutes";

const HEADER_HEIGHT = 28;
const LABEL_WIDTH = 48;

/**
 * Cell heights — we shrink a bit when granularity goes finer (15 min) so the
 * grid doesn't grow into an unbrowsable tower. Sub-hour cells use the same
 * compact height; hour cells get a touch more room because they are the
 * dominant row.
 */
function cellHeightForGranularity(g: CellMinutes): number {
  if (g === 60) return 34;
  if (g === 30) return 22;
  return 16; // 15-min
}

export type PainterRange = { start_time: string; end_time: string };
export type PainterDay = { day: string; slots: PainterRange[] };

type Props = {
  initialDays: PainterDay[];
  onChange: (days: PainterDay[]) => void;
  /**
   * Surfaces the painter's drag state so the parent can disable its own
   * ScrollView while a sweep is in progress — otherwise the outer scroll
   * eats the gesture half-way through the row.
   */
  onPaintingChange?: (isPainting: boolean) => void;
};

/**
 * Drag-to-paint weekly availability grid.
 *
 * Each cell represents a `cellMinutes` block (user-toggleable 15 / 30 / 60)
 * in the trainer's local week (Mon → Sun on x-axis, 12:00 AM → 11:00 PM on
 * y-axis). On save, contiguous "on" cells are coalesced into
 * `{start_time, end_time}` ranges and pushed via the existing
 * `postTrainerSlots` API which generates recurring weekly availability.
 *
 * Gesture details:
 *  - Built on `react-native-gesture-handler` `Gesture.Pan()`, which composes
 *    cleanly with the parent `ScrollView`. The pan activates after a 2 px
 *    horizontal/vertical move so a quick vertical scroll still belongs to
 *    the parent.
 *  - Each cell also has a transparent `Pressable` overlay so a single tap
 *    flips that one cell — guarantees the grid works even when the pan
 *    gesture loses to the parent scroll.
 */
export function WeeklyAvailabilityPainter({
  initialDays,
  onChange,
  onPaintingChange,
}: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();

  const [cellMinutes, setCellMinutes] = useState<CellMinutes>(DEFAULT_CELL_MINUTES);

  // Hydrate cell-minutes preference from AsyncStorage on first mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CELL_MINUTES_STORAGE_KEY);
        const n = Number(raw);
        if (
          !cancelled &&
          (n === 15 || n === 30 || n === 60)
        ) {
          setCellMinutes(n as CellMinutes);
        }
      } catch {
        /* no-op: fall back to default granularity */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rowsPerHour = 60 / cellMinutes;
  const totalRows = (END_HOUR - START_HOUR + 1) * rowsPerHour;
  const cellHeight = cellHeightForGranularity(cellMinutes);

  const [cells, setCells] = useState<boolean[][]>(() =>
    daysToGrid(initialDays, cellMinutes)
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

  // We keep `onChange` in a ref so effects that emit upwards don't depend
  // on its identity (parents typically pass an inline arrow which would
  // otherwise re-fire the emit-effect on every render).
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const onPaintingChangeRef = useRef(onPaintingChange);
  useEffect(() => {
    onPaintingChangeRef.current = onPaintingChange;
  }, [onPaintingChange]);

  const lastEmittedJsonRef = useRef<string>("");
  const lastInitialJsonRef = useRef<string>(
    JSON.stringify(daysToGrid(initialDays, cellMinutes))
  );

  // Emit cells → parent only when content actually changed since the last
  // emit. Reference compare would feedback-loop with the parent setState.
  useEffect(() => {
    cellsRef.current = cells;
    const json = JSON.stringify(cells);
    if (json === lastEmittedJsonRef.current) return;
    lastEmittedJsonRef.current = json;
    onChangeRef.current(gridToDays(cells, cellMinutes));
  }, [cells, cellMinutes]);

  // Re-sync from `initialDays` only when its structural content changes
  // (e.g. the user reloads the screen / a fresh fetch returns new data).
  useEffect(() => {
    const next = daysToGrid(initialDays, cellMinutes);
    const json = JSON.stringify(next);
    if (json === lastInitialJsonRef.current) return;
    lastInitialJsonRef.current = json;
    lastEmittedJsonRef.current = json;
    setCells(next);
  }, [initialDays, cellMinutes]);

  // When the user flips granularity, rebuild the cells matrix from the
  // current `gridToDays(cells)` representation at the new granularity so
  // existing painted ranges survive the switch (a 1-hour block stays
  // a 1-hour block whether shown as 1 cell or 4).
  const changeCellMinutes = useCallback(
    async (next: CellMinutes) => {
      if (next === cellMinutes) return;
      // Convert current grid back to ranges, then re-bake at the new
      // granularity. Ranges are minute-precise so this is lossless for
      // 60→30→15; going coarser snaps to the new boundary.
      const ranges = gridToDays(cellsRef.current, cellMinutes);
      setCellMinutes(next);
      const rebaked = daysToGrid(ranges, next);
      lastInitialJsonRef.current = JSON.stringify(rebaked);
      lastEmittedJsonRef.current = lastInitialJsonRef.current;
      setCells(rebaked);
      try {
        await AsyncStorage.setItem(CELL_MINUTES_STORAGE_KEY, String(next));
      } catch {
        /* persistence is best-effort; the state change is the source of truth */
      }
    },
    [cellMinutes]
  );

  const onGridLayout = (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    gridLayoutRef.current = { x, y, w: width, h: height };
  };

  const findCell = useCallback(
    (locationX: number, locationY: number) => {
      const layout = gridLayoutRef.current;
      if (!layout.w) return null;
      const colWidth = (layout.w - LABEL_WIDTH) / DAYS.length;
      const col = Math.floor((locationX - LABEL_WIDTH) / colWidth);
      const row = Math.floor((locationY - HEADER_HEIGHT) / cellHeight);
      if (col < 0 || col >= DAYS.length) return null;
      if (row < 0 || row >= totalRows) return null;
      return { row, col };
    },
    [cellHeight, totalRows]
  );

  const paintAt = useCallback((row: number, col: number, mode: "set" | "clear") => {
    const target = mode === "set";
    if (cellsRef.current[row]?.[col] === target) return;
    haptics.select();
    setCells((prev) => {
      if (prev[row]?.[col] === target) return prev;
      const next = prev.map((r) => r.slice());
      next[row][col] = target;
      return next;
    });
  }, []);

  const setIsPaintingJs = useCallback((flag: boolean) => {
    onPaintingChangeRef.current?.(flag);
  }, []);

  const beginPaint = useCallback(
    (locationX: number, locationY: number) => {
      const cell = findCell(locationX, locationY);
      if (!cell) return;
      const current = cellsRef.current[cell.row][cell.col];
      const mode: "set" | "clear" = current ? "clear" : "set";
      paintModeRef.current = mode;
      lastCellRef.current = cell;
      paintAt(cell.row, cell.col, mode);
    },
    [findCell, paintAt]
  );

  const continuePaint = useCallback(
    (locationX: number, locationY: number) => {
      const cell = findCell(locationX, locationY);
      const mode = paintModeRef.current;
      if (!cell || !mode) return;
      if (
        lastCellRef.current &&
        lastCellRef.current.row === cell.row &&
        lastCellRef.current.col === cell.col
      ) {
        return;
      }
      lastCellRef.current = cell;
      paintAt(cell.row, cell.col, mode);
    },
    [findCell, paintAt]
  );

  const endPaint = useCallback(() => {
    paintModeRef.current = null;
    lastCellRef.current = null;
  }, []);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        // Require a small move before we claim the pan so a quick vertical
        // scroll still belongs to the parent ScrollView.
        .activeOffsetX([-2, 2])
        .activeOffsetY([-2, 2])
        .onBegin((e) => {
          runOnJS(setIsPaintingJs)(true);
          runOnJS(beginPaint)(e.x, e.y);
        })
        .onUpdate((e) => {
          runOnJS(continuePaint)(e.x, e.y);
        })
        .onFinalize(() => {
          runOnJS(endPaint)();
          runOnJS(setIsPaintingJs)(false);
        }),
    [beginPaint, continuePaint, endPaint, setIsPaintingJs]
  );

  const toggleCell = useCallback(
    (row: number, col: number) => {
      const current = cellsRef.current[row]?.[col];
      paintAt(row, col, current ? "clear" : "set");
    },
    [paintAt]
  );

  const summary = useMemo(() => {
    let onCells = 0;
    for (const row of cells) for (const cell of row) if (cell) onCells++;
    return {
      hours: (onCells * cellMinutes) / 60,
      blocks: cells.reduce((acc, row) => acc + countBlocks(row), 0),
    };
  }, [cells, cellMinutes]);

  return (
    <View style={styles.wrap}>
      {/* Granularity toggle: 15 / 30 / 60 min cells. The painter remembers
          the trainer's preference across sessions via AsyncStorage. */}
      <View style={styles.granularityRow}>
        <Text style={[styles.granularityLabel, { color: c.textMuted }]}>
          {t("trainerSchedule.painterCellSizeLabel", {
            defaultValue: "Cell size",
          })}
        </Text>
        <View style={styles.granularitySegment}>
          {CELL_MINUTES_OPTIONS.map((opt) => {
            const active = opt === cellMinutes;
            return (
              <Pressable
                key={opt}
                onPress={() => void changeCellMinutes(opt)}
                style={[
                  styles.granularitySegBtn,
                  {
                    backgroundColor: active ? c.brandNavy : "transparent",
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={
                  opt === 60
                    ? t("trainerSchedule.painterCellSize1h", { defaultValue: "1 hour cells" })
                    : t("trainerSchedule.painterCellSizeMin", {
                        defaultValue: "{{n}} minute cells",
                        n: opt,
                      })
                }
              >
                <Text
                  style={[
                    styles.granularitySegText,
                    { color: active ? c.brandTextOn : c.brandNavy },
                  ]}
                >
                  {opt === 60 ? "1h" : `${opt}m`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

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
          setCells(Array.from({ length: totalRows }, () => DAYS.map(() => false)))
        }
        style={styles.clearAllBtn}
        accessibilityRole="button"
      >
        <Ionicons name="trash-outline" size={14} color={c.textMuted} />
        <Text style={[styles.clearAllText, { color: c.textMuted }]}>
          {t("trainerSchedule.painterClearAll")}
        </Text>
      </Pressable>

      <GestureDetector gesture={gesture}>
        <View style={styles.gridShell} onLayout={onGridLayout}>
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
          {Array.from({ length: totalRows }).map((_, rowIdx) => {
            const minutesFromStart = rowIdx * cellMinutes;
            const hour = START_HOUR + Math.floor(minutesFromStart / 60);
            const minute = minutesFromStart % 60;
            const isHourMark = minute === 0;
            return (
              <View
                key={rowIdx}
                style={[
                  styles.rowWrap,
                  {
                    height: cellHeight,
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
                    <Pressable
                      key={`${rowIdx}-${colIdx}`}
                      onPress={() => toggleCell(rowIdx, colIdx)}
                      style={[
                        styles.cell,
                        {
                          backgroundColor: on ? c.brandAccent : c.surfaceElevated,
                          borderColor: c.borderSubtle,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: !!on }}
                      accessibilityLabel={t(
                        "trainerSchedule.painterCellA11y",
                        {
                          defaultValue: "{{day}} {{time}}",
                          day: d,
                          time: formatHm(
                            START_HOUR * 60 + rowIdx * cellMinutes
                          ).slice(0, 5),
                        }
                      )}
                    />
                  );
                })}
              </View>
            );
          })}
        </View>
      </GestureDetector>

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

function daysToGrid(days: PainterDay[], cellMinutes: CellMinutes): boolean[][] {
  const totalRows = (END_HOUR - START_HOUR + 1) * (60 / cellMinutes);
  const grid = Array.from({ length: totalRows }, () =>
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
      const startRow = Math.max(
        0,
        Math.floor((startMin - gridStartMin) / cellMinutes)
      );
      const endRow = Math.min(
        totalRows,
        Math.ceil((endMin - gridStartMin) / cellMinutes)
      );
      for (let r = startRow; r < endRow; r++) {
        grid[r][col] = true;
      }
    }
  }
  return grid;
}

function gridToDays(grid: boolean[][], cellMinutes: CellMinutes): PainterDay[] {
  const totalRows = grid.length;
  return DAYS.map((day, col) => {
    const slots: PainterRange[] = [];
    let r = 0;
    while (r < totalRows) {
      if (!grid[r][col]) {
        r++;
        continue;
      }
      const start = r;
      while (r < totalRows && grid[r][col]) r++;
      const end = r;
      const startMin = START_HOUR * 60 + start * cellMinutes;
      const endMin = START_HOUR * 60 + end * cellMinutes;
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
      granularityRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
      },
      granularityLabel: { fontSize: 11, fontWeight: "700" },
      granularitySegment: {
        flexDirection: "row",
        borderRadius: radii.pill,
        backgroundColor: palette.surfaceMuted,
        padding: 2,
        gap: 2,
      },
      granularitySegBtn: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: radii.pill,
        minWidth: 36,
        alignItems: "center",
      },
      granularitySegText: { fontSize: 11, fontWeight: "800" },
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
      clearAllText: {
        fontSize: 11,
        fontWeight: "700",
        textDecorationLine: "underline",
      },
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
      labelCell: {
        justifyContent: "center",
        alignItems: "flex-end",
        paddingRight: 4,
      },
      labelText: { fontSize: 10, fontWeight: "600" },
      cell: {
        flex: 1,
        borderLeftWidth: 0.5,
      },
      tipText: { ...typography.caption, marginTop: 4 },
    })
  );
}
