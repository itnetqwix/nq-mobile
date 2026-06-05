import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { radii, space, typography, useThemedStyles, useThemeColors } from "../../../theme";

type Props = {
  remainingToday: number;
  dailyLimit: number;
  rateLimited?: boolean;
  onBookLesson?: () => void;
};

/**
 * Pre-booking chat quota — compact, dismissible, with a visual progress bar.
 */
export function ChatPolicyBanner({
  remainingToday,
  dailyLimit,
  rateLimited,
  onBookLesson,
}: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();
  const [dismissed, setDismissed] = useState(false);

  const exhausted = rateLimited || remainingToday <= 0;
  const used = Math.max(0, dailyLimit - remainingToday);
  const progress = dailyLimit > 0 ? Math.min(1, used / dailyLimit) : 1;

  const body = useMemo(() => {
    if (exhausted) {
      return t("chat.policy.exhausted", {
        defaultValue:
          "Daily message limit reached. Book a lesson to unlock unlimited messaging.",
      });
    }
    return t("chat.policy.remaining", {
      count: remainingToday,
      defaultValue:
        remainingToday === 1
          ? "1 message left today before booking. Book a lesson for unlimited chat."
          : "{{count}} messages left today before booking. Book a lesson for unlimited chat.",
    });
  }, [exhausted, remainingToday, t]);

  if (dismissed && !exhausted) return null;

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: exhausted ? c.warningSubtle : c.brandSubtle,
          borderBottomColor: exhausted ? c.warning : c.border,
        },
      ]}
    >
      <View style={styles.topRow}>
        <Ionicons
          name={exhausted ? "ban-outline" : "chatbubble-ellipses-outline"}
          size={18}
          color={exhausted ? c.warning : c.brandNavy}
        />
        <View style={styles.copy}>
          <Text style={[styles.title, { color: c.text }]}>
            {exhausted
              ? t("chat.policy.titleExhausted", { defaultValue: "Limit reached" })
              : t("chat.policy.titleActive", { defaultValue: "Free messages" })}
          </Text>
          <Text style={[styles.body, { color: c.textMuted }]}>{body}</Text>
        </View>
        {!exhausted ? (
          <Pressable
            onPress={() => setDismissed(true)}
            hitSlop={10}
            accessibilityLabel={t("common.dismiss", { defaultValue: "Dismiss" })}
          >
            <Ionicons name="close" size={18} color={c.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {!exhausted && dailyLimit > 0 ? (
        <View style={[styles.track, { backgroundColor: c.border }]}>
          <View
            style={[
              styles.fill,
              {
                width: `${Math.round(progress * 100)}%`,
                backgroundColor:
                  remainingToday <= 2 ? c.warning : c.brandNavy,
              },
            ]}
          />
        </View>
      ) : null}

      {onBookLesson ? (
        <Pressable
          onPress={onBookLesson}
          style={[styles.cta, { backgroundColor: c.brandNavy }]}
          accessibilityRole="button"
        >
          <Text style={[styles.ctaText, { color: c.brandTextOn }]}>
            {t("chat.policy.bookCta", { defaultValue: "Book a lesson" })}
          </Text>
          <Ionicons name="arrow-forward" size={14} color={c.brandTextOn} />
        </Pressable>
      ) : null}
    </View>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      wrap: {
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        gap: space.sm,
      },
      topRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
      copy: { flex: 1, gap: 2 },
      title: { ...typography.label, fontWeight: "800" },
      body: { ...typography.bodySm, lineHeight: 18 },
      track: {
        height: 4,
        borderRadius: radii.pill,
        overflow: "hidden",
      },
      fill: { height: "100%", borderRadius: radii.pill },
      cta: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 8,
        borderRadius: radii.pill,
      },
      ctaText: { fontSize: 13, fontWeight: "800" },
    })
  );
}
