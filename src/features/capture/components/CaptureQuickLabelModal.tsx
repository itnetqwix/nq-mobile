import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardFormModal } from "../../../components/ui/KeyboardFormModal";
import { colors, radii, space, typography } from "../../../theme";

type Props = {
  visible: boolean;
  defaultLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onSave: (label: string) => void;
};

/** Lightweight label step after recording — keyboard-safe page sheet. */
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

  const handleSave = () => onSave(label.trim() || defaultLabel);

  return (
    <KeyboardFormModal
      visible={visible}
      onClose={busy ? () => {} : onCancel}
      presentationStyle="pageSheet"
      scrollBottomPadding={insets.bottom + 24}
      contentContainerStyle={styles.content}
      footer={
        <View style={styles.actions}>
          <Pressable style={styles.secondaryBtn} onPress={onCancel} disabled={busy}>
            <Text style={styles.secondaryText}>Discard</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={busy}
          >
            <Ionicons name="checkmark" size={18} color="#fff" />
            <Text style={styles.primaryText}>{busy ? "Saving…" : "Save clip"}</Text>
          </Pressable>
        </View>
      }
    >
      <View style={styles.iconBadge}>
        <Ionicons name="film-outline" size={26} color={colors.brandNavy} />
      </View>
      <Text style={styles.title}>Name this clip</Text>
      <Text style={styles.sub}>
        Give your clip a title so you can find it later. Leave it blank to use the date.
      </Text>
      <TextInput
        style={styles.input}
        value={label}
        onChangeText={setLabel}
        placeholder="Type a clip title…"
        placeholderTextColor="#9ca3af"
        autoFocus
        editable={!busy}
        returnKeyType="done"
        onSubmitEditing={handleSave}
      />
    </KeyboardFormModal>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingTop: space.lg,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: space.md,
  },
  title: {
    ...typography.titleSm,
    color: "#111827",
    fontWeight: "800",
    fontSize: 20,
    textAlign: "center",
  },
  sub: {
    ...typography.bodySm,
    color: "#6b7280",
    lineHeight: 20,
    marginTop: 6,
    marginBottom: space.lg,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: radii.md,
    paddingHorizontal: space.md,
    paddingVertical: 14,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#f9fafb",
    minHeight: 52,
  },
  actions: { flexDirection: "row", gap: space.sm },
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
