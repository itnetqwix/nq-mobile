import React, { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { haptics } from "../../../lib/haptics";
import { scheduleChatMessage } from "../api/chatActionsApi";

type Props = {
  visible: boolean;
  conversationId: string;
  onClose: () => void;
};

/**
 * Trainer-side composer for scheduling a chat message for future
 * delivery — "Send tomorrow at 7 AM reminder" pattern. Date pickers
 * stay native (DateTimePicker) so the trainer can pick wall-clock time
 * in their own timezone; the server stores UTC.
 */
export function ScheduledMessageComposer({
  visible,
  conversationId,
  onClose,
}: Props) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [date, setDate] = useState<Date>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 60);
    d.setSeconds(0, 0);
    return d;
  });
  const [picker, setPicker] = useState<"date" | "time" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /** A handful of upcoming day rows for the picker. */
  const dayOptions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return d;
    });
  }, []);
  /** Every 30 minutes across the day. */
  const timeOptions = useMemo(() => {
    const items: { h: number; m: number; label: string }[] = [];
    for (let h = 0; h < 24; h += 1) {
      for (const m of [0, 30] as const) {
        const d = new Date();
        d.setHours(h, m, 0, 0);
        items.push({
          h,
          m,
          label: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
      }
    }
    return items;
  }, []);

  const reset = () => {
    setText("");
    setSubmitting(false);
  };

  const handleSchedule = async () => {
    if (!text.trim()) {
      Alert.alert("Need a message", "Add some text before scheduling.");
      return;
    }
    if (date.getTime() <= Date.now() + 30_000) {
      Alert.alert("Pick a later time", "Schedule at least 30 seconds in the future.");
      return;
    }
    setSubmitting(true);
    try {
      await scheduleChatMessage({
        conversationId,
        content: text.trim(),
        type: "text",
        scheduledFor: date.toISOString(),
        timezone:
          Intl?.DateTimeFormat?.().resolvedOptions().timeZone || "UTC",
      });
      haptics.success();
      queryClient.invalidateQueries({ queryKey: queryKeys.chats.scheduled });
      reset();
      onClose();
    } catch (err: any) {
      haptics.error();
      Alert.alert(
        "Couldn't schedule",
        err?.response?.data?.error || "Try a different time."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (d: Date) =>
    d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>
          <View style={styles.headerRow}>
            <Ionicons name="calendar-outline" size={20} color="#2563EB" />
            <Text style={styles.title}>Schedule message</Text>
            <Pressable hitSlop={12} onPress={onClose}>
              <Ionicons name="close" size={22} color="#374151" />
            </Pressable>
          </View>

          <Text style={styles.label}>Message</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="E.g. Don't forget your 7 AM session tomorrow ☀️"
            placeholderTextColor="#9CA3AF"
            multiline
            style={styles.input}
            maxLength={2000}
          />

          <Text style={styles.label}>Delivery time</Text>
          <View style={styles.row}>
            <Pressable style={styles.pill} onPress={() => setPicker("date")}>
              <Ionicons name="calendar-outline" size={16} color="#2563EB" />
              <Text style={styles.pillLabel}>{formatDate(date)}</Text>
            </Pressable>
            <Pressable style={styles.pill} onPress={() => setPicker("time")}>
              <Ionicons name="time-outline" size={16} color="#2563EB" />
              <Text style={styles.pillLabel}>{formatTime(date)}</Text>
            </Pressable>
          </View>

          <View style={styles.presetsRow}>
            {[
              { label: "+1h", mins: 60 },
              { label: "+3h", mins: 3 * 60 },
              { label: "Tomorrow 7 AM", custom: true },
            ].map((p, i) => (
              <Pressable
                key={i}
                onPress={() => {
                  haptics.select();
                  const d = new Date();
                  if ("mins" in p && p.mins) {
                    d.setMinutes(d.getMinutes() + p.mins);
                  } else if (p.custom) {
                    d.setDate(d.getDate() + 1);
                    d.setHours(7, 0, 0, 0);
                  }
                  setDate(d);
                }}
                style={styles.preset}
              >
                <Text style={styles.presetText}>{p.label}</Text>
              </Pressable>
            ))}
          </View>

          <Modal
            transparent
            visible={!!picker}
            animationType="fade"
            onRequestClose={() => setPicker(null)}
          >
            <View style={styles.pickerBackdrop}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setPicker(null)} />
              <View style={styles.pickerCard}>
                <Text style={styles.pickerTitle}>
                  {picker === "date" ? "Pick a day" : "Pick a time"}
                </Text>
                <FlatList<any>
                  data={(picker === "date" ? dayOptions : timeOptions) as any[]}
                  keyExtractor={(_: any, i: number) => String(i)}
                  style={{ maxHeight: 260 }}
                  renderItem={({ item }: { item: any }) => {
                    if (picker === "date") {
                      const d = item as Date;
                      const isToday =
                        d.toDateString() === new Date().toDateString();
                      const active = d.toDateString() === date.toDateString();
                      return (
                        <Pressable
                          style={[styles.pickerRow, active && styles.pickerRowActive]}
                          onPress={() => {
                            const next = new Date(date);
                            next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                            setDate(next);
                            setPicker(null);
                            haptics.select();
                          }}
                        >
                          <Text style={[styles.pickerRowText, active && styles.pickerRowTextActive]}>
                            {isToday
                              ? `Today · ${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}`
                              : d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                          </Text>
                        </Pressable>
                      );
                    }
                    const t = item as { h: number; m: number; label: string };
                    const active = date.getHours() === t.h && date.getMinutes() === t.m;
                    return (
                      <Pressable
                        style={[styles.pickerRow, active && styles.pickerRowActive]}
                        onPress={() => {
                          const next = new Date(date);
                          next.setHours(t.h, t.m, 0, 0);
                          setDate(next);
                          setPicker(null);
                          haptics.select();
                        }}
                      >
                        <Text style={[styles.pickerRowText, active && styles.pickerRowTextActive]}>
                          {t.label}
                        </Text>
                      </Pressable>
                    );
                  }}
                />
              </View>
            </View>
          </Modal>

          <Pressable
            onPress={handleSchedule}
            disabled={submitting || !text.trim()}
            style={[
              styles.sendBtn,
              (submitting || !text.trim()) && styles.sendBtnDisabled,
            ]}
          >
            <Ionicons name="paper-plane" size={16} color="#FFFFFF" />
            <Text style={styles.sendLabel}>
              {submitting ? "Scheduling…" : "Schedule"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  handleRow: { alignItems: "center", paddingTop: 8, paddingBottom: 4 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#D1D5DB" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  title: { flex: 1, fontSize: 17, fontWeight: "700", color: "#111827" },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 8,
    marginBottom: 6,
  },
  input: {
    minHeight: 90,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: "#111827",
    textAlignVertical: "top",
  },
  row: { flexDirection: "row", gap: 8 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  pillLabel: { color: "#1E3A8A", fontWeight: "600", fontSize: 14 },
  presetsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    flexWrap: "wrap",
  },
  preset: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
  },
  presetText: { fontSize: 12, color: "#374151", fontWeight: "600" },
  sendBtn: {
    marginTop: 16,
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  sendBtnDisabled: { backgroundColor: "#94A3B8" },
  sendLabel: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  pickerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
  },
  pickerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
    textAlign: "center",
  },
  pickerRow: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10 },
  pickerRowActive: { backgroundColor: "#EFF6FF" },
  pickerRowText: { fontSize: 15, color: "#111827" },
  pickerRowTextActive: { color: "#1D4ED8", fontWeight: "700" },
});
