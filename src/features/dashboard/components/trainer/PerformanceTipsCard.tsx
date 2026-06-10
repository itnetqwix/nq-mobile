import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { TrainerScheduleDay } from "../../../home/api/homeApi";
import { countSlotsNextWeek, hasThursdaySlot } from "../../lib/trainerSlotUtils";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";

type Props = {
  pendingCount: number;
  showAsOnline: boolean;
  scheduleSlots: TrainerScheduleDay[];
};

type TipTone = "navy" | "success" | "warning" | "accent";

type Tip = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  tone: TipTone;
};

/** Returns a number 0–(n-1) seeded to today's date so it changes every day. */
function dailySeed(n: number): number {
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  return dayIndex % n;
}

/** Seeded shuffle — same order all day, different tomorrow. */
function dailyShuffle<T>(arr: T[]): T[] {
  const seed = Math.floor(Date.now() / 86_400_000);
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = (seed * 2654435761 + i * 40503) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Full pool of coaching tips — 3–4 are picked daily. */
function buildTipPool(
  t: (k: string, o?: Record<string, unknown>) => string,
  pendingCount: number,
  showAsOnline: boolean,
  scheduleSlots: TrainerScheduleDay[]
): Tip[] {
  const all: Tip[] = [
    // Context-aware (high-priority, show when relevant)
    ...(pendingCount > 0
      ? [{
          icon: "notifications" as const,
          title: t("trainerDashboard.tipPendingTitle", { defaultValue: "{{count}} requests waiting", count: pendingCount }),
          body: t("trainerDashboard.tipPendingBody", { defaultValue: "Respond quickly — trainees book the coach who replies first." }),
          tone: "warning" as TipTone,
        }]
      : []),
    ...(!showAsOnline
      ? [{
          icon: "radio" as const,
          title: t("trainerDashboard.tipGoLiveTitle", { defaultValue: "Go live now" }),
          body: t("trainerDashboard.tipGoLiveBody", { defaultValue: "Coaches who go live get up to 3× more instant bookings." }),
          tone: "success" as TipTone,
        }]
      : []),
    ...(countSlotsNextWeek(scheduleSlots) < 3 || !hasThursdaySlot(scheduleSlots)
      ? [{
          icon: "calendar-outline" as const,
          title: t("trainerDashboard.tipSlotsTitle", { defaultValue: "Add more slots" }),
          body: t("trainerDashboard.tipSlotsBody", { defaultValue: "Coaches with 5+ open slots this week get booked 60% faster." }),
          tone: "navy" as TipTone,
        }]
      : []),
    // Daily-rotating general tips
    {
      icon: "camera-outline",
      title: t("trainerDashboard.tip.clipTitle", { defaultValue: "Share a clip today" }),
      body: t("trainerDashboard.tip.clipBody", { defaultValue: "Trainees who see your coaching clips are 2× more likely to book." }),
      tone: "accent",
    },
    {
      icon: "star-outline",
      title: t("trainerDashboard.tip.reviewTitle", { defaultValue: "Ask for a review" }),
      body: t("trainerDashboard.tip.reviewBody", { defaultValue: "After a session, send a quick message asking for feedback. Every review builds trust." }),
      tone: "warning",
    },
    {
      icon: "chatbubble-ellipses-outline",
      title: t("trainerDashboard.tip.responseTitle", { defaultValue: "Respond in < 1 hour" }),
      body: t("trainerDashboard.tip.responseBody", { defaultValue: "Fast responses signal reliability. Trainees prefer coaches who reply promptly." }),
      tone: "success",
    },
    {
      icon: "ribbon-outline",
      title: t("trainerDashboard.tip.bioTitle", { defaultValue: "Update your bio" }),
      body: t("trainerDashboard.tip.bioBody", { defaultValue: "A fresh, specific bio with your specialties improves your search ranking." }),
      tone: "navy",
    },
    {
      icon: "trending-up-outline",
      title: t("trainerDashboard.tip.pricingTitle", { defaultValue: "Review your rate" }),
      body: t("trainerDashboard.tip.pricingBody", { defaultValue: "Compare rates with similar coaches in your sport and adjust if needed to stay competitive." }),
      tone: "accent",
    },
    {
      icon: "people-outline",
      title: t("trainerDashboard.tip.referralTitle", { defaultValue: "Invite your students" }),
      body: t("trainerDashboard.tip.referralBody", { defaultValue: "Invite past students to the platform — repeat clients generate 40% of top coach revenue." }),
      tone: "success",
    },
    {
      icon: "time-outline",
      title: t("trainerDashboard.tip.consistencyTitle", { defaultValue: "Be consistent" }),
      body: t("trainerDashboard.tip.consistencyBody", { defaultValue: "Coaches who log in daily get ranked higher in discovery — stay active." }),
      tone: "navy",
    },
    {
      icon: "videocam-outline",
      title: t("trainerDashboard.tip.videoTitle", { defaultValue: "Try a video intro" }),
      body: t("trainerDashboard.tip.videoBody", { defaultValue: "Coaches with intro videos receive 3× more profile views from new trainees." }),
      tone: "accent",
    },
    {
      icon: "trophy-outline",
      title: t("trainerDashboard.tip.goalTitle", { defaultValue: "Set a session goal" }),
      body: t("trainerDashboard.tip.goalBody", { defaultValue: "Setting a weekly session target keeps you motivated and focused on growth." }),
      tone: "warning",
    },
    {
      icon: "heart-outline",
      title: t("trainerDashboard.tip.engageTitle", { defaultValue: "Engage with clips" }),
      body: t("trainerDashboard.tip.engageBody", { defaultValue: "Comment on a trainee's clip to build rapport and keep them coming back." }),
      tone: "success",
    },
  ];

  // Context-aware tips come first, then shuffle the rest
  const contextTips = all.slice(0, all.length - 10);
  const generalTips = dailyShuffle(all.slice(contextTips.length));

  // Pick 4 total: all context tips + fill from shuffled general pool
  const combined = [...contextTips, ...generalTips];
  return combined.slice(0, 4);
}

const TONE_CONFIG: Record<TipTone, { bg: string; border: string; icon: string }> = {
  navy:    { bg: "#EEF2FF", border: "#C7D2FE", icon: "#1E3A8A" },
  success: { bg: "#F0FDF4", border: "#BBF7D0", icon: "#16A34A" },
  warning: { bg: "#FFFBEB", border: "#FDE68A", icon: "#D97706" },
  accent:  { bg: "#FFF5F5", border: "#FECACA", icon: "#DC2626" },
};

export function PerformanceTipsCard({ pendingCount, showAsOnline, scheduleSlots }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();

  const tips = useMemo(
    () => buildTipPool(t, pendingCount, showAsOnline, scheduleSlots),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pendingCount, showAsOnline, scheduleSlots]
  );

  if (!tips.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Ionicons name="bulb-outline" size={16} color={c.brandNavy} />
        <Text style={styles.title}>
          {t("trainerDashboard.performanceTips", { defaultValue: "Tips for you" })}
        </Text>
        <Text style={styles.daily}>
          {t("trainerDashboard.tipsRefreshDaily", { defaultValue: "• refreshes daily" })}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
        decelerationRate="fast"
        snapToInterval={216}
        snapToAlignment="start"
      >
        {tips.map((tip, i) => {
          const tc = TONE_CONFIG[tip.tone];
          return (
            <View
              key={i}
              style={[styles.tile, { backgroundColor: tc.bg, borderColor: tc.border }]}
            >
              <View style={[styles.iconCircle, { backgroundColor: tc.icon + "22" }]}>
                <Ionicons name={tip.icon} size={22} color={tc.icon} />
              </View>
              <Text style={[styles.tipTitle, { color: tc.icon }]}>{tip.title}</Text>
              <Text style={styles.tipBody}>{tip.body}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      wrap: {},
      header: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.xs,
        marginBottom: space.sm,
      },
      title: { ...typography.titleSm, color: palette.text, fontWeight: "700" },
      daily: { ...typography.caption, color: palette.textMuted, flex: 1 },
      strip: {
        gap: space.sm,
        paddingVertical: space.xs,
        paddingRight: space.md,
      },
      tile: {
        width: 208,
        padding: space.md,
        borderRadius: radii.lg,
        borderWidth: 1.5,
        gap: space.xs,
      },
      iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 2,
      },
      tipTitle: {
        ...typography.bodySm,
        fontWeight: "800",
        lineHeight: 18,
      },
      tipBody: {
        ...typography.caption,
        color: palette.textMuted,
        lineHeight: 17,
        marginTop: 2,
      },
    })
  );
}
