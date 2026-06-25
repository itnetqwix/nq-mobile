import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import Animated, {
  Easing,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NetqwixLogo } from "../../../components/brand/NetqwixLogo";
import {
  SPLASH_ACCENT,
  SPLASH_BG_LIGHT,
  SPLASH_BG_LIGHT_TOP,
} from "../../../components/splash/splashConstants";
import { Button } from "../../../components/ui";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { haptics } from "../../../lib/haptics";
import { radii, space, typography, useThemeColors } from "../../../theme";
import { INTRO_SLIDE_DURATION_MS } from "../introConstants";
import { INTRO_SLIDES, type IntroSlide } from "../introSlides";

type Props = {
  onGetStarted: () => void | Promise<void>;
  /** When true, skip persists completion (first launch only). */
  persistOnSkip?: boolean;
};

export function IntroOnboardingScreen({
  onGetStarted,
  persistOnSkip = true,
}: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width: pageWidth } = useWindowDimensions();
  const listRef = useRef<FlatList<IntroSlide>>(null);
  const pageRef = useRef(0);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [page, setPage] = useState(0);
  const lastPage = INTRO_SLIDES.length - 1;
  const activeSlide = INTRO_SLIDES[page]!;

  const clearAutoTimer = useCallback(() => {
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
  }, []);

  const finish = useCallback(() => {
    clearAutoTimer();
    haptics.tap();
    void Promise.resolve(onGetStarted());
  }, [clearAutoTimer, onGetStarted]);

  const scrollToPage = useCallback(
    (index: number, animated = true) => {
      const clamped = Math.min(lastPage, Math.max(0, index));
      listRef.current?.scrollToIndex({ index: clamped, animated });
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      pageRef.current = clamped;
      setPage(clamped);
    },
    [lastPage]
  );

  const goNext = useCallback(() => {
    clearAutoTimer();
    if (pageRef.current >= lastPage) {
      finish();
      return;
    }
    haptics.tap();
    scrollToPage(pageRef.current + 1);
  }, [clearAutoTimer, finish, lastPage, scrollToPage]);

  const onSkip = useCallback(() => {
    if (!persistOnSkip) {
      finish();
      return;
    }
    finish();
  }, [finish, persistOnSkip]);

  const scheduleAutoAdvance = useCallback(() => {
    clearAutoTimer();
    if (pageRef.current >= lastPage) return;
    autoTimerRef.current = setTimeout(() => {
      scrollToPage(pageRef.current + 1);
    }, INTRO_SLIDE_DURATION_MS);
  }, [clearAutoTimer, lastPage, scrollToPage]);

  useEffect(() => {
    pageRef.current = page;
    scheduleAutoAdvance();
    return clearAutoTimer;
  }, [page, scheduleAutoAdvance, clearAutoTimer]);

  const progress = useSharedValue(0);
  const trackWidth = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    if (page < lastPage) {
      progress.value = withTiming(1, {
        duration: INTRO_SLIDE_DURATION_MS,
        easing: Easing.linear,
      });
    }
  }, [page, lastPage, progress]);

  const progressStyle = useAnimatedStyle(() => ({
    width: trackWidth.value * progress.value,
  }));

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
      const clamped = Math.min(lastPage, Math.max(0, next));
      if (clamped !== pageRef.current) {
        clearAutoTimer();
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        pageRef.current = clamped;
        setPage(clamped);
      }
    },
    [clearAutoTimer, lastPage, pageWidth]
  );

  const title = t(activeSlide.titleKey, {
    defaultValue:
      activeSlide.id === "leap"
        ? "Level up your game"
        : activeSlide.id === "coaches"
          ? "Find your perfect coach"
          : "Train live, anywhere",
  });
  const body = t(activeSlide.bodyKey, {
    defaultValue:
      activeSlide.id === "leap"
        ? "Get 1-on-1 coaching from verified experts."
        : activeSlide.id === "coaches"
          ? "Browse by sport, skill level, and schedule."
          : "HD video sessions, clips, and game plans in your locker.",
  });
  const badge = t(activeSlide.badgeKey, {
    defaultValue:
      activeSlide.id === "leap"
        ? "Live coaching"
        : activeSlide.id === "coaches"
          ? "Verified experts"
          : "All-in-one",
  });

  return (
    <View style={[styles.root, { backgroundColor: SPLASH_BG_LIGHT }]}>
      <View style={styles.topWash} pointerEvents="none" />
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <NetqwixLogo variant="wordmark" maxWidth={148} height={40} compact align="start" />
          <Pressable
            onPress={onSkip}
            hitSlop={12}
            style={styles.skipBtn}
            accessibilityRole="button"
            accessibilityLabel={t("intro.skip", { defaultValue: "Skip" })}
          >
            <Text style={[styles.skip, { color: c.textMuted }]}>
              {t("intro.skip", { defaultValue: "Skip" })}
            </Text>
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          data={[...INTRO_SLIDES]}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          style={styles.pager}
          extraData={page}
          onMomentumScrollEnd={onScrollEnd}
          getItemLayout={(_, index) => ({
            length: pageWidth,
            offset: pageWidth * index,
            index,
          })}
          renderItem={({ item }) => (
            <View style={[styles.page, { width: pageWidth }]}>
              <IntroSlideHero slide={item} active={item.id === activeSlide.id} />
            </View>
          )}
        />

        <View
          style={[
            styles.footerCard,
            {
              backgroundColor: c.surfaceElevated,
              borderColor: c.borderSubtle,
              paddingBottom: Math.max(insets.bottom, space.lg),
            },
          ]}
        >
          <Animated.View
            key={`intro-copy-${page}`}
            entering={FadeInUp.duration(320).springify().damping(18)}
            style={styles.footerCopy}
          >
            <View style={[styles.badge, { backgroundColor: `${activeSlide.accent}18` }]}>
              <Ionicons name={activeSlide.icon} size={14} color={activeSlide.accent} />
              <Text style={[styles.badgeText, { color: activeSlide.accent }]}>{badge}</Text>
            </View>

            <Text style={[styles.title, { color: c.text }]}>{title}</Text>
            <Text style={[styles.body, { color: c.textMuted }]}>{body}</Text>
          </Animated.View>

          <View
            style={[styles.autoTrack, { backgroundColor: c.neutral200 }]}
            onLayout={(e) => {
              trackWidth.value = e.nativeEvent.layout.width;
            }}
          >
            <Animated.View style={[styles.autoFill, progressStyle]} />
          </View>

          <View style={styles.dots}>
            {INTRO_SLIDES.map((s, i) => (
              <View
                key={s.id}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i === page ? SPLASH_ACCENT : c.neutral300,
                    width: i === page ? 24 : 8,
                  },
                ]}
              />
            ))}
          </View>

          <Button
            label={
              page >= lastPage
                ? t("intro.getStarted", { defaultValue: "Get started" })
                : t("intro.next", { defaultValue: "Continue" })
            }
            size="lg"
            onPress={goNext}
          />
        </View>
      </View>
    </View>
  );
}

function IntroSlideHero({ slide, active }: { slide: IntroSlide; active: boolean }) {
  const c = useThemeColors();
  const scale = useSharedValue(active ? 1 : 0.94);
  const opacity = useSharedValue(active ? 1 : 0.88);

  useEffect(() => {
    scale.value = withSpring(active ? 1 : 0.94, { damping: 16, stiffness: 140 });
    opacity.value = withTiming(active ? 1 : 0.88, { duration: 280 });
  }, [active, opacity, scale]);

  const motionStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.hero}>
      <View
        style={[
          styles.glow,
          { backgroundColor: `${slide.accent}22`, borderColor: `${slide.accent}33` },
        ]}
      />
      <Animated.View style={[styles.heroMotion, motionStyle]}>
        <View
          style={[
            styles.imageFrame,
            {
              backgroundColor: c.surfaceElevated,
              borderColor: `${slide.accent}44`,
              shadowColor: slide.accent,
            },
          ]}
        >
          <Image
            source={slide.image}
            style={styles.heroImage}
            contentFit="cover"
            accessibilityRole="image"
            transition={320}
          />
          <View style={[styles.iconBadge, { backgroundColor: slide.accent }]}>
            <Ionicons name={slide.icon} size={18} color="#fff" />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topWash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "48%",
    backgroundColor: SPLASH_BG_LIGHT_TOP,
  },
  safe: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  skipBtn: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radii.pill,
  },
  skip: { ...typography.bodySm, fontWeight: "700" },
  pager: { flex: 1 },
  page: { flex: 1, justifyContent: "center" },
  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  heroMotion: {
    width: "100%",
    alignItems: "center",
  },
  glow: {
    position: "absolute",
    width: "88%",
    maxWidth: 320,
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 1,
  },
  imageFrame: {
    width: "100%",
    maxWidth: 320,
    aspectRatio: 4 / 5,
    borderRadius: radii.xl,
    overflow: "hidden",
    borderWidth: 1.5,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  iconBadge: {
    position: "absolute",
    top: space.md,
    right: space.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  footerCard: {
    marginHorizontal: space.md,
    marginBottom: space.sm,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    gap: space.sm,
    ...Platform.select({
      ios: {
        shadowColor: "#0F2B5B",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  footerCopy: {
    gap: space.sm,
  },
  badge: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  badgeText: { ...typography.caption, fontWeight: "800", letterSpacing: 0.3 },
  title: {
    ...typography.titleLg,
    textAlign: "center",
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  body: {
    ...typography.body,
    textAlign: "center",
    lineHeight: 23,
  },
  autoTrack: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
    marginTop: space.xs,
  },
  autoFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: SPLASH_ACCENT,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginVertical: space.xs,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
});
