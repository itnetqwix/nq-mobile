import React, { useEffect, useRef, useState } from "react";
import { Animated, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useInstantLesson } from "./InstantLessonContext";
import { getS3ImageUrl } from "../../lib/imageUtils";
import { space } from "../../theme/tokens";

const NAVY = "#000080";

export function InstantLessonTrainerModal() {
  const { trainerIncoming, acceptRequest, declineRequest } = useInstantLesson();
  const [secondsLeft, setSecondsLeft] = useState(60);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!trainerIncoming) {
      setSecondsLeft(60);
      pulseRef.current?.stop();
      return;
    }

    const msLeft = Math.max(0, trainerIncoming.expiresAt - Date.now());
    setSecondsLeft(Math.ceil(msLeft / 1000));

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);

    pulseRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    pulseRef.current.start();

    return () => {
      clearInterval(interval);
      pulseRef.current?.stop();
    };
  }, [trainerIncoming, pulseAnim]);

  if (!trainerIncoming) return null;

  const trainee = trainerIncoming.traineeInfo;
  const traineeName = trainee?.fullname || "Trainee";
  const avatarUrl = getS3ImageUrl(trainee?.profile_picture);
  const urgency = secondsLeft <= 10;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Ionicons name="flash" size={22} color={NAVY} />
            <Text style={styles.headerTitle}>Instant Lesson Request</Text>
          </View>

          <Animated.View style={[styles.avatarWrap, { transform: [{ scale: pulseAnim }] }]}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{traineeName[0]?.toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.onlineDot} />
          </Animated.View>

          <Text style={styles.traineeName}>{traineeName}</Text>
          <Text style={styles.subtitle}>wants an instant lesson with you</Text>

          <View style={[styles.countdownBox, urgency && styles.countdownUrgent]}>
            <Text style={[styles.countdownNum, urgency && styles.countdownNumUrgent]}>
              {secondsLeft}
            </Text>
            <Text style={[styles.countdownLabel, urgency && styles.countdownLabelUrgent]}>
              seconds to respond
            </Text>
          </View>

          <View style={styles.btnRow}>
            <Pressable
              style={({ pressed }) => [styles.declineBtn, pressed && { opacity: 0.75 }]}
              onPress={declineRequest}
            >
              <Ionicons name="close" size={20} color="#dc2626" />
              <Text style={styles.declineBtnText}>Decline</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.acceptBtn, pressed && { opacity: 0.85 }]}
              onPress={acceptRequest}
            >
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.acceptBtnText}>Accept</Text>
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
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: space.md,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: space.lg,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    gap: 12,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: "700", color: NAVY },
  avatarWrap: { position: "relative", marginTop: 4 },
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: NAVY },
  avatarFallback: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: NAVY, alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: "#7b91e0",
  },
  avatarInitial: { fontSize: 34, fontWeight: "700", color: "#fff" },
  onlineDot: {
    position: "absolute", bottom: 4, right: 4,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: "#16a34a", borderWidth: 2, borderColor: "#fff",
  },
  traineeName: { fontSize: 20, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6b7280" },
  countdownBox: {
    backgroundColor: "#f0f4ff", borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12, alignItems: "center", width: "100%",
  },
  countdownUrgent: { backgroundColor: "#fef2f2" },
  countdownNum: { fontSize: 40, fontWeight: "800", color: NAVY },
  countdownNumUrgent: { color: "#dc2626" },
  countdownLabel: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  countdownLabelUrgent: { color: "#dc2626" },
  btnRow: { flexDirection: "row", gap: 12, width: "100%", marginTop: 4 },
  declineBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, backgroundColor: "#fee2e2", borderRadius: 12, paddingVertical: 13,
  },
  declineBtnText: { fontSize: 15, fontWeight: "700", color: "#dc2626" },
  acceptBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, backgroundColor: NAVY, borderRadius: 12, paddingVertical: 13,
  },
  acceptBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
