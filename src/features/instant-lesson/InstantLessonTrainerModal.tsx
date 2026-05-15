import React, { useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { INSTANT_ACCEPT_WINDOW_MS } from "../../lib/sessions/instantLessonConstants";
import { useInstantLesson } from "./InstantLessonContext";
import { getS3ImageUrl } from "../../lib/imageUtils";
import { Button, ImageWithSkeleton } from "../../components/ui";
import { colors, radii, space, typography } from "../../theme";

export function InstantLessonTrainerModal() {
  const { trainerIncoming, acceptRequest, declineRequest, expireRequest } = useInstantLesson();
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(INSTANT_ACCEPT_WINDOW_MS / 1000));
  const [avatarFailed, setAvatarFailed] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  const avatarUrl = trainerIncoming
    ? getS3ImageUrl(trainerIncoming.traineeInfo?.profile_picture)
    : "";

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUrl]);

  useEffect(() => {
    if (!trainerIncoming) {
      setSecondsLeft(Math.ceil(INSTANT_ACCEPT_WINDOW_MS / 1000));
      pulseRef.current?.stop();
      return;
    }

    const msLeft = Math.max(0, trainerIncoming.expiresAt - Date.now());
    setSecondsLeft(Math.ceil(msLeft / 1000));

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          expireRequest();
          return 0;
        }
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
  }, [trainerIncoming, pulseAnim, expireRequest]);

  if (!trainerIncoming) return null;

  const trainee = trainerIncoming.traineeInfo;
  const traineeName = trainee?.fullname || "Trainee";
  const urgency = secondsLeft <= 10;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Ionicons name="flash" size={22} color={colors.brandNavy} />
            <Text style={styles.headerTitle}>Instant Lesson Request</Text>
          </View>

          <Animated.View style={[styles.avatarWrap, { transform: [{ scale: pulseAnim }] }]}>
            {avatarUrl && !avatarFailed ? (
              <ImageWithSkeleton
                uri={avatarUrl}
                width={88}
                height={88}
                borderRadius={44}
                resizeMode="cover"
                style={styles.avatarRing}
                onLoadError={() => setAvatarFailed(true)}
                accessibilityLabel={`${traineeName} profile photo`}
              />
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
              {secondsLeft >= 60 ? "seconds to respond (up to 1 hour)" : "seconds to respond"}
            </Text>
          </View>

          <View style={styles.btnRow}>
            <Button
              label="Decline"
              leftIcon="close"
              variant="danger"
              onPress={declineRequest}
              size="lg"
              style={styles.flex1}
            />
            <Button
              label="Accept"
              leftIcon="checkmark"
              onPress={acceptRequest}
              size="lg"
              style={styles.flex1}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
    padding: space.md,
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.xl,
    padding: space.lg,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    gap: 12,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { ...typography.titleSm, color: colors.brandNavy },
  avatarWrap: { position: "relative", marginTop: 4 },
  avatarRing: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: colors.brandNavy },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.brandNavy,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.brandSubtle,
  },
  avatarInitial: { fontSize: 34, fontWeight: "700", color: colors.brandTextOn },
  onlineDot: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surfaceElevated,
  },
  traineeName: { ...typography.titleMd, color: colors.text },
  subtitle: { ...typography.bodyMd, color: colors.textMuted },
  countdownBox: {
    backgroundColor: colors.brandSubtle,
    borderRadius: radii.md,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: "center",
    width: "100%",
  },
  countdownUrgent: { backgroundColor: colors.dangerSubtle },
  countdownNum: { fontSize: 40, fontWeight: "800", color: colors.brandNavy },
  countdownNumUrgent: { color: colors.danger },
  countdownLabel: { ...typography.bodySm, color: colors.textMuted, marginTop: 2 },
  countdownLabelUrgent: { color: colors.danger },
  btnRow: { flexDirection: "row", gap: 12, width: "100%", marginTop: 4 },
  flex1: { flex: 1 },
});
