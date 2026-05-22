/**
 * Full-screen incoming instant lesson UI (call-style accept / decline).
 * Accept confirms the session; joining happens in-app under the join timer.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ImageWithSkeleton } from "../../../components/ui";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { colors, radii, space, typography } from "../../../theme";
import { confirmTrainerDecline } from "../confirmTrainerDecline";
import { useInstantLesson } from "../InstantLessonContext";
import { useNativeIncomingCallUi } from "../useNativeIncomingCallUi";
import { InstantLessonDeadlineChip } from "./InstantLessonDeadlineChip";

export function InstantLessonIncomingCallOverlay() {
  const insets = useSafeAreaInsets();
  const nativeCallUi = useNativeIncomingCallUi();
  const {
    trainerIncoming,
    acceptRequest,
    declineRequest,
    minimizeTrainerIncoming,
  } = useInstantLesson();
  const pulse = useRef(new Animated.Value(1)).current;

  const visible =
    !nativeCallUi &&
    !!trainerIncoming &&
    trainerIncoming.step === "incoming" &&
    !trainerIncoming.minimized;

  useEffect(() => {
    if (!visible) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, pulse]);

  if (!visible || !trainerIncoming) return null;

  const trainee = trainerIncoming.traineeInfo;
  const name = trainee?.fullname ?? "Trainee";
  const avatarUrl = getS3ImageUrl(trainee?.profile_picture);

  const promptDecline = () => {
    confirmTrainerDecline(name, declineRequest);
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={promptDecline}
    >
      <View style={[styles.backdrop, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Ionicons name="flash" size={22} color={colors.brandAccent} />
            <Text style={styles.headerTitle}>Instant lesson!</Text>
          </View>

          <Animated.View style={[styles.avatarWrap, { transform: [{ scale: pulse }] }]}>
            {avatarUrl ? (
              <ImageWithSkeleton
                uri={avatarUrl}
                width={96}
                height={96}
                borderRadius={48}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{name[0]?.toUpperCase()}</Text>
              </View>
            )}
          </Animated.View>

          <Text style={styles.name}>{name}</Text>
          <Text style={styles.sub}>wants an instant lesson with you</Text>

          <InstantLessonDeadlineChip
            deadlineMs={trainerIncoming.expiresAt}
            label="Respond within"
            variant="urgent"
          />

          <Text style={styles.hint}>
            Tap Confirm to accept. Decline notifies the trainee. Not now keeps the request on your
            dashboard until the timer ends.
          </Text>

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.declineBtn, pressed && styles.pressed]}
              onPress={promptDecline}
              accessibilityLabel="Decline instant lesson"
            >
              <Ionicons name="close" size={36} color="#fff" />
              <Text style={styles.actionLabel}>Decline</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.acceptBtn, pressed && styles.pressed]}
              onPress={acceptRequest}
              accessibilityLabel="Confirm instant lesson"
            >
              <Ionicons name="checkmark" size={40} color="#fff" />
              <Text style={styles.actionLabel}>Confirm</Text>
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [styles.notNowBtn, pressed && { opacity: 0.85 }]}
            onPress={minimizeTrainerIncoming}
            accessibilityLabel="Respond later from dashboard"
          >
            <Text style={styles.notNowText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    paddingHorizontal: space.lg,
  },
  card: {
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
  headerTitle: {
    ...typography.titleMd,
    fontWeight: "800",
    color: colors.brandNavy,
  },
  avatarWrap: {
    marginBottom: space.sm,
  },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: "700",
    color: colors.brandNavy,
  },
  name: {
    ...typography.titleMd,
    fontWeight: "800",
    color: colors.text,
  },
  sub: {
    ...typography.bodyMd,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: space.sm,
    textAlign: "center",
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: space.sm,
    marginBottom: space.lg,
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xl * 2,
  },
  declineBtn: {
    width: 88,
    minHeight: 88,
    borderRadius: 44,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: 8,
  },
  acceptBtn: {
    width: 88,
    minHeight: 88,
    borderRadius: 44,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: 8,
  },
  actionLabel: {
    ...typography.caption,
    fontWeight: "800",
    color: "#fff",
    marginTop: 2,
  },
  notNowBtn: {
    marginTop: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  notNowText: {
    ...typography.bodySm,
    fontWeight: "700",
    color: colors.brandNavy,
    textDecorationLine: "underline",
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
  },
});
