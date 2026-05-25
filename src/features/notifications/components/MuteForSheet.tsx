import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { space, typography, useThemeColors } from "../../../theme";
import { haptics } from "../../../lib/haptics";
import { setMuteUntil } from "../api/notificationsPrefsApi";

type Option = {
  id: string;
  label: string;
  /** Returns the `until` Date relative to now. */
  resolve: () => Date;
};

const OPTIONS: Option[] = [
  {
    id: "1h",
    label: "1 hour",
    resolve: () => new Date(Date.now() + 60 * 60 * 1000),
  },
  {
    id: "8h",
    label: "8 hours",
    resolve: () => new Date(Date.now() + 8 * 60 * 60 * 1000),
  },
  {
    id: "24h",
    label: "24 hours",
    resolve: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
  },
  {
    id: "tomorrow",
    label: "Until tomorrow morning",
    resolve: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(7, 0, 0, 0);
      return d;
    },
  },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onApplied: (until: Date) => void;
};

export function MuteForSheet({ visible, onClose, onApplied }: Props) {
  const c = useThemeColors();
  const [busyId, setBusyId] = useState<string | null>(null);

  const handlePick = async (opt: Option) => {
    haptics.tap();
    setBusyId(opt.id);
    try {
      const until = opt.resolve();
      await setMuteUntil(until);
      onApplied(until);
      onClose();
    } catch {
      haptics.error();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.surfaceElevated }]}>
        <View style={styles.handle} />
        <Text style={[typography.titleMd, { color: c.text, marginBottom: 4 }]}>
          Mute notifications
        </Text>
        <Text style={[typography.bodySm, { color: c.textMuted, marginBottom: space.md }]}>
          We'll keep delivering urgent calls and session-starting alerts.
        </Text>
        {OPTIONS.map((opt) => (
          <Pressable
            key={opt.id}
            onPress={() => void handlePick(opt)}
            style={({ pressed }) => [
              styles.row,
              { borderColor: c.border },
              pressed && { opacity: 0.7 },
            ]}
            disabled={busyId !== null}
          >
            <Ionicons name="moon-outline" size={18} color={c.brandAccent} />
            <Text style={[typography.bodyMd, { color: c.text, flex: 1, marginLeft: 12 }]}>
              {opt.label}
            </Text>
            {busyId === opt.id ? (
              <ActivityIndicator color={c.brandAccent} size="small" />
            ) : (
              <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
            )}
          </Pressable>
        ))}
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
    paddingBottom: 30,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
});
