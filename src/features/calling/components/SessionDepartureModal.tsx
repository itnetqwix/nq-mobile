import React, { useEffect } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { SessionDeparturePrompt } from "../useSessionDeparture";

type Props = {
  visible: boolean;
  prompt: SessionDeparturePrompt | null;
  isTrainer: boolean;
  responding: boolean;
  /** Auto-choose "Stay in session" after this many ms (default 5s). 0 disables. */
  autoStayMs?: number;
  onStay: () => void;
  onEndSession: () => void;
};

function roleLabel(role: "trainer" | "trainee", isTrainer: boolean): string {
  if (role === "trainer") return isTrainer ? "the trainee" : "your coach";
  return isTrainer ? "the trainee" : "your trainee";
}

function formatTime(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return null;
  }
}

export function SessionDepartureModal({
  visible,
  prompt,
  isTrainer,
  responding,
  autoStayMs = 5000,
  onStay,
  onEndSession,
}: Props) {
  useEffect(() => {
    if (!visible || !prompt || !autoStayMs || responding) return;
    const id = setTimeout(() => onStay(), autoStayMs);
    return () => clearTimeout(id);
  }, [visible, prompt, autoStayMs, responding, onStay]);

  if (!prompt) return null;

  const who = roleLabel(prompt.departedRole, isTrainer);
  const rejoinTime = formatTime(prompt.rejoinDeadlineAt);
  const bookedEndTime = formatTime(prompt.bookedEndAt);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onStay}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Call ended</Text>
          <Text style={styles.body}>
            {prompt.departedDisplayName} ({who}) ended the call. Do you also want to end this
            session?
          </Text>
          {rejoinTime ? (
            <Text style={styles.meta}>
              They can rejoin until {rejoinTime}
              {bookedEndTime ? ` · session ends at ${bookedEndTime}` : ""}.
            </Text>
          ) : bookedEndTime ? (
            <Text style={styles.meta}>Booked session ends at {bookedEndTime}.</Text>
          ) : null}
          <Text style={styles.hint}>
            If you stay, the timer stays paused until they rejoin or the booked session time ends.
            {!isTrainer && prompt.departedRole === "trainer"
              ? " If they do not return within 2 minutes, you can report a concern."
              : ""}
          </Text>
          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, styles.btnSecondary]}
              onPress={onStay}
              disabled={responding}
            >
              <Text style={styles.btnSecondaryText}>Stay in session</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnPrimary]}
              onPress={onEndSession}
              disabled={responding}
            >
              <Text style={styles.btnPrimaryText}>
                {responding ? "Ending…" : "End session"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 24,
    zIndex: 200,
    elevation: 200,
  },
  card: {
    backgroundColor: "#1c1c1e",
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  title: { color: "#fff", fontSize: 20, fontWeight: "700" },
  body: { color: "#e5e5ea", fontSize: 16, lineHeight: 22 },
  meta: { color: "#c7c7cc", fontSize: 14, lineHeight: 20 },
  hint: { color: "#8e8e93", fontSize: 14, lineHeight: 20 },
  actions: { marginTop: 8, gap: 10 },
  btn: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  btnSecondary: { backgroundColor: "#2c2c2e" },
  btnPrimary: { backgroundColor: "#ff3b30" },
  btnSecondaryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  btnPrimaryText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
