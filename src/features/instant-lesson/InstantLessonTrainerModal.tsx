import React, { useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useInstantLesson } from "./InstantLessonContext";
import { getS3ImageUrl } from "../../lib/imageUtils";
import { Button, ImageWithSkeleton } from "../../components/ui";
import { SessionCountdownText } from "../sessions/components/SessionCountdownText";
import { colors, radii, space, typography } from "../../theme";

export function InstantLessonTrainerModal() {
  const { trainerIncoming, acceptRequest, declineRequest, expireRequest } = useInstantLesson();
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
      pulseRef.current?.stop();
      return;
    }

    pulseRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    pulseRef.current.start();

    return () => {
      pulseRef.current?.stop();
    };
  }, [trainerIncoming, pulseAnim]);

  if (!trainerIncoming) return null;

  const trainee = trainerIncoming.traineeInfo;
  const traineeName = trainee?.fullname || "Trainee";

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

          <SessionCountdownText
            deadlineMs={trainerIncoming.expiresAt}
            label="Respond within"
            onExpired={expireRequest}
          />

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
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: space.lg,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    padding: space.lg,
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: space.md,
  },
  headerTitle: { ...typography.titleSm, color: colors.brandNavy, fontWeight: "800" },
  avatarWrap: { marginBottom: space.sm, position: "relative" },
  avatarRing: { borderWidth: 3, borderColor: colors.brandAccent },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 32, fontWeight: "700", color: colors.brandNavy },
  onlineDot: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surfaceElevated,
  },
  traineeName: { ...typography.titleMd, fontWeight: "800", color: colors.text },
  subtitle: { ...typography.bodyMd, color: colors.textMuted, marginTop: 4, marginBottom: space.sm },
  btnRow: { flexDirection: "row", gap: space.sm, marginTop: space.md, width: "100%" },
  flex1: { flex: 1 },
});
