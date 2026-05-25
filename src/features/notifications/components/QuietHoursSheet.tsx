import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { space, typography, useThemeColors } from "../../../theme";
import { haptics } from "../../../lib/haptics";
import { setQuietHours } from "../api/notificationsPrefsApi";

type Initial = {
  enabled: boolean;
  start_minutes: number;
  end_minutes: number;
  timezone: string;
};

type Props = {
  visible: boolean;
  initial: Initial;
  onClose: () => void;
  onApplied: () => void;
};

function buildTimeOptions(): { value: number; label: string }[] {
  const out: { value: number; label: string }[] = [];
  for (let m = 0; m < 24 * 60; m += 30) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = ((h + 11) % 12) + 1;
    out.push({ value: m, label: `${h12}:${String(mm).padStart(2, "0")} ${ampm}` });
  }
  return out;
}

const TIME_OPTIONS = buildTimeOptions();

function TimePickerModal({
  visible,
  initial,
  title,
  onPick,
  onClose,
}: {
  visible: boolean;
  initial: number;
  title: string;
  onPick: (v: number) => void;
  onClose: () => void;
}) {
  const c = useThemeColors();
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.timeSheet, { backgroundColor: c.surfaceElevated }]}>
        <Text style={[typography.titleSm, { color: c.text, marginBottom: 8 }]}>{title}</Text>
        <FlatList
          data={TIME_OPTIONS}
          keyExtractor={(it) => String(it.value)}
          getItemLayout={(_, i) => ({ length: 44, offset: 44 * i, index: i })}
          initialScrollIndex={Math.max(
            0,
            TIME_OPTIONS.findIndex((o) => o.value === initial)
          )}
          renderItem={({ item }) => {
            const selected = item.value === initial;
            return (
              <Pressable
                onPress={() => {
                  haptics.tap();
                  onPick(item.value);
                }}
                style={({ pressed }) => [
                  styles.timeRow,
                  selected && { backgroundColor: c.brandAccentSubtle },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={{ color: selected ? c.brandAccent : c.text, fontWeight: selected ? "700" : "500" }}>
                  {item.label}
                </Text>
                {selected ? <Ionicons name="checkmark" size={18} color={c.brandAccent} /> : null}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

export function QuietHoursSheet({ visible, initial, onClose, onApplied }: Props) {
  const c = useThemeColors();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [start, setStart] = useState(initial.start_minutes);
  const [end, setEnd] = useState(initial.end_minutes);
  const [picker, setPicker] = useState<"start" | "end" | null>(null);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setEnabled(initial.enabled);
      setStart(initial.start_minutes);
      setEnd(initial.end_minutes);
    }
  }, [visible, initial]);

  const tz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || initial.timezone;
    } catch {
      return initial.timezone;
    }
  }, [initial.timezone]);

  const handleSave = async () => {
    haptics.tap();
    setSaving(true);
    try {
      await setQuietHours({
        enabled,
        start_minutes: start,
        end_minutes: end,
        timezone: tz,
      });
      onApplied();
      onClose();
    } catch {
      haptics.error();
    } finally {
      setSaving(false);
    }
  };

  const fmt = (m: number) => TIME_OPTIONS.find((o) => o.value === m)?.label ?? "";

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.surfaceElevated }]}>
        <View style={styles.handle} />
        <Text style={[typography.titleMd, { color: c.text }]}>Quiet hours</Text>
        <Text style={[typography.bodySm, { color: c.textMuted, marginBottom: space.md }]}>
          We'll silence non-urgent push & SMS broadcasts during this window. Calls,
          incoming instant lessons and session-start alerts always come through.
        </Text>

        <View style={styles.toggleRow}>
          <Text style={[typography.bodyMd, { color: c.text }]}>Enable quiet hours</Text>
          <Switch
            value={enabled}
            onValueChange={(v) => {
              haptics.select();
              setEnabled(v);
            }}
            trackColor={{ false: c.neutral200, true: c.brandAccentSubtle }}
            thumbColor={enabled ? c.brandAccent : c.neutral100}
          />
        </View>

        <Pressable
          onPress={() => setPicker("start")}
          style={[styles.pickerRow, { borderColor: c.border, opacity: enabled ? 1 : 0.45 }]}
          disabled={!enabled}
        >
          <Text style={[typography.bodyMd, { color: c.text }]}>From</Text>
          <Text style={[typography.bodyMd, { color: c.brandAccent, fontWeight: "700" }]}>
            {fmt(start)}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setPicker("end")}
          style={[styles.pickerRow, { borderColor: c.border, opacity: enabled ? 1 : 0.45 }]}
          disabled={!enabled}
        >
          <Text style={[typography.bodyMd, { color: c.text }]}>To</Text>
          <Text style={[typography.bodyMd, { color: c.brandAccent, fontWeight: "700" }]}>
            {fmt(end)}
          </Text>
        </Pressable>

        <Text style={[typography.bodySm, { color: c.textMuted, marginTop: space.md }]}>
          Timezone · {tz}
        </Text>

        <Pressable
          onPress={() => void handleSave()}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: c.brandAccent },
            (pressed || saving) && { opacity: 0.85 },
          ]}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.ctaLabel}>Save</Text>
          )}
        </Pressable>

        <TimePickerModal
          visible={picker === "start"}
          initial={start}
          title="Start time"
          onPick={(v) => {
            setStart(v);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
        <TimePickerModal
          visible={picker === "end"}
          initial={end}
          title="End time"
          onPick={(v) => {
            setEnd(v);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.32)" },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    paddingBottom: 32,
    maxHeight: "80%",
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    marginBottom: 14,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 10,
  },
  cta: {
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: space.lg,
  },
  ctaLabel: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  timeSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    paddingBottom: 30,
    maxHeight: "70%",
  },
  timeRow: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    borderRadius: 10,
  },
});
