import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii, space, typography } from "../../../theme";

type Props = {
  visible: boolean;
  defaultLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onSave: (label: string) => void;
};

/** Lightweight label step after recording — no upload/categorize yet. */
export function CaptureQuickLabelModal({
  visible,
  defaultLabel,
  busy,
  onCancel,
  onSave,
}: Props) {
  const insets = useSafeAreaInsets();
  const [label, setLabel] = useState(defaultLabel);

  useEffect(() => {
    if (visible) setLabel(defaultLabel);
  }, [visible, defaultLabel]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={busy ? undefined : onCancel}>
        <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.md) }]} onPress={() => {}}>
          <Text style={styles.title}>Name this clip</Text>
          <Text style={styles.sub}>Add a quick label, then record more or upload later from your library.</Text>
          <TextInput
            style={styles.input}
            value={label}
            onChangeText={setLabel}
            placeholder="Clip label"
            placeholderTextColor="#9ca3af"
            autoFocus
            editable={!busy}
            returnKeyType="done"
            onSubmitEditing={() => onSave(label.trim() || defaultLabel)}
          />
          <View style={styles.actions}>
            <Pressable style={styles.secondaryBtn} onPress={onCancel} disabled={busy}>
              <Text style={styles.secondaryText}>Discard</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
              onPress={() => onSave(label.trim() || defaultLabel)}
              disabled={busy}
            >
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={styles.primaryText}>{busy ? "Saving…" : "Save clip"}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    gap: space.sm,
  },
  title: { ...typography.titleSm, color: "#111827", fontWeight: "800" },
  sub: { ...typography.bodySm, color: "#6b7280", lineHeight: 20, marginBottom: space.xs },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: radii.md,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#f9fafb",
  },
  actions: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
  },
  secondaryText: { color: "#374151", fontWeight: "600" },
  primaryBtn: {
    flex: 1.4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: radii.md,
    backgroundColor: colors.brandNavy,
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
