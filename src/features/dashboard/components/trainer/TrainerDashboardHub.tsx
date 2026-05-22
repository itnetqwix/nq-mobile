import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../../lib/queryKeys";
import { fetchTrainerSlots } from "../../../home/api/homeApi";
import { TrainerOnlineToggle } from "../TrainerOnlineToggle";
import { HomeUserAvatar } from "../home/HomeUserAvatar";
import { useDashboardSessions } from "../../hooks/useDashboardSessions";
import { formatNextOpenSlot } from "../../lib/trainerSlotUtils";
import { PendingRequestsBanner } from "./PendingRequestsBanner";
import { TodayScheduleTimeline } from "./TodayScheduleTimeline";
import { TrainerEarningsSnapshot } from "./TrainerEarningsSnapshot";
import { RecentTraineeClipsSection } from "./RecentTraineeClipsSection";
import { RatingFeedbackPulse } from "./RatingFeedbackPulse";
import { PerformanceTipsCard } from "./PerformanceTipsCard";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";

type Props = {
  name: string;
  accountType: string;
  profilePicture?: string;
  showAsOnline: boolean;
  user?: Record<string, unknown> | null;
  onSettings: () => void;
  onAvailabilityToggle: (next: boolean) => Promise<void>;
  onOpenWallet?: () => void;
  onOpenSchedule: () => void;
  onOpenSessions: () => void;
  onOpenClips: () => void;
  onSessionPress: (session: Record<string, unknown>) => void;
};

export function TrainerDashboardHub({
  name,
  accountType,
  profilePicture,
  showAsOnline,
  user,
  onSettings,
  onAvailabilityToggle,
  onOpenWallet,
  onOpenSchedule,
  onOpenSessions,
  onOpenClips,
  onSessionPress,
}: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();
  const { pendingSessions, todayTimeline } = useDashboardSessions(accountType);

  const { data: scheduleSlots = [] } = useQuery({
    queryKey: queryKeys.trainer.slots,
    queryFn: fetchTrainerSlots,
    staleTime: 120_000,
  });

  const nextSlot = formatNextOpenSlot(scheduleSlots);

  return (
    <View style={styles.root}>
      <View style={styles.headerCard}>
        <Pressable style={styles.headerMain} onPress={onSettings}>
          <HomeUserAvatar
            uri={profilePicture}
            name={name}
            size={64}
            onlineStatus={showAsOnline ? "online" : "offline"}
          />
          <View style={styles.headerText}>
            <Text style={styles.welcome}>{t("trainerDashboard.welcome", { name })}</Text>
            <Text style={styles.role}>{t("trainerDashboard.roleTrainer")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
        </Pressable>
        <TrainerEarningsSnapshot onPress={onOpenWallet} />
      </View>

      <PendingRequestsBanner
        count={pendingSessions.length}
        onPress={onOpenSessions}
      />

      <View style={styles.availCard}>
        <TrainerOnlineToggle value={showAsOnline} onToggle={onAvailabilityToggle} />
        <Pressable style={styles.slotRow} onPress={onOpenSchedule}>
          <Ionicons name="calendar-outline" size={18} color={c.brandNavy} />
          <Text style={styles.slotText}>
            {nextSlot
              ? t("trainerDashboard.nextSlot", { when: nextSlot })
              : t("trainerDashboard.noSlots")}
          </Text>
          <Text style={styles.slotLink}>{t("trainerDashboard.openSchedule")}</Text>
        </Pressable>
      </View>

      <TodayScheduleTimeline
        sessions={todayTimeline}
        onSessionPress={onSessionPress}
        onSeeAll={onOpenSessions}
      />

      <RatingFeedbackPulse user={user} />

      <PerformanceTipsCard
        pendingCount={pendingSessions.length}
        showAsOnline={showAsOnline}
        scheduleSlots={scheduleSlots}
      />

      <RecentTraineeClipsSection onOpenClips={onOpenClips} />
    </View>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      root: { gap: space.md, marginBottom: space.md },
      headerCard: {
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.lg,
        padding: space.md,
        borderWidth: 1,
        borderColor: palette.border,
        gap: space.sm,
      },
      headerMain: { flexDirection: "row", alignItems: "center", gap: space.md },
      headerText: { flex: 1, minWidth: 0 },
      welcome: { ...typography.titleSm, color: palette.text, fontWeight: "700" },
      role: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
      availCard: {
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: palette.border,
        overflow: "hidden",
      },
      slotRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        paddingHorizontal: space.md,
        paddingBottom: space.md,
        flexWrap: "wrap",
      },
      slotText: { ...typography.bodySm, color: palette.text, flex: 1 },
      slotLink: { ...typography.caption, color: palette.brandNavy, fontWeight: "700" },
    })
  );
}
