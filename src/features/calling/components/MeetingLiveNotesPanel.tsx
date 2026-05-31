import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { meetingTheme } from "../meetingTheme";
import type { LiveNote } from "../hooks/useLessonLiveState";

type Props = {
  notes: LiveNote[];
  elapsedSeconds: number;
  onAddNote: (text: string, sharedWithTrainee: boolean) => void;
  bottomOffset?: number;
};

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Trainer-only in-call notes — timestamped and optionally shared with trainee. */
export function MeetingLiveNotesPanel({
  notes,
  elapsedSeconds,
  onAddNote,
  bottomOffset = 120,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [shareWithTrainee, setShareWithTrainee] = useState(true);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onAddNote(text, shareWithTrainee);
    setDraft("");
  };

  return (
    <View style={[styles.wrap, { bottom: bottomOffset }]} pointerEvents="box-none">
      <Pressable
        style={styles.toggle}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel="Session notes"
      >
        <Ionicons name="create-outline" size={16} color="#fff" />
        <Text style={styles.toggleText}>Notes{notes.length ? ` (${notes.length})` : ""}</Text>
      </Pressable>

      {open ? (
        <View style={styles.panel}>
          {notes.slice(-3).map((n) => (
            <View key={n.id} style={styles.noteRow}>
              <Text style={styles.noteMeta}>
                {formatElapsed(n.elapsedSeconds)}
                {n.sharedWithTrainee ? " · shared" : " · private"}
              </Text>
              <Text style={styles.noteText} numberOfLines={2}>
                {n.text}
              </Text>
            </View>
          ))}
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Quick note for this moment…"
            placeholderTextColor="#ffffff99"
            style={styles.input}
            multiline
            maxLength={240}
          />
          <View style={styles.shareRow}>
            <Text style={styles.shareLabel}>Share with trainee</Text>
            <Switch
              value={shareWithTrainee}
              onValueChange={setShareWithTrainee}
              trackColor={{ false: "#ffffff33", true: meetingTheme.navy }}
              thumbColor="#fff"
            />
          </View>
          <Pressable
            style={[styles.saveBtn, !draft.trim() && styles.saveBtnDisabled]}
            onPress={submit}
            disabled={!draft.trim()}
          >
            <Text style={styles.saveText}>Add note</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    right: 12,
    left: 12,
    alignItems: "flex-end",
    zIndex: 26,
  },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#00000099",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  toggleText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  panel: {
    marginTop: 8,
    width: "100%",
    maxWidth: 320,
    alignSelf: "flex-end",
    backgroundColor: "#000000cc",
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  noteRow: { gap: 2 },
  noteMeta: { color: "#ffffffaa", fontSize: 10, fontWeight: "700" },
  noteText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  input: {
    minHeight: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ffffff33",
    padding: 8,
    color: "#fff",
    fontSize: 13,
    textAlignVertical: "top",
  },
  shareRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  shareLabel: { color: "#fff", fontSize: 12, fontWeight: "600" },
  saveBtn: {
    alignSelf: "flex-end",
    backgroundColor: meetingTheme.navy,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveText: { color: "#fff", fontSize: 12, fontWeight: "800" },
});
