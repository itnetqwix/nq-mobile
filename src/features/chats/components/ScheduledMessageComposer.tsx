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
import { KeyboardFormModal } from "../../../components/ui/KeyboardFormModal";
import { queryKeys } from "../../../lib/queryKeys";
import { haptics } from "../../../lib/haptics";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { scheduleChatMessage } from "../api/chatActionsApi";
import { useChatOverlayStyles } from "../hooks/useChatOverlayStyles";

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
  const c = useThemeColors();
  const overlay = useChatOverlayStyles();
  const styles = useComposerStyles();
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

  const dayOptions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return d;
    });
  }, []);

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
    <KeyboardFormModal
      visible={visible}
      onClose={onClose}
      presentationStyle="pageSheet"
      footer={
        <Pressable
          onPress={handleSchedule}
          disabled={submitting || !text.trim()}
          style={[
            styles.sendBtn,
            (submitting || !text.trim()) && overlay.sendBtnDisabled,
          ]}
        >
          <Ionicons name="paper-plane" size={16} color={c.brandTextOn} />
          <Text style={overlay.sendLabel}>
            {submitting ? "Scheduling…" : "Schedule"}
          </Text>
        </Pressable>
      }
    >
      <View style={overlay.headerRowBetween}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
          <Ionicons name="calendar-outline" size={20} color={c.brand} />
          <Text style={overlay.sheetTitle}>Schedule message</Text>
        </View>
        <Pressable hitSlop={12} onPress={onClose}>
          <Ionicons name="close" size={22} color={c.textSecondary} />
        </Pressable>
      </View>

      <Text style={styles.label}>Message</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="E.g. Don't forget your 7 AM session tomorrow ☀️"
        placeholderTextColor={c.textMuted}
        multiline
        style={styles.input}
        maxLength={2000}
      />

      <Text style={styles.label}>Delivery time</Text>
      <View style={styles.row}>
        <Pressable style={styles.pill} onPress={() => setPicker("date")}>
          <Ionicons name="calendar-outline" size={16} color={c.brand} />
          <Text style={styles.pillLabel}>{formatDate(date)}</Text>
        </Pressable>
        <Pressable style={styles.pill} onPress={() => setPicker("time")}>
          <Ionicons name="time-outline" size={16} color={c.brand} />
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
                  const isToday = d.toDateString() === new Date().toDateString();
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
    </KeyboardFormModal>
  );
}

function useComposerStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      label: {
        ...typography.overline,
        color: palette.textSecondary,
        marginTop: space.sm,
        marginBottom: 6,
      },
      input: {
        minHeight: 90,
        backgroundColor: palette.surfaceMuted,
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: radii.md,
        padding: space.sm,
        ...typography.bodyMd,
        color: palette.text,
        textAlignVertical: "top",
      },
      row: { flexDirection: "row", gap: space.sm },
      pill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: space.sm,
        paddingVertical: 10,
        borderRadius: radii.md,
        backgroundColor: palette.brandSubtle,
        borderWidth: 1,
        borderColor: palette.borderFocus,
      },
      pillLabel: { color: palette.brandNavy, fontWeight: "600", fontSize: 14 },
      presetsRow: {
        flexDirection: "row",
        gap: space.sm,
        marginTop: space.sm,
        flexWrap: "wrap",
      },
      preset: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: palette.surfaceMuted,
        borderRadius: radii.pill,
      },
      presetText: { ...typography.caption, color: palette.textSecondary, fontWeight: "600" },
      sendBtn: {
        marginTop: space.md,
        backgroundColor: palette.brand,
        borderRadius: radii.md,
        paddingVertical: 14,
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "center",
        gap: space.sm,
      },
      pickerBackdrop: {
        flex: 1,
        backgroundColor: palette.scrim,
        justifyContent: "center",
        paddingHorizontal: space.lg,
      },
      pickerCard: {
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.lg,
        padding: space.sm,
      },
      pickerTitle: {
        ...typography.label,
        color: palette.text,
        marginBottom: space.sm,
        textAlign: "center",
      },
      pickerRow: { paddingVertical: 12, paddingHorizontal: space.sm, borderRadius: radii.sm },
      pickerRowActive: { backgroundColor: palette.brandSubtle },
      pickerRowText: { ...typography.bodyMd, color: palette.text },
      pickerRowTextActive: { color: palette.brand, fontWeight: "700" },
    })
  );
}
