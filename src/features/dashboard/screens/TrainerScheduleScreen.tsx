import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Button } from "../../../components/ui";
import { colors, radii, space, typography } from "../../../theme";
import {
  fetchTrainerSlots,
  postTrainerSlots,
  type TrainerScheduleDay,
} from "../../home/api/homeApi";

/** Same day order/casing as web `weekDays` in `nq-frontend-main/app/common/constants.js`. */
const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

type Slot = { start_time: string; end_time: string };
type DayState = { day: string; slots: Slot[] };

/** Web saves `start_time`/`end_time` in `"h:mm:ss"` (24-hour). Use plain HH:mm:ss strings. */
function toHmsString(hour: number, minute: number): string {
  const hh = String(Math.max(0, Math.min(23, hour)));
  const mm = String(minute).padStart(2, "0");
  return `${hh}:${mm}:00`;
}

function parseHms(s?: string): { hour: number; minute: number } {
  if (!s) return { hour: 9, minute: 0 };
  const [h, m] = s.split(":");
  return { hour: Number(h) || 0, minute: Number(m) || 0 };
}

function fmt12(time?: string): string {
  if (!time) return "—";
  const { hour, minute } = parseHms(time);
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${period}`;
}

function compare(a: string, b: string): number {
  /** `"h:mm:ss"` strings sort correctly except when hour has 1 vs 2 digits → normalize. */
  const norm = (s: string) => {
    const { hour, minute } = parseHms(s);
    return hour * 60 + minute;
  };
  return norm(a) - norm(b);
}

function buildDefaultDays(): DayState[] {
  return WEEKDAYS.map((day) => ({ day, slots: [] }));
}

function mergeServerWithDefaults(server: TrainerScheduleDay[]): DayState[] {
  const map = new Map<string, Slot[]>();
  for (const d of server) {
    if (typeof d?.day === "string") {
      map.set(d.day.toLowerCase(), Array.isArray(d.slots) ? d.slots : []);
    }
  }
  return WEEKDAYS.map((day) => ({ day, slots: map.get(day) ?? [] }));
}

function hasOverlap(slots: Slot[]): boolean {
  const sorted = [...slots]
    .map((s) => ({ s: parseHms(s.start_time), e: parseHms(s.end_time) }))
    .map((t) => ({
      start: t.s.hour * 60 + t.s.minute,
      end: t.e.hour * 60 + t.e.minute,
    }))
    .sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i - 1].end) return true;
  }
  return false;
}

function validate(days: DayState[]): string | null {
  for (const d of days) {
    for (const slot of d.slots) {
      if (compare(slot.end_time, slot.start_time) <= 0) {
        return `On ${d.day}, end time must be after start time.`;
      }
    }
    if (hasOverlap(d.slots)) {
      return `On ${d.day}, two time ranges overlap.`;
    }
  }
  return null;
}

/** Web parity time grid: every 30 min, 5 AM through 10 PM. */
const HOURS = Array.from({ length: 18 }, (_, i) => i + 5);
const MINUTES = [0, 30];

function TimePickerModal({
  visible,
  initial,
  title,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  initial: string;
  title: string;
  onCancel: () => void;
  onConfirm: (next: string) => void;
}) {
  const init = parseHms(initial);
  const [hour, setHour] = useState(init.hour);
  const [minute, setMinute] = useState(init.minute);

  useEffect(() => {
    if (visible) {
      setHour(init.hour);
      setMinute(init.minute);
    }
    // We intentionally only refresh when modal opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={styles.pickerBackdrop}>
        <View style={styles.pickerCard}>
          <Text style={styles.pickerTitle}>{title}</Text>

          <View style={styles.pickerRow}>
            <View style={styles.pickerCol}>
              <Text style={styles.pickerColTitle}>Hour</Text>
              <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                {HOURS.map((h) => {
                  const on = hour === h;
                  const period = h >= 12 ? "PM" : "AM";
                  const h12 = h % 12 || 12;
                  return (
                    <Pressable
                      key={h}
                      style={[styles.pickerItem, on && styles.pickerItemOn]}
                      onPress={() => setHour(h)}
                    >
                      <Text style={[styles.pickerItemText, on && styles.pickerItemTextOn]}>
                        {h12} {period}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            <View style={styles.pickerCol}>
              <Text style={styles.pickerColTitle}>Minute</Text>
              <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                {MINUTES.map((m) => {
                  const on = minute === m;
                  return (
                    <Pressable
                      key={m}
                      style={[styles.pickerItem, on && styles.pickerItemOn]}
                      onPress={() => setMinute(m)}
                    >
                      <Text style={[styles.pickerItemText, on && styles.pickerItemTextOn]}>
                        :{String(m).padStart(2, "0")}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          <View style={styles.pickerBtnRow}>
            <Pressable style={styles.pickerCancel} onPress={onCancel}>
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={styles.pickerConfirm}
              onPress={() => onConfirm(toHmsString(hour, minute))}
            >
              <Text style={styles.pickerConfirmText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function TrainerScheduleScreen() {
  const queryClient = useQueryClient();

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["trainerSchedule"],
    queryFn: fetchTrainerSlots,
    staleTime: 30_000,
  });

  const [days, setDays] = useState<DayState[]>(buildDefaultDays);

  useEffect(() => {
    if (Array.isArray(data)) setDays(mergeServerWithDefaults(data));
  }, [data]);

  const [editing, setEditing] = useState<
    | null
    | {
        dayIdx: number;
        slotIdx: number;
        field: "start_time" | "end_time";
      }
  >(null);

  const dirty = useMemo(() => {
    return JSON.stringify(mergeServerWithDefaults(data ?? [])) !== JSON.stringify(days);
  }, [data, days]);

  const updateSlot = (
    dayIdx: number,
    slotIdx: number,
    field: "start_time" | "end_time",
    value: string
  ) => {
    setDays((prev) =>
      prev.map((d, di) =>
        di !== dayIdx
          ? d
          : {
              ...d,
              slots: d.slots.map((s, si) =>
                si !== slotIdx ? s : { ...s, [field]: value }
              ),
            }
      )
    );
  };

  const addSlot = (dayIdx: number) => {
    setDays((prev) =>
      prev.map((d, di) =>
        di !== dayIdx
          ? d
          : {
              ...d,
              slots: [...d.slots, { start_time: "9:00:00", end_time: "10:00:00" }],
            }
      )
    );
  };

  const removeSlot = (dayIdx: number, slotIdx: number) => {
    setDays((prev) =>
      prev.map((d, di) =>
        di !== dayIdx
          ? d
          : { ...d, slots: d.slots.filter((_, si) => si !== slotIdx) }
      )
    );
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const err = validate(days);
      if (err) throw new Error(err);
      const filtered = days.map((d) => ({
        ...d,
        slots: d.slots.filter((s) => s.start_time && s.end_time),
      }));
      await postTrainerSlots(filtered);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trainerSchedule"] });
      queryClient.invalidateQueries({ queryKey: ["trainerAvailability"] });
      Alert.alert("Schedule saved", "Your availability is live.");
    },
    onError: (err: any) => {
      Alert.alert("Could not save", err?.message ?? "Please try again.");
    },
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brandNavy} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.brandNavy}
          />
        }
      >
        {/* <Text style={styles.lead}>
          Same shape as the website schedule (`POST /trainer/update-slots`). Add as many
          time ranges as you want per day. Tap a time to change it.
        </Text> */}

        {days.map((d, dayIdx) => (
          <View key={d.day} style={styles.dayCard}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayTitle}>{d.day}</Text>
              <Pressable style={styles.addBtn} onPress={() => addSlot(dayIdx)}>
                <Ionicons name="add" size={18} color={colors.brandNavy} />
                <Text style={styles.addBtnText}>Add range</Text>
              </Pressable>
            </View>

            {d.slots.length === 0 ? (
              <Text style={styles.dayEmpty}>Unavailable. Tap "Add range" to open this day.</Text>
            ) : (
              d.slots.map((slot, slotIdx) => (
                <View key={slotIdx} style={styles.slotRow}>
                  <Pressable
                    style={styles.timeChip}
                    onPress={() => setEditing({ dayIdx, slotIdx, field: "start_time" })}
                  >
                    <Ionicons name="time-outline" size={14} color={colors.brandNavy} />
                    <Text style={styles.timeChipText}>{fmt12(slot.start_time)}</Text>
                  </Pressable>
                  <Text style={styles.toLabel}>to</Text>
                  <Pressable
                    style={styles.timeChip}
                    onPress={() => setEditing({ dayIdx, slotIdx, field: "end_time" })}
                  >
                    <Ionicons name="time-outline" size={14} color={colors.brandNavy} />
                    <Text style={styles.timeChipText}>{fmt12(slot.end_time)}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.removeBtn}
                    onPress={() => removeSlot(dayIdx, slotIdx)}
                    hitSlop={8}
                    accessibilityLabel="Remove slot"
                  >
                    <Ionicons name="close-circle" size={20} color={colors.danger} />
                  </Pressable>
                </View>
              ))
            )}
          </View>
        ))}

        <Button
          label={dirty ? "Save schedule" : "Up to date"}
          leftIcon="save-outline"
          loading={saveMutation.isPending}
          disabled={!dirty || saveMutation.isPending}
          onPress={() => saveMutation.mutate()}
          style={{ marginTop: space.sm }}
        />
      </ScrollView>

      {editing && (
        <TimePickerModal
          visible
          title={`Set ${editing.field === "start_time" ? "start" : "end"} time`}
          initial={
            days[editing.dayIdx]?.slots[editing.slotIdx]?.[editing.field] ?? "9:00:00"
          }
          onCancel={() => setEditing(null)}
          onConfirm={(next) => {
            updateSlot(editing.dayIdx, editing.slotIdx, editing.field, next);
            setEditing(null);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: space.md, gap: space.md, paddingBottom: space.xl * 2 },
  lead: { ...typography.bodySm, color: colors.textMuted },

  dayCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  dayHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dayTitle: {
    ...typography.titleSm,
    color: colors.brandNavy,
    textTransform: "capitalize",
  },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  addBtnText: { ...typography.bodySm, fontWeight: "700", color: colors.brandNavy },
  dayEmpty: { ...typography.bodySm, fontStyle: "italic", color: colors.textMuted, paddingVertical: 6 },

  slotRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  timeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brandSubtle,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flex: 1,
  },
  timeChipText: { ...typography.bodySm, fontWeight: "600", color: colors.brandNavy },
  toLabel: { ...typography.caption, color: colors.textMuted, paddingHorizontal: 2 },
  removeBtn: { padding: 2 },

  pickerBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
    padding: space.md,
  },
  pickerCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: space.md,
    width: "100%",
    maxWidth: 360,
    gap: space.sm,
    ...(Platform.OS === "android" ? { elevation: 6 } : null),
  },
  pickerTitle: { ...typography.titleSm, color: colors.text, textAlign: "center" },
  pickerRow: { flexDirection: "row", gap: 12 },
  pickerCol: { flex: 1 },
  pickerColTitle: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: 4,
  },
  pickerScroll: { maxHeight: 220, borderRadius: radii.sm, backgroundColor: colors.surface },
  pickerItem: { paddingVertical: 10, alignItems: "center" },
  pickerItemOn: { backgroundColor: colors.brandAccentSubtle },
  pickerItemText: { ...typography.bodyMd, color: colors.text },
  pickerItemTextOn: { color: colors.brandNavy, fontWeight: "700" },

  pickerBtnRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  pickerCancel: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    paddingVertical: 12,
    alignItems: "center",
  },
  pickerCancelText: { ...typography.bodyMd, fontWeight: "700", color: colors.textSecondary },
  pickerConfirm: {
    flex: 1,
    backgroundColor: colors.brandNavy,
    borderRadius: radii.sm,
    paddingVertical: 12,
    alignItems: "center",
  },
  pickerConfirmText: { ...typography.bodyMd, fontWeight: "700", color: colors.brandTextOn },
});
