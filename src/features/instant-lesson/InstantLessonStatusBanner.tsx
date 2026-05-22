import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { colors, radii, typography } from "../../theme";
import { queryKeys } from "../../lib/queryKeys";
import { fetchScheduledMeetings } from "../home/api/homeApi";
import { canRejoinLesson, isInstantLesson } from "../../lib/sessions/sessionUtils";
import { navigationRef } from "../../navigation/navigationRef";
import { useAuth } from "../auth/context/AuthContext";
import { AccountType } from "../../constants/accountType";
import { confirmTrainerDecline } from "./confirmTrainerDecline";
import { useInstantLesson } from "./InstantLessonContext";
import { InstantLessonDeadlineChip } from "./components/InstantLessonDeadlineChip";

/**
 * Floating banner on top of the app shell that surfaces the trainee's instant-lesson state
 * when the full-screen waiting modal is dismissed (or once the coach accepts).
 *
 * - waiting + minimized → small pill "Waiting for {coach}…" with a tap-to-restore handler.
 * - accepted → prominent green banner with "Join now" + dismiss; mirrors the website behaviour
 *              where the trainee is taken into the live session as soon as the coach confirms.
 */
export function InstantLessonStatusBanner() {
  const insets = useSafeAreaInsets();
  const { accountType } = useAuth();
  const isTrainer = accountType === AccountType.TRAINER;
  const {
    traineeBooking,
    trainerIncoming,
    restoreBooking,
    joinAcceptedLesson,
    clearTraineeBooking,
    joinTrainerLesson,
    restoreTrainerAccepted,
    restoreTrainerIncoming,
    declineRequest,
    clearTrainerIncoming,
  } = useInstantLesson();

  const { data: sessions = [] } = useQuery({
    queryKey: queryKeys.sessions.upcoming,
    queryFn: () => fetchScheduledMeetings("upcoming"),
    staleTime: 30_000,
  });
  const rejoinSession = (sessions as Record<string, unknown>[]).find(
    (s) => isInstantLesson(s) && canRejoinLesson(s)
  );
  const rejoinLessonId = rejoinSession
    ? String(rejoinSession._id ?? rejoinSession.id ?? "")
    : "";
  const showRejoinPill = isTrainer && !!rejoinLessonId && !trainerIncoming;

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(-32)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  /** Show the floating accepted banner only when the user explicitly tapped
   *  "Join later" / minimized — otherwise the InstantLessonTraineeModal owns
   *  the success surface. Same gating for the waiting state. */
  const traineeMinimized = !!traineeBooking?.minimized;
  const traineeAccepted = traineeBooking?.step === "accepted" && traineeMinimized;
  const traineeWaiting = traineeBooking?.step === "waiting" && traineeMinimized;

  const trainerAccepted =
    trainerIncoming?.step === "accepted" && !!trainerIncoming.minimized;
  const trainerWaiting =
    trainerIncoming?.step === "incoming" && !!trainerIncoming.minimized;

  const visible =
    traineeAccepted || traineeWaiting || trainerAccepted || trainerWaiting || showRejoinPill;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(slide, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fade.setValue(0);
      slide.setValue(-32);
    }
  }, [visible, fade, slide]);

  useEffect(() => {
    if (!traineeAccepted && !trainerAccepted) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [traineeAccepted, trainerAccepted, pulse]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { top: insets.top + 6 },
        { opacity: fade, transform: [{ translateY: slide }] },
      ]}
    >
      {trainerAccepted && trainerIncoming ? (
        <Animated.View style={[styles.acceptedBanner, { transform: [{ scale: pulse }] }]}>
          <View style={styles.acceptedIcon}>
            <Ionicons name="checkmark" size={18} color={colors.brandTextOn} />
          </View>
          <View style={styles.acceptedText}>
            <Text style={styles.acceptedTitle}>Instant lesson ready</Text>
            <Text style={styles.acceptedSub} numberOfLines={2}>
              {trainerIncoming.traineeInfo?.fullname ?? "Trainee"} is waiting — tap Join to enter.
            </Text>
          </View>
          <View style={styles.acceptedActions}>
            <InstantLessonDeadlineChip
              deadlineMs={
                trainerIncoming.joinDeadlineAt ?? trainerIncoming.expiresAt
              }
              label="Join within"
              variant="urgent"
            />
            <Pressable style={styles.joinBtn} onPress={joinTrainerLesson}>
              <Text style={styles.joinBtnText}>Join</Text>
            </Pressable>
          </View>
          <Pressable hitSlop={8} onPress={clearTrainerIncoming} style={styles.closeIcon}>
            <Ionicons name="close" size={16} color={colors.brandTextOn} />
          </Pressable>
        </Animated.View>
      ) : traineeAccepted && traineeBooking ? (
        <Animated.View style={[styles.acceptedBanner, { transform: [{ scale: pulse }] }]}>
          <View style={styles.acceptedIcon}>
            <Ionicons name="checkmark" size={18} color={colors.brandTextOn} />
          </View>
          <View style={styles.acceptedText}>
            <Text style={styles.acceptedTitle}>
              {traineeBooking.trainerName} confirmed!
            </Text>
            <Text style={styles.acceptedSub} numberOfLines={1}>
              Your instant lesson is ready — tap Join to enter.
            </Text>
          </View>
          <View style={styles.acceptedActions}>
            {traineeBooking.joinDeadlineAt ? (
              <InstantLessonDeadlineChip
                deadlineMs={traineeBooking.joinDeadlineAt}
                label="Join within"
                variant="urgent"
              />
            ) : null}
            <Pressable style={styles.joinBtn} onPress={joinAcceptedLesson}>
              <Text style={styles.joinBtnText}>Join</Text>
            </Pressable>
          </View>
          <Pressable hitSlop={8} onPress={clearTraineeBooking} style={styles.closeIcon}>
            <Ionicons name="close" size={16} color={colors.brandTextOn} />
          </Pressable>
        </Animated.View>
      ) : trainerWaiting && trainerIncoming ? (
        <View style={styles.pillColumn}>
          <Pressable style={styles.pill} onPress={restoreTrainerIncoming}>
            <Ionicons name="flash" size={16} color={colors.brandNavy} />
            <Text style={styles.pillText} numberOfLines={1}>
              Instant request from {trainerIncoming.traineeInfo?.fullname ?? "trainee"}…
            </Text>
            <Ionicons name="chevron-up" size={16} color={colors.brandNavy} />
          </Pressable>
          <View style={styles.pillFooterRow}>
            <InstantLessonDeadlineChip
              deadlineMs={trainerIncoming.expiresAt}
              label="Respond within"
            />
            <Pressable
              hitSlop={8}
              onPress={() =>
                confirmTrainerDecline(
                  trainerIncoming.traineeInfo?.fullname ?? "Trainee",
                  declineRequest
                )
              }
              style={styles.pillDismiss}
            >
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>
      ) : traineeWaiting && traineeBooking ? (
        <Pressable style={styles.pillColumn} onPress={restoreBooking}>
          <View style={styles.pill}>
            <Ionicons name="time-outline" size={16} color={colors.brandNavy} />
            <Text style={styles.pillText} numberOfLines={1}>
              Waiting for {traineeBooking.trainerName}…
            </Text>
            <Ionicons name="chevron-up" size={16} color={colors.brandNavy} />
          </View>
          {traineeBooking.acceptDeadlineAt ? (
            <InstantLessonDeadlineChip
              deadlineMs={traineeBooking.acceptDeadlineAt}
              label="Coach has"
            />
          ) : null}
        </Pressable>
      ) : showRejoinPill ? (
        <View style={styles.acceptedBanner}>
          <View style={styles.acceptedIcon}>
            <Ionicons name="videocam" size={18} color={colors.brandTextOn} />
          </View>
          <View style={styles.acceptedText}>
            <Text style={styles.acceptedTitle}>Lesson in progress</Text>
            <Text style={styles.acceptedSub} numberOfLines={2}>
              You can rejoin your instant lesson.
            </Text>
          </View>
          <Pressable
            style={styles.joinBtn}
            onPress={() => {
              if (rejoinLessonId && navigationRef.isReady()) {
                navigationRef.navigate("Meeting", { lessonId: rejoinLessonId });
              }
            }}
          >
            <Text style={styles.joinBtnText}>Rejoin lesson</Text>
          </Pressable>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 12,
    right: 12,
    alignItems: "center",
    zIndex: 9999,
  },
  pillColumn: { alignItems: "center", gap: 6, width: "100%" },
  pillFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
  },
  pillDismiss: { padding: 4 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: "100%",
  },
  pillText: { ...typography.bodySm, fontWeight: "700", color: colors.brandNavy, maxWidth: 220 },

  acceptedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.success,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  acceptedIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  acceptedText: { flex: 1 },
  acceptedTitle: { ...typography.bodyMd, fontWeight: "800", color: colors.brandTextOn },
  acceptedSub: { ...typography.caption, color: "rgba(255,255,255,0.92)", marginTop: 1 },
  acceptedActions: { alignItems: "flex-end", gap: 6 },
  joinBtn: {
    backgroundColor: colors.brandTextOn,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  joinBtnText: { ...typography.bodySm, fontWeight: "800", color: colors.success },
  closeIcon: { padding: 4 },
});
