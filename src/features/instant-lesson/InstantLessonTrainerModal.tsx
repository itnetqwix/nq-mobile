import React, { useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useInstantLesson } from "./InstantLessonContext";
import { getS3ImageUrl } from "../../lib/imageUtils";
import { Button, ImageWithSkeleton } from "../../components/ui";
import { InstantLessonDeadlineChip } from "./components/InstantLessonDeadlineChip";
import { colors, radii, space, typography } from "../../theme";

export function InstantLessonTrainerModal() {
  const {
    trainerIncoming,
    acceptRequest,
    declineRequest,
    expireRequest,
    joinTrainerLesson,
    minimizeTrainerAccepted,
  } = useInstantLesson();
  const [avatarFailed, setAvatarFailed] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  /** Incoming requests use InstantLessonIncomingCallOverlay; this modal is for post-accept. */
  const showModal =
    !!trainerIncoming &&
    trainerIncoming.step === "accepted" &&
    !trainerIncoming.minimized;

  const avatarUrl = trainerIncoming
    ? getS3ImageUrl(trainerIncoming.traineeInfo?.profile_picture)
    : "";

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUrl]);

  useEffect(() => {
    if (!showModal) {
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
  }, [showModal, pulseAnim]);

  if (!trainerIncoming || !showModal) return null;

  const trainee = trainerIncoming.traineeInfo;
  const traineeName = trainee?.fullname || "Trainee";
  const accepted = trainerIncoming.step === "accepted";

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {accepted ? (
            <>
              <View style={styles.successBadge}>
                <Ionicons name="checkmark-circle" size={64} color={colors.success} />
              </View>
              <Text style={styles.title}>Session confirmed!</Text>
              <Text style={styles.sub}>
                <Text style={{ fontWeight: "700" }}>{traineeName}</Text> is waiting. Tap below to
                enter the live lesson when you are ready.
              </Text>
              <InstantLessonDeadlineChip
                deadlineMs={
                  trainerIncoming.joinDeadlineAt ?? trainerIncoming.expiresAt
                }
                label="Join within"
                variant="urgent"
              />
              <Pressable
                style={({ pressed }) => [
                  styles.joinNowBtn,
                  pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
                ]}
                onPress={joinTrainerLesson}
                accessibilityRole="button"
                accessibilityLabel="Join the lesson now"
              >
                <Ionicons name="videocam" size={18} color={colors.brandTextOn} />
                <Text style={styles.joinNowBtnText}>Join now</Text>
              </Pressable>
              <Pressable style={styles.secondaryBtn} onPress={minimizeTrainerAccepted}>
                <Text style={styles.secondaryBtnText}>Join later</Text>
              </Pressable>
            </>
          ) : (
            <>
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

              <InstantLessonDeadlineChip
                deadlineMs={trainerIncoming.expiresAt}
                label="Respond within"
              />

              <View style={styles.btnRow}>
                <Button
                  label="Decline"
                  leftIcon="close-circle-outline"
                  variant="danger"
                  onPress={declineRequest}
                  size="md"
                  style={styles.flex1}
                />
                <Button
                  label="Accept"
                  leftIcon="checkmark-circle-outline"
                  onPress={acceptRequest}
                  size="md"
                  style={styles.flex1}
                />
              </View>
            </>
          )}
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
  successBadge: { marginBottom: space.sm },
  title: { ...typography.titleMd, fontWeight: "800", color: colors.text, textAlign: "center" },
  sub: {
    ...typography.bodyMd,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: space.sm,
    marginBottom: space.md,
    lineHeight: 22,
  },
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
  joinNowBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brandNavy,
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
    width: "100%",
    marginTop: space.sm,
  },
  joinNowBtnText: { ...typography.bodyMd, fontWeight: "800", color: colors.brandTextOn },
  secondaryBtn: {
    marginTop: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  secondaryBtnText: { ...typography.bodySm, fontWeight: "700", color: colors.brandNavy },
});
