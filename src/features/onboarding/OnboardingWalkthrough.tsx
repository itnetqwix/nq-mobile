/**
 * OnboardingWalkthrough — first-run / replayable tour.
 *
 * Redesigned (May 2026) to use a horizontal swipe pager:
 *   - One card per screen-width page.
 *   - Right→left = next, left→right = back (native scroll feel).
 *   - Hero icon + body crossfade & scale-in driven by the scroll position
 *     (Reanimated `useAnimatedScrollHandler` + `interpolate`).
 *   - Indicator dots widen/colour smoothly with the scroll position.
 *   - Tapping a dot animates to that page.
 *   - Haptic tick on every page change.
 *   - Respects OS Reduce Motion (collapses parallax + spring scale).
 *
 * The legacy modal shell + secure-store gating is kept intact so:
 *   - `forceOpen` from Settings → "Replay tour" still works.
 *   - Existing users that already saw v1 don't see the rewrite (storage
 *     key is bumped to `v2`).
 *   - New installs still get coach-marks as the first-run hint surface;
 *     this full tour stays opt-in via Settings.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewToken,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../auth/context/AuthContext";
import {
  radii,
  space,
  typography,
  useThemeColors,
} from "../../theme";
import { haptics } from "../../lib/haptics";

/**
 * Versioned key so the redesign re-shows for users that already saw v1.
 */
const STORAGE_KEY = "nq.onboarding-completed.v2";
const LEGACY_STORAGE_KEY = "nq.onboarding-completed";
const SKIP_AUTO_KEY = "nq.onboarding-auto-suppressed";

/**
 * `createAnimatedComponent` erases the FlatList generic — we cast through
 * the original component type so we keep `data: Step[]` autocomplete.
 */
const AnimatedFlatList = Animated.createAnimatedComponent(
  FlatList
) as unknown as typeof FlatList;

type Step = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Stable HEX seed for the hero ring — overlaid with theme brand opacity. */
  accent: string;
  titleKey: string;
  titleDefault: string;
  bodyKey: string;
  bodyDefault: string;
  tipKey?: string;
  tipDefault?: string;
};

const STEPS: Step[] = [
  {
    id: "welcome",
    icon: "hand-right-outline",
    accent: "#6366f1",
    titleKey: "onboarding.steps.welcome.title",
    titleDefault: "Welcome to NetQwix",
    bodyKey: "onboarding.steps.welcome.body",
    bodyDefault:
      "Your all-in-one platform for live, personalised coaching. Swipe to take the quick tour.",
  },
  {
    id: "locker",
    icon: "home-outline",
    accent: "#0ea5e9",
    titleKey: "onboarding.steps.locker.title",
    titleDefault: "Your Locker",
    bodyKey: "onboarding.steps.locker.body",
    bodyDefault:
      "Home base for clips, uploads, saved sessions and progress — everything you've worked on, one tap away.",
    tipKey: "onboarding.steps.locker.tip",
    tipDefault: "Home tab",
  },
  {
    id: "book",
    icon: "calendar-outline",
    accent: "#16a34a",
    titleKey: "onboarding.steps.book.title",
    titleDefault: "Book a Lesson",
    bodyKey: "onboarding.steps.book.body",
    bodyDefault:
      "Browse trainers, view ratings, and book a scheduled lesson at a time that fits your week.",
    tipKey: "onboarding.steps.book.tip",
    tipDefault: "Book Expert",
  },
  {
    id: "instant",
    icon: "flash-outline",
    accent: "#f59e0b",
    titleKey: "onboarding.steps.instant.title",
    titleDefault: "Instant Lessons",
    bodyKey: "onboarding.steps.instant.body",
    bodyDefault:
      "See who's online right now, choose your duration, pay, and connect in seconds.",
    tipKey: "onboarding.steps.instant.tip",
    tipDefault: "When trainers are online",
  },
  {
    id: "chat",
    icon: "chatbubbles-outline",
    accent: "#8b5cf6",
    titleKey: "onboarding.steps.chat.title",
    titleDefault: "Chat & Community",
    bodyKey: "onboarding.steps.chat.body",
    bodyDefault:
      "Message friends, share clips, and build your network — react, reply, schedule, and forward without leaving the chat.",
    tipKey: "onboarding.steps.chat.tip",
    tipDefault: "Chats tab",
  },
  {
    id: "notify",
    icon: "notifications-outline",
    accent: "#ef4444",
    titleKey: "onboarding.steps.notify.title",
    titleDefault: "Stay Notified",
    bodyKey: "onboarding.steps.notify.body",
    bodyDefault:
      "Real-time pings for bookings, messages, friend requests, and 5-minute session reminders.",
    tipKey: "onboarding.steps.notify.tip",
    tipDefault: "Settings → Notifications",
  },
  {
    id: "ready",
    icon: "rocket-outline",
    accent: "#000080",
    titleKey: "onboarding.steps.ready.title",
    titleDefault: "You're All Set",
    bodyKey: "onboarding.steps.ready.body",
    bodyDefault:
      "Explore the app, book your first session, and start your journey. We're glad to have you on NetQwix.",
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
  const c = useThemeColors();
  const { t } = useTranslation();

  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  /**
   * `pageWidth` is captured per-mount because the modal can open in
   * different orientations or with different insets. Default is the
   * window width; updated via `onLayout` of the pager wrapper.
   */
  const [pageWidth, setPageWidth] = useState(
    () => Dimensions.get("window").width
  );

  const listRef = useRef<FlatList<Step> | null>(null);

  /** Driver shared value — equals the current horizontal scroll offset. */
  const scrollX = useSharedValue(0);

  /** Hero ring breathing animation. */
  const breathe = useSharedValue(0);

  /** Whether OS Reduce Motion is enabled — collapses parallax & spring. */
  const motionScale = reduceMotion ? 0 : 1;

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (!cancelled) setReduceMotion(Boolean(v));
    });
    const sub = AccessibilityInfo.addEventListener?.(
      "reduceMotionChanged",
      (v) => setReduceMotion(Boolean(v))
    );

    return () => {
      cancelled = true;
      sub?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (forceOpen) {
      setVisible(true);

      return;
    }
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [doneV2, doneV1, autoSuppressed] = await Promise.all([
        SecureStore.getItemAsync(STORAGE_KEY),
        SecureStore.getItemAsync(LEGACY_STORAGE_KEY),
        SecureStore.getItemAsync(SKIP_AUTO_KEY),
      ]);
      if (doneV2 || doneV1 || autoSuppressed || cancelled) return;

      /**
       * Keep the current behavior: new installs land on coach-marks. We
       * stamp the auto-suppress key so the modal never auto-pops. Users
       * can still replay the tour from Settings.
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

  useEffect(() => {
    if (!visible || reduceMotion) return;
    // Gentle hero-ring breathing (only while open & motion allowed).
    breathe.value = withTiming(1, { duration: 2400 });
    const interval = setInterval(() => {
      breathe.value = withTiming(breathe.value > 0.5 ? 0 : 1, {
        duration: 2400,
      });
    }, 2400);

    return () => clearInterval(interval);
  }, [visible, reduceMotion, breathe]);

  const dismiss = useCallback(async () => {
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, "1");
    } catch {
      /* non-blocking */
    }
    setVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  const goTo = useCallback(
    (target: number) => {
      const clamped = Math.max(0, Math.min(STEPS.length - 1, target));
      listRef.current?.scrollToOffset({
        offset: clamped * pageWidth,
        animated: true,
      });
    },
    [pageWidth]
  );

  const goNext = useCallback(() => {
    if (index >= STEPS.length - 1) {
      haptics.success?.();
      dismiss();

      return;
    }
    goTo(index + 1);
  }, [index, goTo, dismiss]);

  const goPrev = useCallback(() => {
    if (index <= 0) return;
    goTo(index - 1);
  }, [index, goTo]);

  /**
   * Reanimated scroll driver — drives indicator + per-page interpolation.
   * The page width is captured in a closure that we re-create when it
   * changes (see deps).
   */
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  /**
   * Native scroll handler (non-worklet) — fires the haptic tick + state
   * update whenever the page snaps. Driven by `onMomentumScrollEnd` so
   * we don't fire mid-flick.
   */
  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const next = Math.round(x / Math.max(1, pageWidth));
      if (next !== index) {
        haptics.select?.();
        setIndex(next);
      }
    },
    [index, pageWidth]
  );

  /** Backup tracker in case `onMomentumScrollEnd` isn't reliable. */
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (!viewableItems.length) return;
      const first = viewableItems[0];
      if (first?.index != null) {
        setIndex((prev) => (prev === first.index ? prev : first.index!));
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  const isLast = index === STEPS.length - 1;

  /**
   * Cached arrays for the dot indicator inputRange (centers of pages).
   * Recreate when `pageWidth` changes.
   */
  const pageCenters = useMemo(
    () => STEPS.map((_, i) => i * pageWidth),
    [pageWidth]
  );

  const handleLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number } } }) => {
      const w = Math.round(e.nativeEvent.layout.width);
      if (w > 0 && w !== pageWidth) setPageWidth(w);
    },
    [pageWidth]
  );

  if (!visible) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <View style={[styles.overlay, { backgroundColor: c.scrim }]}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: c.surfaceElevated,
              marginTop: insets.top + 40,
              marginBottom: insets.bottom + 20,
            },
          ]}
          onLayout={handleLayout}
        >
          {/* Close / Skip */}
          <Pressable
            style={styles.closeBtn}
            onPress={dismiss}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("common.close", { defaultValue: "Close" })}
          >
            <Ionicons name="close" size={22} color={c.textMuted} />
          </Pressable>

          {/* Pager */}
          <View style={styles.pagerWrap}>
            <AnimatedFlatList
              ref={listRef}
              data={STEPS}
              keyExtractor={(it) => it.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              bounces={false}
              decelerationRate="fast"
              onScroll={onScroll}
              scrollEventThrottle={16}
              onMomentumScrollEnd={onMomentumEnd}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              getItemLayout={(_, i) => ({
                length: pageWidth,
                offset: pageWidth * i,
                index: i,
              })}
              renderItem={({ item, index: i }) => (
                <OnboardingPage
                  step={item}
                  index={i}
                  pageWidth={pageWidth}
                  scrollX={scrollX}
                  breathe={breathe}
                  motionScale={motionScale}
                />
              )}
            />
          </View>

          {/* Dot indicator */}
          <View style={styles.dotRow} accessibilityRole="tablist">
            {STEPS.map((_, i) => (
              <DotIndicator
                key={`dot-${i}`}
                i={i}
                pageCenters={pageCenters}
                scrollX={scrollX}
                onPress={() => {
                  haptics.select?.();
                  goTo(i);
                }}
                activeColor={c.brand}
                inactiveColor={c.borderSubtle}
                accessibilityLabel={t("onboarding.goToStep", {
                  defaultValue: "Go to step {{n}}",
                  n: i + 1,
                })}
              />
            ))}
          </View>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: c.borderSubtle }]}>
            <Pressable
              onPress={index === 0 ? dismiss : goPrev}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={
                index === 0
                  ? t("onboarding.skip", { defaultValue: "Skip tour" })
                  : t("common.back", { defaultValue: "Back" })
              }
              style={({ pressed }) => [
                styles.ghostBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              {index === 0 ? (
                <Text style={[typography.button, { color: c.textMuted }]}>
                  {t("onboarding.skip", { defaultValue: "Skip" })}
                </Text>
              ) : (
                <>
                  <Ionicons name="arrow-back" size={16} color={c.textSecondary} />
                  <Text style={[typography.button, { color: c.textSecondary }]}>
                    {t("common.back", { defaultValue: "Back" })}
                  </Text>
                </>
              )}
            </Pressable>

            <Text style={[typography.caption, { color: c.textMuted }]}>
              {t("onboarding.counter", {
                defaultValue: "{{current}} of {{total}}",
                current: index + 1,
                total: STEPS.length,
              })}
            </Text>

            <Pressable
              onPress={() => {
                haptics.select?.();
                goNext();
              }}
              accessibilityRole="button"
              accessibilityLabel={
                isLast
                  ? t("onboarding.done", { defaultValue: "Get started" })
                  : t("onboarding.next", { defaultValue: "Next" })
              }
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: c.brand },
                pressed && {
                  opacity: 0.9,
                  transform: [{ scale: 0.97 * motionScale + (1 - motionScale) }],
                },
              ]}
            >
              <Text style={[typography.button, { color: "#fff" }]}>
                {isLast
                  ? t("onboarding.done", { defaultValue: "Get started" })
                  : t("onboarding.next", { defaultValue: "Next" })}
              </Text>
              {!isLast && <Ionicons name="arrow-forward" size={16} color="#fff" />}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Single page inside the pager. Reads `scrollX` to crossfade & translate
 * its hero icon ring slightly out of phase with the body copy for depth.
 */
function OnboardingPage({
  step,
  index,
  pageWidth,
  scrollX,
  breathe,
  motionScale,
}: {
  step: Step;
  index: number;
  pageWidth: number;
  scrollX: SharedValue<number>;
  breathe: SharedValue<number>;
  motionScale: number;
}) {
  const c = useThemeColors();
  const { t } = useTranslation();

  /**
   * Input range covers the previous, current, and next page centers so
   * adjacent pages animate as they enter/leave the viewport.
   */
  const inputRange = useMemo(
    () => [
      (index - 1) * pageWidth,
      index * pageWidth,
      (index + 1) * pageWidth,
    ],
    [index, pageWidth]
  );

  const heroStyle = useAnimatedStyle(() => {
    const x = scrollX.value;
    const scale =
      1 -
      (1 -
        interpolate(x, inputRange, [0.7, 1, 0.7], Extrapolation.CLAMP)) *
        motionScale;
    const translateX =
      interpolate(x, inputRange, [-40, 0, 40], Extrapolation.CLAMP) *
      motionScale;
    const opacity = interpolate(
      x,
      inputRange,
      [0.4, 1, 0.4],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ scale }, { translateX }],
      opacity,
    };
  }, [inputRange, motionScale]);

  const bodyStyle = useAnimatedStyle(() => {
    const x = scrollX.value;
    const translateX =
      interpolate(x, inputRange, [-22, 0, 22], Extrapolation.CLAMP) *
      motionScale;
    const opacity = interpolate(
      x,
      inputRange,
      [0, 1, 0],
      Extrapolation.CLAMP
    );

    return { transform: [{ translateX }], opacity };
  }, [inputRange, motionScale]);

  const ringStyle = useAnimatedStyle(() => {
    const breatheScale = 1 + breathe.value * 0.08 * motionScale;
    const x = scrollX.value;
    const enter = interpolate(
      x,
      inputRange,
      [0.7, 1, 0.7],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ scale: breatheScale * enter }],
      opacity: interpolate(x, inputRange, [0.0, 0.45, 0.0], Extrapolation.CLAMP),
    };
  }, [inputRange, motionScale]);

  return (
    <View style={[styles.page, { width: pageWidth }]}>
      <View style={styles.heroWrap}>
        <Animated.View
          style={[
            styles.heroRing,
            { backgroundColor: step.accent },
            ringStyle,
          ]}
          pointerEvents="none"
        />
        <Animated.View
          style={[
            styles.heroCircle,
            { backgroundColor: step.accent },
            heroStyle,
          ]}
        >
          <Ionicons name={step.icon} size={42} color="#fff" />
        </Animated.View>
      </View>

      <Animated.View style={[styles.body, bodyStyle]}>
        <Text style={[styles.title, { color: c.text }]}>
          {t(step.titleKey, { defaultValue: step.titleDefault })}
        </Text>
        <Text style={[styles.desc, { color: c.textSecondary }]}>
          {t(step.bodyKey, { defaultValue: step.bodyDefault })}
        </Text>

        {step.tipKey ? (
          <View
            style={[
              styles.tipBadge,
              {
                backgroundColor: c.brandAccentSubtle,
                borderColor: c.borderSubtle,
              },
            ]}
          >
            <View style={[styles.tipDot, { backgroundColor: step.accent }]} />
            <Text style={[styles.tipText, { color: c.brandAccent }]}>
              {t(step.tipKey, { defaultValue: step.tipDefault ?? "" })}
            </Text>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

/**
 * Animated dot indicator — width + colour are interpolated from
 * `scrollX` so they smoothly track the current page even mid-swipe.
 */
function DotIndicator({
  i,
  pageCenters,
  scrollX,
  onPress,
  activeColor,
  inactiveColor,
  accessibilityLabel,
}: {
  i: number;
  pageCenters: number[];
  scrollX: SharedValue<number>;
  onPress: () => void;
  activeColor: string;
  inactiveColor: string;
  accessibilityLabel: string;
}) {
  const inputRange = useMemo(
    () =>
      [pageCenters[i] - (pageCenters[1] - pageCenters[0] || 1), pageCenters[i], pageCenters[i] + (pageCenters[1] - pageCenters[0] || 1)],
    [pageCenters, i]
  );

  const animStyle = useAnimatedStyle(() => {
    const width = interpolate(
      scrollX.value,
      inputRange,
      [8, 24, 8],
      Extrapolation.CLAMP
    );
    const op = interpolate(
      scrollX.value,
      inputRange,
      [0.35, 1, 0.35],
      Extrapolation.CLAMP
    );

    return { width, opacity: op };
  }, [inputRange]);

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="tab"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: activeColor },
          animStyle,
        ]}
      />
      {/* Inactive base — sits underneath the animated overlay so the
          shape is always visible even when opacity is interpolating. */}
      <View
        style={[
          styles.dotBase,
          { backgroundColor: inactiveColor },
        ]}
        pointerEvents="none"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: space.md,
  },
  card: {
    borderRadius: 28,
    width: "100%",
    maxWidth: 440,
    paddingTop: space.lg,
    paddingBottom: space.sm,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.28,
        shadowRadius: 36,
      },
      android: { elevation: 24 },
    }),
  },
  closeBtn: {
    position: "absolute",
    top: space.md,
    right: space.md,
    zIndex: 10,
    padding: 6,
    borderRadius: 10,
  },
  pagerWrap: {
    height: 360,
  },
  page: {
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
  },
  heroWrap: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.lg,
  },
  heroRing: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  heroCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 14,
      },
      android: { elevation: 6 },
    }),
  },
  body: {
    alignItems: "center",
    paddingHorizontal: space.sm,
  },
  title: {
    ...typography.titleMd,
    textAlign: "center",
    marginBottom: space.sm,
  },
  desc: {
    ...typography.bodyMd,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 340,
  },
  tipBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.pill,
    marginTop: space.md,
  },
  tipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tipText: {
    ...typography.label,
  },
  dotRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: space.sm,
    marginBottom: space.md,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    zIndex: 2,
  },
  dotBase: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 1,
    zIndex: 1,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  ghostBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: radii.pill,
  },
});
