import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../../lib/queryKeys";
import { fetchTrainerSlots } from "../../../home/api/homeApi";
import type { UtilitySurfaceId } from "../../config/shellSurfaces";
import { TrainerOnlineToggle } from "../TrainerOnlineToggle";
import { HomeUserAvatar } from "../home/HomeUserAvatar";
import { useDashboardSessions } from "../../hooks/useDashboardSessions";
import { formatNextOpenSlot } from "../../lib/trainerSlotUtils";
import { PendingRequestsBanner } from "./PendingRequestsBanner";
import { TodayScheduleTimeline } from "./TodayScheduleTimeline";
import { TrainerGreetingRating } from "./TrainerGreetingRating";
import { PerformanceTipsCard } from "./PerformanceTipsCard";
import { TrainerRecentTraineesSection } from "./TrainerRecentTraineesSection";
import { FriendRequestTilesSkeleton } from "../../../../components/ui";
import { TrainerFriendRequestsSection } from "./TrainerFriendRequestsSection";
import { TrainerLockerSection } from "./TrainerLockerSection";
import { MiniFriendsSection } from "../shared/MiniFriendsSection";
import { DashboardClipsPreviewSection } from "../shared/DashboardClipsPreviewSection";
import { ReferFriendsBanner } from "../shared/ReferFriendsBanner";
import { createTrainerDashboardStyles } from "./trainerDashboardTheme";
import { useThemeColors, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";

type Props = {
  name: string;
  accountType: string;
  profilePicture?: string;
  showAsOnline: boolean;
  user?: Record<string, unknown> | null;
  recentTrainees?: Record<string, unknown>[];
  friendRequests?: Array<Record<string, unknown>>;
  loadingFriendRequests?: boolean;
  onAcceptFriend?: (id: string) => void;
  onRejectFriend?: (id: string) => void;
  onSettings: () => void;
  onAvailabilityToggle: (next: boolean) => Promise<void>;
  onOpenSchedule: () => void;
  onOpenSessions: () => void;
  onOpenClips: () => void;
  onOpenSurface: (id: UtilitySurfaceId) => void;
  onOpenReviews?: () => void;
  onSessionPress: (session: Record<string, unknown>) => void;
  /** When true, top profile card is omitted (marketplace chrome handles header). */
  marketplaceHeader?: boolean;
};

function TrainerDashboardHubInner({
  name,
  accountType,
  profilePicture,
  showAsOnline,
  user,
  recentTrainees = [],
  friendRequests = [],
  loadingFriendRequests = false,
  onAcceptFriend,
  onRejectFriend,
  onSettings,
  onAvailabilityToggle,
  onOpenSchedule,
  onOpenSessions,
  onOpenClips,
  onOpenSurface,
  onOpenReviews,
  onSessionPress,
  marketplaceHeader = false,
}: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const theme = useThemedStyles((palette) => createTrainerDashboardStyles(palette));
  const { pendingSessions, todayTimeline } = useDashboardSessions(accountType);

  const { data: scheduleSlots = [] } = useQuery({
    queryKey: queryKeys.trainer.slots,
    queryFn: fetchTrainerSlots,
    staleTime: 120_000,
  });

  const nextSlot = formatNextOpenSlot(scheduleSlots);

  return (
    <View style={[theme.stack, marketplaceHeader && theme.stackMarketplace]}>
      {!marketplaceHeader ? (
        <View style={[theme.card, theme.cardPadding, theme.cardGap]}>
          <Pressable style={theme.rowStart} onPress={onSettings}>
            <HomeUserAvatar
              uri={profilePicture}
              name={name}
              size={64}
              onlineStatus={showAsOnline ? "online" : "offline"}
            />
            <View style={theme.flex1}>
              <Text style={theme.welcome}>{name}</Text>
              <Text style={theme.role}>{t("trainerDashboard.roleTrainer")}</Text>
              <TrainerGreetingRating onPress={() => onOpenReviews?.()} />
            </View>
            <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
          </Pressable>
        </View>
      ) : null}

      <PendingRequestsBanner count={pendingSessions.length} onPress={onOpenSessions} />

      <View style={theme.card}>
        <TrainerOnlineToggle
          embedded
          value={showAsOnline}
          onToggle={onAvailabilityToggle}
        />
        <View style={theme.divider} />
        <Pressable style={theme.scheduleRow} onPress={onOpenSchedule}>
          <Ionicons name="calendar-outline" size={18} color={c.brandNavy} />
          <Text style={theme.scheduleText}>
            {nextSlot
              ? t("trainerDashboard.nextSlot", { when: nextSlot })
              : t("trainerDashboard.noSlots")}
          </Text>
          <Text style={theme.sectionLink}>{t("trainerDashboard.openSchedule")}</Text>
        </Pressable>
      </View>

      <TodayScheduleTimeline
        sessions={todayTimeline}
        onSessionPress={onSessionPress}
        onSeeAll={onOpenSessions}
      />

      {loadingFriendRequests ? (
        <FriendRequestTilesSkeleton count={2} />
      ) : friendRequests.length > 0 && onAcceptFriend && onRejectFriend ? (
        <TrainerFriendRequestsSection
          requests={friendRequests}
          onAccept={onAcceptFriend}
          onReject={onRejectFriend}
        />
      ) : null}

      <TrainerRecentTraineesSection trainees={recentTrainees} />

      <MiniFriendsSection onPressAll={() => onOpenSurface("friends" as any)} />

      <DashboardClipsPreviewSection onViewMore={onOpenClips} />

      <PerformanceTipsCard
        pendingCount={pendingSessions.length}
        showAsOnline={showAsOnline}
        scheduleSlots={scheduleSlots}
      />

      <ReferFriendsBanner onPressInvite={() => onOpenSurface("invite" as any)} />

      <TrainerLockerSection accountType={accountType} onOpenSurface={onOpenSurface} />
    </View>
  );
}

export const TrainerDashboardHub = React.memo(TrainerDashboardHubInner);
