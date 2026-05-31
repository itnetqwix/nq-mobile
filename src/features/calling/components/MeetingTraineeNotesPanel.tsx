import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { meetingTheme } from "../meetingTheme";
import type { LiveNote } from "../hooks/useLessonLiveState";

type Props = {
  notes: LiveNote[];
  topOffset?: number;
};

/** Read-only coach notes for trainees during the lesson. */
export function MeetingTraineeNotesPanel({ notes, topOffset = 120 }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (!notes.length) return null;

  return (
    <View style={[styles.wrap, { top: topOffset }]} pointerEvents="box-none">
      <Pressable
        style={styles.header}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
      >
        <Ionicons name="document-text-outline" size={16} color="#fff" />
        <Text style={styles.headerText}>Coach notes ({notes.length})</Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color="#fff"
        />
      </Pressable>
      {expanded ? (
        <ScrollView style={styles.body} nestedScrollEnabled>
          {notes.map((n) => (
            <Text key={n.id} style={styles.line}>
              {n.text}
            </Text>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 18,
    maxHeight: 160,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(15, 23, 42, 0.88)",
  },
  headerText: { flex: 1, color: "#fff", fontSize: 12, fontWeight: "700" },
  body: {
    marginTop: 4,
    maxHeight: 100,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
  },
  line: {
    color: meetingTheme.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 6,
  },
});
