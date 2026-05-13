/**
 * RatingsModal — native port of `nq-frontend-main/app/components/bookings/ratings/index.jsx`
 *
 * Shown after the call ends. Submits via `postRating` which hits the same
 * `PUT /user/rating` endpoint the web uses, so trainer & trainee reviews are
 * stored under one schema regardless of where they were entered.
 *
 * Trainee fills `recommendRating` too; trainer skips it (web parity).
 */

import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AccountType } from "../../../constants/accountType";
import { postRating } from "../postSessionApi";

type Props = {
  visible: boolean;
  onClose: () => void;
  bookingId: string;
  accountType: string | null;
  /** When true, the modal hides the "title + remarks" requirement (web sets
   *  this when ratings open immediately after a call). */
  isFromCall?: boolean;
};

export function RatingsModal({
  visible,
  onClose,
  bookingId,
  accountType,
  isFromCall = true,
}: Props) {
  const [session, setSession] = useState(0);
  const [audio, setAudio] = useState(0);
  const [recommend, setRecommend] = useState(0);
  const [title, setTitle] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isTrainer = accountType === AccountType.TRAINER;

  const reset = () => {
    setSession(0);
    setAudio(0);
    setRecommend(0);
    setTitle("");
    setRemarks("");
  };

  const handleSubmit = async () => {
    if (session === 0 || audio === 0) {
      Alert.alert("Please rate", "Choose stars for session and audio/video.");
      return;
    }
    if (!isTrainer && recommend === 0) {
      Alert.alert("Please rate", "Tell us whether you'd recommend your coach.");
      return;
    }
    if (!isFromCall && (!title.trim() || !remarks.trim())) {
      Alert.alert("Add details", "Please include a title and short remark.");
      return;
    }
    try {
      setSubmitting(true);
      await postRating({
        booking_id: bookingId,
        sessionRating: session,
        audioVideoRating: audio,
        recommendRating: isTrainer ? null : recommend,
        title: title.trim() || undefined,
        remarksInfo: remarks.trim() || undefined,
        accountType: accountType ?? undefined,
      });
      reset();
      onClose();
    } catch (err: any) {
      Alert.alert(
        "Could not submit",
        err?.response?.data?.message ?? err?.message ?? "Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>How was your session?</Text>
          <Text style={styles.subtitle}>
            Your feedback helps us improve every lesson.
          </Text>

          <StarsRow value={session} onChange={setSession} label="Overall" />
          <StarsRow value={audio} onChange={setAudio} label="Audio / Video" />
          {!isTrainer && (
            <StarsRow
              value={recommend}
              onChange={setRecommend}
              label="Would you recommend?"
            />
          )}

          {!isFromCall && (
            <>
              <TextInput
                placeholder="Title"
                placeholderTextColor="#888"
                value={title}
                onChangeText={setTitle}
                style={styles.input}
              />
              <TextInput
                placeholder="Tell us more (optional)"
                placeholderTextColor="#888"
                value={remarks}
                onChangeText={setRemarks}
                style={[styles.input, styles.textarea]}
                multiline
                numberOfLines={4}
              />
            </>
          )}

          <View style={styles.row}>
            <Pressable onPress={onClose} style={[styles.btn, styles.btnGhost]}>
              <Text style={styles.btnGhostText}>Skip</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              style={[styles.btn, styles.btnPrimary]}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnPrimaryText}>Submit</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function StarsRow({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
}) {
  return (
    <View style={styles.starsRow}>
      <Text style={styles.starsLabel}>{label}</Text>
      <View style={styles.starsInner}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => onChange(n)} hitSlop={4}>
            <Ionicons
              name={value >= n ? "star" : "star-outline"}
              size={26}
              color={value >= n ? "#f5a623" : "#bbb"}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 22,
    gap: 14,
  },
  title: {
    fontSize: 19,
    fontWeight: "700",
    color: "#111",
    textAlign: "center",
  },
  subtitle: { fontSize: 13, color: "#666", textAlign: "center" },
  starsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  starsLabel: { fontSize: 14, color: "#333", flex: 1, paddingRight: 8 },
  starsInner: { flexDirection: "row", gap: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111",
  },
  textarea: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginTop: 6 },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#ddd" },
  btnGhostText: { color: "#555", fontWeight: "600" },
  btnPrimary: { backgroundColor: "#000080" },
  btnPrimaryText: { color: "#fff", fontWeight: "700" },
});
