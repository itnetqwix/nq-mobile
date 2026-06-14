import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardFormModal } from "../../../components/ui/KeyboardFormModal";
import { sendSessionRecap } from "../../dashboard/api/trainerNotesApi";
import { haptics } from "../../../lib/haptics";
import { radii, space, typography, useThemedStyles, useThemeColors } from "../../../theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSent: () => void;
  sessionId: string;
  traineeId?: string;
  traineeName?: string;
};

export function SessionRecapSheet({
  visible,
  onClose,
  onSent,
  sessionId,
  traineeId,
  traineeName,
}: Props) {
  const c = useThemeColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [summary, setSummary] = useState("");
  const [drills, setDrills] = useState("");
  const [homework, setHomework] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      sendSessionRecap({
        sessionId,
        traineeId,
        summary: summary.trim() || undefined,
        drills: drills.trim() || undefined,
        homework: homework.trim() || undefined,
      }),
    onSuccess: () => {
      haptics.success();
      setSummary("");
      setDrills("");
      setHomework("");
      onSent();
      onClose();
    },
    onError: (err: any) => {
      Alert.alert("Recap could not send", err?.message ?? "Try again in a moment.");
    },
  });

  const hasContent =
    summary.trim().length > 0 ||
    drills.trim().length > 0 ||
    homework.trim().length > 0;

  return (
    <KeyboardFormModal
      visible={visible}
      onClose={onClose}
      presentationStyle="pageSheet"
      contentContainerStyle={{ paddingTop: insets.top + 8 }}
      footer={
        <View style={styles.actions}>
          <Pressable onPress={onClose} style={[styles.skipBtn, { borderColor: c.border }]}>
            <Text style={[styles.skipText, { color: c.text }]}>Skip</Text>
          </Pressable>
          <Pressable
            onPress={() => mutation.mutate()}
            disabled={!hasContent || mutation.isPending}
            style={[
              styles.sendBtn,
              { backgroundColor: hasContent ? c.brandNavy : c.surfaceMuted },
            ]}
            accessibilityRole="button"
          >
            <Ionicons
              name="paper-plane"
              size={16}
              color={hasContent ? c.brandTextOn : c.textMuted}
            />
            <Text
              style={[styles.sendText, { color: hasContent ? c.brandTextOn : c.textMuted }]}
            >
              {mutation.isPending ? "Sending…" : "Send recap"}
            </Text>
          </Pressable>
        </View>
      }
    >
      <View style={[styles.shell, { backgroundColor: c.surface }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: c.text }]}>Session recap</Text>
            <Text style={[styles.sub, { color: c.textMuted }]}>
              Drops as a chat message {traineeName ? `to ${traineeName}` : "to your trainee"}.
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={c.text} />
          </Pressable>
        </View>

        <FieldBlock
          label="Summary"
          icon="document-text-outline"
          placeholder="What did you cover today? E.g. Worked on landing mechanics, lateral cuts."
          value={summary}
          onChange={setSummary}
        />
        <FieldBlock
          label="Drills"
          icon="barbell-outline"
          placeholder="Drills to practice this week. One per line."
          value={drills}
          onChange={setDrills}
          multiline
        />
        <FieldBlock
          label="Homework"
          icon="checkmark-circle-outline"
          placeholder="Anything to do before next session?"
          value={homework}
          onChange={setHomework}
        />
      </View>
    </KeyboardFormModal>
  );
}

function FieldBlock({
  label,
  icon,
  placeholder,
  value,
  onChange,
  multiline,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  const c = useThemeColors();
  const styles = useStyles();
  return (
    <View style={[styles.fieldBox, { borderColor: c.border, backgroundColor: c.surfaceElevated }]}>
      <View style={styles.fieldHeader}>
        <Ionicons name={icon} size={14} color={c.brandNavy} />
        <Text style={[styles.fieldLabel, { color: c.textMuted }]}>{label}</Text>
      </View>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        multiline
        numberOfLines={multiline ? 4 : 2}
        maxLength={500}
        style={[styles.fieldInput, { color: c.text }]}
      />
    </View>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      shell: { gap: space.sm },
      headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
      title: { ...typography.titleMd, fontWeight: "800" },
      sub: { ...typography.bodySm, marginTop: 2 },
      fieldBox: {
        borderWidth: 1,
        borderRadius: radii.md,
        padding: space.sm,
        gap: 6,
      },
      fieldHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
      fieldLabel: {
        fontSize: 11,
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: 0.6,
      },
      fieldInput: {
        ...typography.bodySm,
        minHeight: 56,
        textAlignVertical: "top",
      },
      actions: { flexDirection: "row", gap: 8 },
      skipBtn: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: radii.pill,
        borderWidth: 1,
      },
      skipText: { fontSize: 13, fontWeight: "700" },
      sendBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 12,
        borderRadius: radii.pill,
      },
      sendText: { fontSize: 14, fontWeight: "800" },
    })
  );
}
