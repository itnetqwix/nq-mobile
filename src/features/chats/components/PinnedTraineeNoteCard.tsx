import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  deleteTraineeNote,
  fetchTraineeNote,
  saveTraineeNote,
  type TraineeNote,
} from "../../dashboard/api/trainerNotesApi";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { haptics } from "../../../lib/haptics";
import {
  getTraineeNoteCollapsed,
  setTraineeNoteCollapsed,
} from "../lib/chatPinnedUiPrefs";
import { radii, space, typography, useThemedStyles, useThemeColors } from "../../../theme";

type Props = {
  traineeId: string;
  traineeName?: string;
};

/**
 * Trainer-only pinned note card sitting above the chat. The trainee never
 * sees this — it's a private "post-it" the trainer can keep for context
 * like injuries, prior session goals, or coaching style preferences.
 */
export function PinnedTraineeNoteCard({ traineeId, traineeName }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const queryKey = useMemo(() => ["trainee-note", traineeId], [traineeId]);
  const { data: note, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchTraineeNote(traineeId),
    staleTime: 60_000,
    enabled: Boolean(traineeId),
  });

  useEffect(() => {
    void getTraineeNoteCollapsed(traineeId).then(setCollapsed);
  }, [traineeId]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    void setTraineeNoteCollapsed(traineeId, next);
    haptics.tap();
  };

  if (isLoading && !note) {
    return null;
  }

  return (
    <>
      <View
        style={[
          styles.shell,
          {
            borderColor: note ? c.brandAccent : c.borderSubtle,
            backgroundColor: note ? c.brandAccentSubtle : c.surfaceMuted,
          },
        ]}
      >
        <Pressable
          onPress={toggleCollapsed}
          style={styles.headerRow}
          accessibilityRole="button"
          accessibilityState={{ expanded: !collapsed }}
        >
          <View style={[styles.iconBubble, { backgroundColor: c.brandAccent }]}>
            <Ionicons name="bookmark" size={12} color={c.brandTextOn} />
          </View>
          <Text style={[styles.title, { color: c.brandAccent }]}>
            {t("traineeNote.pinnedLabel")}
          </Text>
          <View style={{ flex: 1 }} />
          {note ? (
            <Pressable
              hitSlop={6}
              onPress={() => setEditorOpen(true)}
              accessibilityLabel={t("traineeNote.editA11y")}
            >
              <Ionicons name="pencil" size={14} color={c.brandAccent} />
            </Pressable>
          ) : null}
          <Ionicons
            name={collapsed ? "chevron-down" : "chevron-up"}
            size={16}
            color={c.textMuted}
          />
        </Pressable>

        {!collapsed ? (
          note ? (
            <Pressable
              onPress={() => {
                haptics.tap();
                setEditorOpen(true);
              }}
              style={styles.body}
              accessibilityRole="button"
              accessibilityLabel={t("traineeNote.openA11y")}
            >
              <Text style={[styles.text, { color: c.text }]} numberOfLines={4}>
                {note.text}
              </Text>
              {note.tags?.length ? (
                <View style={styles.tagRow}>
                  {note.tags.map((tag) => (
                    <View
                      key={tag}
                      style={[styles.tagChip, { borderColor: c.brandAccent }]}
                    >
                      <Text style={[styles.tagText, { color: c.brandAccent }]}>
                        {tag}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setEditorOpen(true)}
              style={styles.emptyBody}
              accessibilityRole="button"
            >
              <Text style={[styles.emptyText, { color: c.textMuted }]}>
                {t("traineeNote.addCta", { name: traineeName ?? "this trainee" })}
              </Text>
              <Ionicons name="add-circle-outline" size={16} color={c.brandAccent} />
            </Pressable>
          )
        ) : note ? (
          <Text style={[styles.collapsedHint, { color: c.textMuted }]} numberOfLines={1}>
            {note.text}
          </Text>
        ) : null}
      </View>

      <NoteEditorSheet
        visible={editorOpen}
        traineeId={traineeId}
        traineeName={traineeName}
        initial={note ?? null}
        onClose={() => setEditorOpen(false)}
        onSaved={(next) => {
          queryClient.setQueryData(queryKey, next);
          queryClient.invalidateQueries({ queryKey });
        }}
        onDeleted={() => {
          queryClient.setQueryData(queryKey, null);
          queryClient.invalidateQueries({ queryKey });
        }}
      />
    </>
  );
}

function NoteEditorSheet({
  visible,
  traineeId,
  traineeName,
  initial,
  onClose,
  onSaved,
  onDeleted,
}: {
  visible: boolean;
  traineeId: string;
  traineeName?: string;
  initial: TraineeNote | null;
  onClose: () => void;
  onSaved: (note: TraineeNote) => void;
  onDeleted: () => void;
}) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(initial?.text ?? "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);

  useEffect(() => {
    if (!visible) return;
    setText(initial?.text ?? "");
    setTags(initial?.tags ?? []);
    setTagInput("");
  }, [visible, initial]);

  const saveMutation = useMutation({
    mutationFn: () => saveTraineeNote(traineeId, { text: text.trim(), tags }),
    onSuccess: (note) => {
      onSaved(note);
      onClose();
    },
    onError: (err: any) => {
      Alert.alert(t("traineeNote.errorTitle"), err?.message ?? "Could not save note.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTraineeNote(traineeId),
    onSuccess: () => {
      onDeleted();
      onClose();
    },
    onError: (err: any) => {
      Alert.alert(t("traineeNote.errorTitle"), err?.message ?? "Could not remove note.");
    },
  });

  const handleAddTag = () => {
    const next = tagInput.trim().toLowerCase().replace(/[#,]/g, "");
    if (!next || tags.includes(next) || tags.length >= 5) {
      setTagInput("");
      return;
    }
    setTags([...tags, next]);
    setTagInput("");
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.sheetShell, { paddingTop: insets.top + 8 }]}>
        <View style={styles.sheetHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.titleMd, { color: c.text }]}>
              {t("traineeNote.editorTitle")}
            </Text>
            <Text style={[styles.sheetSub, { color: c.textMuted }]}>
              {t("traineeNote.editorSubtitle", { name: traineeName ?? "trainee" })}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={c.text} />
          </Pressable>
        </View>

        <View style={[styles.editorBox, { borderColor: c.border, backgroundColor: c.surfaceElevated }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t("traineeNote.placeholder")}
            placeholderTextColor={c.textMuted}
            multiline
            maxLength={1500}
            style={[styles.editorInput, { color: c.text }]}
          />
          <Text style={[styles.charCount, { color: c.textMuted }]}>
            {text.length}/1500
          </Text>
        </View>

        <View style={styles.tagSection}>
          <Text style={[styles.sectionLabel, { color: c.textMuted }]}>
            {t("traineeNote.tagsLabel")}
          </Text>
          <View style={styles.tagInputRow}>
            <TextInput
              value={tagInput}
              onChangeText={setTagInput}
              placeholder={t("traineeNote.tagPlaceholder")}
              placeholderTextColor={c.textMuted}
              autoCapitalize="none"
              maxLength={20}
              onSubmitEditing={handleAddTag}
              style={[styles.tagInput, { borderColor: c.border, color: c.text }]}
            />
            <Pressable
              onPress={handleAddTag}
              style={[
                styles.addTagBtn,
                { backgroundColor: tagInput.trim() ? c.brandNavy : c.surfaceMuted },
              ]}
              disabled={!tagInput.trim()}
              accessibilityRole="button"
            >
              <Ionicons
                name="add"
                size={16}
                color={tagInput.trim() ? c.brandTextOn : c.textMuted}
              />
            </Pressable>
          </View>
          {tags.length > 0 ? (
            <View style={styles.tagRow}>
              {tags.map((tag) => (
                <Pressable
                  key={tag}
                  onPress={() => setTags(tags.filter((p) => p !== tag))}
                  style={[styles.tagChipEditable, { borderColor: c.brandAccent }]}
                >
                  <Text style={[styles.tagText, { color: c.brandAccent }]}>{tag}</Text>
                  <Ionicons name="close-circle" size={12} color={c.brandAccent} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <View style={[styles.sheetActions, { paddingBottom: insets.bottom + 12 }]}>
          {initial ? (
            <Pressable
              onPress={() =>
                Alert.alert(
                  t("traineeNote.deleteConfirmTitle"),
                  t("traineeNote.deleteConfirmBody"),
                  [
                    { text: t("traineeNote.cancel"), style: "cancel" },
                    {
                      text: t("traineeNote.delete"),
                      style: "destructive",
                      onPress: () => deleteMutation.mutate(),
                    },
                  ]
                )
              }
              style={[styles.deleteBtn, { borderColor: c.error }]}
              accessibilityRole="button"
            >
              <Ionicons name="trash-outline" size={16} color={c.error} />
              <Text style={[styles.deleteText, { color: c.error }]}>
                {t("traineeNote.delete")}
              </Text>
            </Pressable>
          ) : <View style={{ flex: 1 }} />}
          <Pressable
            onPress={() => saveMutation.mutate()}
            disabled={!text.trim() || saveMutation.isPending}
            style={[
              styles.saveBtn,
              {
                backgroundColor: text.trim() ? c.brandNavy : c.surfaceMuted,
              },
            ]}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.saveText,
                { color: text.trim() ? c.brandTextOn : c.textMuted },
              ]}
            >
              {saveMutation.isPending
                ? t("traineeNote.saving")
                : t("traineeNote.save")}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      shell: {
        marginHorizontal: space.md,
        marginTop: space.xs,
        marginBottom: space.xs,
        borderRadius: radii.md,
        borderWidth: 1,
        overflow: "hidden",
      },
      headerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: space.sm,
        paddingVertical: 8,
      },
      body: { paddingHorizontal: space.sm, paddingBottom: space.sm, gap: 6 },
      emptyBody: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: space.sm,
        paddingBottom: space.sm,
      },
      collapsedHint: {
        ...typography.caption,
        paddingHorizontal: space.sm,
        paddingBottom: 8,
        fontWeight: "600",
      },
      iconBubble: {
        width: 18,
        height: 18,
        borderRadius: 4,
        alignItems: "center",
        justifyContent: "center",
      },
      title: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase", flex: 1 },
      text: { ...typography.bodySm, lineHeight: 18 },
      tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
      tagChip: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: radii.pill,
        borderWidth: 1,
      },
      tagText: { fontSize: 10, fontWeight: "700" },
      emptyText: { ...typography.bodySm, flex: 1, fontWeight: "600" },
      sheetShell: {
        flex: 1,
        backgroundColor: palette.surface,
        padding: space.md,
        gap: space.md,
      },
      sheetHeader: { flexDirection: "row", alignItems: "flex-start" },
      sheetSub: { ...typography.bodySm, marginTop: 2 },
      editorBox: {
        borderWidth: 1,
        borderRadius: radii.md,
        padding: space.sm,
        minHeight: 140,
      },
      editorInput: {
        ...typography.bodyMd,
        textAlignVertical: "top",
        minHeight: 110,
      },
      charCount: { fontSize: 10, fontWeight: "600", textAlign: "right" },
      tagSection: { gap: 6 },
      sectionLabel: {
        fontSize: 11,
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: 0.6,
      },
      tagInputRow: { flexDirection: "row", alignItems: "center", gap: 6 },
      tagInput: {
        flex: 1,
        ...typography.bodySm,
        borderWidth: 1,
        borderRadius: radii.md,
        paddingHorizontal: 10,
        paddingVertical: 8,
      },
      addTagBtn: {
        width: 36,
        height: 36,
        borderRadius: radii.md,
        alignItems: "center",
        justifyContent: "center",
      },
      tagChipEditable: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: radii.pill,
        borderWidth: 1,
      },
      sheetActions: {
        marginTop: "auto",
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      },
      deleteBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: radii.pill,
        borderWidth: 1,
      },
      deleteText: { fontSize: 13, fontWeight: "700" },
      saveBtn: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 12,
        borderRadius: radii.pill,
      },
      saveText: { fontSize: 14, fontWeight: "800" },
    })
  );
}
