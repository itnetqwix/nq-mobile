import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text } from "react-native";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { haptics } from "../../../../lib/haptics";
import { space, typography, useThemeColors } from "../../../../theme";
import {
  GUEST_STORAGE_KEYS,
  readGuestJson,
  writeGuestJson,
} from "../../../auth/lib/guestStorage";

type NudgeState = {
  /** ms timestamp of the last time we showed the nudge */
  lastShownAt?: number;
  /** how many times user dismissed — used to ease off after repeat dismissals */
  dismissals?: number;
};

const FIRST_SHOW_DELAY_MS = 1000 * 60 * 2;
const REPEAT_DELAY_MS = 1000 * 60 * 5;
const MAX_DISMISSALS_BEFORE_BACKOFF = 3;
const BACKOFF_DELAY_MS = 1000 * 60 * 30;

type Props = {
  onSignUp: () => void;
};

/**
 * Inline non-blocking "saving your spot?" banner. Slides in after a quiet
 * period, never overlays content (always part of the scroll), and respects
 * a per-device cooldown that backs off after repeat dismissals so we
 * don't nag.
 */
export function GuestBrowsingNudge({ onSignUp }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const [visible, setVisible] = useState(false);
  const translateY = useRef(new Animated.Value(-40)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    void (async () => {
      const state = await readGuestJson<NudgeState>(GUEST_STORAGE_KEYS.nudgeState, {});
      const dismissals = state.dismissals ?? 0;
      const lastShownAt = state.lastShownAt ?? 0;
      const delay =
        dismissals === 0
          ? FIRST_SHOW_DELAY_MS
          : dismissals >= MAX_DISMISSALS_BEFORE_BACKOFF
          ? BACKOFF_DELAY_MS
          : REPEAT_DELAY_MS;
      const elapsed = Date.now() - lastShownAt;
      const wait = lastShownAt === 0 ? FIRST_SHOW_DELAY_MS : Math.max(0, delay - elapsed);

      timeout = setTimeout(async () => {
        if (!alive) return;
        setVisible(true);
        Animated.parallel([
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8 }),
          Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]).start();
        await writeGuestJson<NudgeState>(GUEST_STORAGE_KEYS.nudgeState, {
          ...state,
          lastShownAt: Date.now(),
        });
      }, wait);
    })();

    return () => {
      alive = false;
      if (timeout) clearTimeout(timeout);
    };
  }, [opacity, translateY]);

  const dismiss = async () => {
    haptics.tap();
    Animated.parallel([
      Animated.timing(translateY, { toValue: -40, duration: 180, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setVisible(false));
    const state = await readGuestJson<NudgeState>(GUEST_STORAGE_KEYS.nudgeState, {});
    await writeGuestJson<NudgeState>(GUEST_STORAGE_KEYS.nudgeState, {
      ...state,
      dismissals: (state.dismissals ?? 0) + 1,
      lastShownAt: Date.now(),
    });
  };

  const handleSignUp = () => {
    haptics.tap();
    onSignUp();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.root,
        {
          backgroundColor: c.surfaceElevated,
          borderColor: c.borderSubtle,
          shadowColor: c.brandNavy,
          transform: [{ translateY }],
          opacity,
        },
      ]}
      pointerEvents="auto"
    >
      <Ionicons name="rocket" size={18} color={c.brandAccent} />
      <Text
        style={[typography.bodySm, styles.text, { color: c.text }]}
        numberOfLines={2}
      >
        {t("guest.nudge.continueBrowsing")}
      </Text>
      <Pressable onPress={handleSignUp} hitSlop={6} style={styles.cta}>
        <Text style={[styles.ctaText, { color: c.brandAccent }]}>
          {t("guest.nudge.signUp")}
        </Text>
      </Pressable>
      <Pressable
        onPress={dismiss}
        hitSlop={10}
        style={styles.close}
        accessibilityLabel={t("guest.nudge.dismiss")}
      >
        <Ionicons name="close" size={16} color={c.textMuted} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: space.sm,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  text: { flex: 1, lineHeight: 18 },
  cta: { paddingHorizontal: 8, paddingVertical: 4 },
  ctaText: { fontWeight: "800", fontSize: 13 },
  close: { padding: 4 },
});
