import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import PagerView from "react-native-pager-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NetqwixLogo } from "../../../components/brand/NetqwixLogo";
import { Button } from "../../../components/ui";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { haptics } from "../../../lib/haptics";
import { radii, space, typography, useThemeColors } from "../../../theme";
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
  const pagerRef = useRef<PagerView>(null);
  const [page, setPage] = useState(0);
  const lastPage = INTRO_SLIDES.length - 1;

  const finish = useCallback(() => {
    haptics.tap();
    void Promise.resolve(onGetStarted());
  }, [onGetStarted]);

  const goNext = useCallback(() => {
    if (page >= lastPage) {
      finish();
      return;
    }
    haptics.tap();
    pagerRef.current?.setPage(page + 1);
  }, [finish, lastPage, page]);

  const onSkip = useCallback(() => {
    if (persistOnSkip) {
      finish();
      return;
    }
    finish();
  }, [finish, persistOnSkip]);

  return (
    <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <NetqwixLogo variant="pin" maxWidth={36} height={32} compact />
        {page < lastPage ? (
          <Pressable
            onPress={onSkip}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("intro.skip")}
          >
            <Text style={[styles.skip, { color: c.textMuted }]}>{t("intro.skip")}</Text>
          </Pressable>
        ) : (
          <View style={styles.skipPlaceholder} />
        )}
      </View>

      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={(e) => setPage(e.nativeEvent.position)}
      >
        {INTRO_SLIDES.map((slide) => (
          <View key={slide.id} style={styles.page}>
            <IntroSlideHero slide={slide} />
          </View>
        ))}
      </PagerView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
        <Text style={[styles.title, { color: c.text }]}>
          {t(INTRO_SLIDES[page].titleKey)}
        </Text>
        <Text style={[styles.body, { color: c.textMuted }]}>
          {t(INTRO_SLIDES[page].bodyKey)}
        </Text>

        <View style={styles.dots}>
          {INTRO_SLIDES.map((s, i) => (
            <View
              key={s.id}
              style={[
                styles.dot,
                {
                  backgroundColor: i === page ? c.brandAccent : c.neutral300,
                  width: i === page ? 22 : 8,
                },
              ]}
            />
          ))}
        </View>

        <Button
          label={page >= lastPage ? t("intro.getStarted") : t("intro.next")}
          size="lg"
          onPress={goNext}
        />
      </View>
    </View>
  );
}

function IntroSlideHero({ slide }: { slide: IntroSlide }) {
  const c = useThemeColors();
  return (
    <View style={styles.hero}>
      <View
        style={[
          styles.iconRing,
          {
            borderColor: slide.accent,
            backgroundColor: `${slide.accent}18`,
          },
        ]}
      >
        <Ionicons name={slide.icon} size={72} color={slide.accent} />
      </View>
      <View style={[styles.heroBand, { backgroundColor: c.brandNavy }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  skip: { ...typography.body, fontWeight: "600" },
  skipPlaceholder: { width: 48 },
  pager: { flex: 1 },
  page: { flex: 1, justifyContent: "center" },
  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xl,
  },
  iconRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  heroBand: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: "18%",
    height: 120,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    opacity: 0.12,
  },
  footer: {
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  title: {
    ...typography.titleLg,
    textAlign: "center",
  },
  body: {
    ...typography.body,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: space.sm,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginVertical: space.md,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
});
