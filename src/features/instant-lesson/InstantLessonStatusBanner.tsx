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
import { colors } from "../../theme/tokens";
import { useInstantLesson } from "./InstantLessonContext";

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
  const { traineeBooking, restoreBooking, joinAcceptedLesson, clearTraineeBooking } =
    useInstantLesson();

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(-32)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  const accepted = traineeBooking?.step === "accepted";
  const waitingMinimized =
    traineeBooking?.step === "waiting" && !!traineeBooking?.minimized;

  const visible = accepted || waitingMinimized;

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
    if (!accepted) {
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
  }, [accepted, pulse]);

  if (!visible || !traineeBooking) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { top: insets.top + 6 },
        { opacity: fade, transform: [{ translateY: slide }] },
      ]}
    >
      {accepted ? (
        <Animated.View style={[styles.acceptedBanner, { transform: [{ scale: pulse }] }]}>
          <View style={styles.acceptedIcon}>
            <Ionicons name="checkmark" size={18} color="#fff" />
          </View>
          <View style={styles.acceptedText}>
            <Text style={styles.acceptedTitle}>
              {traineeBooking.trainerName} confirmed!
            </Text>
            <Text style={styles.acceptedSub} numberOfLines={1}>
              Your instant lesson is ready — tap Join to enter.
            </Text>
          </View>
          <Pressable style={styles.joinBtn} onPress={joinAcceptedLesson}>
            <Text style={styles.joinBtnText}>Join</Text>
          </Pressable>
          <Pressable hitSlop={8} onPress={clearTraineeBooking} style={styles.closeIcon}>
            <Ionicons name="close" size={16} color="#fff" />
          </Pressable>
        </Animated.View>
      ) : (
        <Pressable style={styles.pill} onPress={restoreBooking}>
          <Ionicons name="time-outline" size={16} color={colors.brandNavy} />
          <Text style={styles.pillText} numberOfLines={1}>
            Waiting for {traineeBooking.trainerName}…
          </Text>
          <Ionicons name="chevron-up" size={16} color={colors.brandNavy} />
        </Pressable>
      )}
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
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 999,
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
  pillText: { fontSize: 13, fontWeight: "700", color: colors.brandNavy, maxWidth: 220 },

  acceptedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#0f9d58",
    borderRadius: 14,
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
  acceptedTitle: { fontSize: 14, fontWeight: "800", color: "#fff" },
  acceptedSub: { fontSize: 12, color: "rgba(255,255,255,0.92)", marginTop: 1 },
  joinBtn: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  joinBtnText: { fontSize: 13, fontWeight: "800", color: "#0f9d58" },
  closeIcon: { padding: 4 },
});
