import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../auth/context/AuthContext";
import { colors, radii, space, typography } from "../../theme";

/**
 * `expo-secure-store` keys must match `[A-Za-z0-9._-]`. Two keys exist:
 *
 *   STORAGE_KEY     — set when the user finishes or actively dismisses the
 *                     tour. Used to suppress the auto-trigger forever.
 *   SKIP_AUTO_KEY   — set the *first* time the app sees the user. We rely on
 *                     in-place coach marks for the actual hint surface and
 *                     only fall back to this full tour when the user has
 *                     opted in from Settings.
 *
 * The legacy auto-trigger is preserved for accounts already mid-flow, but
 * new installs never see it — coach marks lead the experience instead.
 */
const STORAGE_KEY = "nq.onboarding-completed";
const SKIP_AUTO_KEY = "nq.onboarding-auto-suppressed";
const { width: SCREEN_W } = Dimensions.get("window");

type Step = {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  title: string;
  description: string;
  tip?: string;
};

const STEPS: Step[] = [
  {
    icon: "hand-right-outline",
    iconBg: "#6366f1",
    title: "Welcome to NetQwix!",
    description:
      "Your all-in-one platform for connecting with expert trainers and getting live, personalized lessons. Let us give you a quick tour!",
  },
  {
    icon: "home-outline",
    iconBg: "#0ea5e9",
    title: "Your Locker",
    description:
      "This is your home base. Access your clips, uploads, saved sessions, and track your learning progress — all in one place.",
    tip: "Home tab",
  },
  {
    icon: "calendar-outline",
    iconBg: "#16a34a",
    title: "Book a Lesson",
    description:
      "Browse available experts, view their profiles and ratings, then book a scheduled lesson at a time that works for you.",
    tip: "Book Expert",
  },
  {
    icon: "flash-outline",
    iconBg: "#f59e0b",
    title: "Instant Lessons",
    description:
      "See who's online right now and start a live lesson instantly! Choose your duration, complete payment, and connect in seconds.",
    tip: "When coaches are online",
  },
  {
    icon: "chatbubbles-outline",
    iconBg: "#8b5cf6",
    title: "Chat & Community",
    description:
      "Message your friends, share clips, and build your network. Connect with trainers and fellow learners through the community.",
    tip: "Chats tab",
  },
  {
    icon: "notifications-outline",
    iconBg: "#ef4444",
    title: "Stay Notified",
    description:
      "Never miss a session! Get real-time notifications for bookings, messages, friend requests, and 5-minute session reminders.",
    tip: "Settings → Notifications",
  },
  {
    icon: "rocket-outline",
    iconBg: "#000080",
    title: "You're All Set!",
    description:
      "Explore the app, book your first lesson, and begin your journey. We're excited to have you on NetQwix!",
  },
];

type OnboardingWalkthroughProps = {
  /**
   * Force the tour open even if the user has already dismissed it. Used by
   * the "Replay onboarding" button in Settings — bypasses the auto-suppress
   * check entirely.
   */
  forceOpen?: boolean;
  /** Called when the tour is dismissed (so the host can clear `forceOpen`). */
  onDismiss?: () => void;
};

export function OnboardingWalkthrough({
  forceOpen = false,
  onDismiss,
}: OnboardingWalkthroughProps = {}) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (forceOpen) {
      setVisible(true);
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
        Animated.timing(slideAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]).start();
      return;
    }
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [done, autoSuppressed] = await Promise.all([
        SecureStore.getItemAsync(STORAGE_KEY),
        SecureStore.getItemAsync(SKIP_AUTO_KEY),
      ]);
      if (done || autoSuppressed || cancelled) return;

      /**
       * New flow: we *suppress* the auto-trigger immediately and rely on
       * coach marks instead. The legacy modal tour stays available via
       * Settings → "Replay tour" for users who want the overview.
       */
      try {
        await SecureStore.setItemAsync(SKIP_AUTO_KEY, "1");
      } catch {
        /* non-blocking */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [forceOpen, user]);

  const animateTransition = useCallback(
    (nextStep: number) => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setStep(nextStep);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    },
    [fadeAnim]
  );

  const dismiss = useCallback(async () => {
    await SecureStore.setItemAsync(STORAGE_KEY, "1");
    setVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  const goNext = useCallback(() => {
    if (step >= STEPS.length - 1) {
      dismiss();
      return;
    }
    animateTransition(step + 1);
  }, [step, dismiss, animateTransition]);

  const goPrev = useCallback(() => {
    if (step <= 0) return;
    animateTransition(step - 1);
  }, [step, animateTransition]);

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.card,
            {
              marginTop: insets.top + 40,
              marginBottom: insets.bottom + 20,
              transform: [{ scale: scaleAnim }],
              opacity: slideAnim,
            },
          ]}
        >
          {/* Close / Skip */}
          <Pressable style={styles.closeBtn} onPress={dismiss} hitSlop={12}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>

          {/* Step dots */}
          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <Pressable
                key={i}
                onPress={() => animateTransition(i)}
                hitSlop={6}
              >
                <View
                  style={[
                    styles.dot,
                    i === step && styles.dotActive,
                    i < step && styles.dotDone,
                  ]}
                />
              </Pressable>
            ))}
          </View>

          {/* Body */}
          <Animated.View style={[styles.body, { opacity: fadeAnim }]}>
            <View style={[styles.iconCircle, { backgroundColor: current.iconBg }]}>
              <Ionicons name={current.icon} size={36} color="#fff" />
            </View>

            <Text style={styles.title}>{current.title}</Text>
            <Text style={styles.desc}>{current.description}</Text>

            {current.tip && (
              <View style={styles.tipBadge}>
                <View style={styles.tipDot} />
                <Text style={styles.tipText}>{current.tip}</Text>
              </View>
            )}
          </Animated.View>

          {/* Footer buttons */}
          <View style={styles.footer}>
            {!isFirst ? (
              <Pressable
                style={({ pressed }) => [
                  styles.btn,
                  styles.btnSecondary,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={goPrev}
              >
                <Ionicons name="arrow-back" size={16} color={colors.textSecondary} />
                <Text style={styles.btnSecondaryText}>Back</Text>
              </Pressable>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.btn,
                  styles.btnGhost,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={dismiss}
              >
                <Text style={styles.btnGhostText}>Skip tour</Text>
              </Pressable>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.btnPrimary,
                pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
              ]}
              onPress={goNext}
            >
              <Text style={styles.btnPrimaryText}>
                {isLast ? "Get Started" : "Next"}
              </Text>
              {!isLast && (
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              )}
            </Pressable>
          </View>

          {/* Counter */}
          <Text style={styles.counter}>
            {step + 1} of {STEPS.length}
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: space.md,
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 24,
    width: "100%",
    maxWidth: 420,
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.25,
        shadowRadius: 32,
      },
      android: { elevation: 24 },
    }),
  },
  closeBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 10,
    padding: 4,
    borderRadius: 8,
  },
  progressTrack: {
    height: 4,
    backgroundColor: colors.borderSubtle,
    borderRadius: 4,
    marginBottom: 18,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.brandNavy,
    borderRadius: 4,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.borderSubtle,
  },
  dotActive: {
    backgroundColor: colors.brandNavy,
    transform: [{ scale: 1.3 }],
  },
  dotDone: {
    backgroundColor: colors.textMuted,
  },
  body: {
    alignItems: "center",
    minHeight: 240,
    justifyContent: "center",
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    ...typography.titleMd,
    color: colors.text,
    textAlign: "center",
    marginBottom: 12,
  },
  desc: {
    ...typography.bodyMd,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 340,
    marginBottom: 14,
  },
  tipBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f0f4ff",
    borderWidth: 1,
    borderColor: "#c7d2fe",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  tipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#6366f1",
  },
  tipText: {
    ...typography.label,
    color: "#3730a3",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 24,
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: radii.md,
  },
  btnPrimary: {
    backgroundColor: colors.brandNavy,
  },
  btnPrimaryText: {
    ...typography.button,
    color: "#fff",
  },
  btnSecondary: {
    backgroundColor: colors.surfaceMuted,
  },
  btnSecondaryText: {
    ...typography.button,
    color: colors.textSecondary,
  },
  btnGhost: {
    backgroundColor: "transparent",
  },
  btnGhostText: {
    ...typography.button,
    color: colors.textMuted,
  },
  counter: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 14,
  },
});
