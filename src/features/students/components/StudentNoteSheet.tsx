import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardFormModal } from "../../../components/ui/KeyboardFormModal";
import {
  deleteTraineeNote,
  fetchTraineeNote,
  saveTraineeNote,
} from "../../dashboard/api/trainerNotesApi";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { radii, space, typography, useThemeColors } from "../../../theme";

type Props = {
  visible: boolean;
  traineeId: string;
  traineeName: string;
  onClose: () => void;
};

export function StudentNoteSheet({ visible, traineeId, traineeName, onClose }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const queryKey = ["trainee-note", traineeId];

  const { data: note, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchTraineeNote(traineeId),
    enabled: visible && Boolean(traineeId),
  });

  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (visible) setDraft(note?.text ?? "");
  }, [visible, note?.text]);

  const saveMutation = useMutation({
    mutationFn: () => saveTraineeNote(traineeId, { text: draft.trim() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      onClose();
    },
    onError: () => Alert.alert(t("common.error"), t("traineeNote.saveFailed", { defaultValue: "Could not save note." })),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTraineeNote(traineeId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      onClose();
    },
  });

  return (
    <KeyboardFormModal
      visible={visible}
      onClose={onClose}
      presentationStyle="pageSheet"
      contentContainerStyle={{ paddingTop: insets.top + 12 }}
      footer={
        <View style={styles.actions}>
          {note?.text ? (
            <Pressable
              onPress={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              style={styles.danger}
            >
              <Text style={styles.dangerText}>{t("common.delete")}</Text>
            </Pressable>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <Pressable
            onPress={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !draft.trim()}
            style={[styles.save, { backgroundColor: c.brandNavy, opacity: draft.trim() ? 1 : 0.5 }]}
          >
            <Text style={styles.saveText}>{t("common.save")}</Text>
          </Pressable>
        </View>
      }
    >
      <View style={[styles.root, { backgroundColor: c.surface }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: c.text }]}>
            {t("trainees.noteTitle", { name: traineeName, defaultValue: "Note — {{name}}" })}
          </Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel={t("common.close")}>
            <Ionicons name="close" size={26} color={c.text} />
          </Pressable>
        </View>
        <Text style={[styles.hint, { color: c.textMuted }]}>
          {t("traineeNote.privateHint", {
            defaultValue: "Only you see this — same note appears in chat with this trainee.",
          })}
        </Text>
        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={c.brandNavy} />
        ) : (
          <TextInput
            style={[styles.input, { borderColor: c.border, color: c.text }]}
            multiline
            placeholder={t("traineeNote.placeholder", { defaultValue: "Goals, injuries, preferences…" })}
            placeholderTextColor={c.textMuted}
            value={draft}
            onChangeText={setDraft}
            textAlignVertical="top"
          />
        )}
      </View>
    </KeyboardFormModal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { ...typography.titleSm, flex: 1, marginRight: space.sm },
  hint: { ...typography.caption, marginTop: space.sm, lineHeight: 18 },
  input: {
    marginTop: space.md,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: space.md,
    fontSize: 15,
    minHeight: 160,
  },
  actions: { flexDirection: "row", alignItems: "center", gap: space.md },
  danger: { paddingVertical: 12, paddingHorizontal: space.sm },
  dangerText: { color: "#c62828", fontWeight: "600" },
  save: { paddingVertical: 12, paddingHorizontal: space.xl, borderRadius: radii.sm },
  saveText: { color: "#fff", fontWeight: "700" },
});
