import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { PendingAuthResumeBridge } from "../../auth/components/PendingAuthResumeBridge";
import { useAuth } from "../../auth/context/AuthContext";
import { AccountType } from "../../../constants/accountType";
import {
  FriendRequestTilesSkeleton,
  ImageWithSkeleton,
  MorphRefreshHeader,
  Skeleton,
  TrainerHomeSkeleton,
} from "../../../components/ui";
import { useCombinedScroll } from "../../../lib/refresh/useCombinedScroll";
import { useMorphRefreshBundle } from "../../../lib/refresh/useMorphRefreshBundle";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { queryKeys } from "../../../lib/queryKeys";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { resolveShowAsOnline } from "../../../lib/user/resolveShowAsOnline";
import { TabScreenShell, useHorizontalGutter } from "../../../lib/layout";
import { useCmsHome } from "../../content/hooks/useCmsHome";
import {
  fetchScheduledMeetings,
  fetchFriendRequests,
  fetchRecentTrainees,
  postAcceptFriendRequest,
  postRejectFriendRequest,
  setOnlineAvailability,
} from "../../home/api/homeApi";
import { useNavigation, type CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type {
  HomeStackParamList,
  MainTabParamList,
  ShellSurfaceRouteId,
} from "../../../navigation/types";
import type { DashboardRouteId } from "../config/dashboardRoutes";
import {
  DashboardEmptyWelcome,
  HomeSection,
  LockerHub,
  SessionListSection,
  TraineeDiscoverDashboard,
} from "../components/home";
import { TrainerDashboardHub } from "../components/trainer/TrainerDashboardHub";
import AIFloatingButton from "../../ai/AIFloatingButton";
import AIAssistantScreen from "../../ai/AIAssistantScreen";
import { useSessionBooking } from "../../sessions/SessionBookingContext";
import {
  getOtherParty,
  isSessionInProgress,
  normalizeSessionStatus,
  shouldShowInDashboardRequests,
  shouldShowInDashboardUpcoming,
} from "../../../lib/sessions/sessionUtils";
import { PostLessonConcernBanner } from "../../sessions/components/PostLessonConcernBanner";
import { TrainerProfileModal } from "../../bookexpert/components/TrainerProfileModal";
import { InstantLessonBookingWizardModal } from "../../instant-lesson/booking-wizard";
import { ScheduledBookingWizardModal } from "../../scheduled-booking/ScheduledBookingWizardModal";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { HomeHeroCarousel } from "../../home/components/HomeHeroCarousel";
import {
  useMarketplaceContentWidth,
  useMarketplaceScrollPadding,
} from "../../home/layout/marketplaceLayout";
import { HomeOffersCarousel } from "../../home/components/HomeOffersCarousel";
import { StickyBottomPromoBar } from "../../home/components/StickyBottomPromoBar";
import { DiscoverHomeChrome } from "../../home/layout/DiscoverHomeChrome";
import { TrainerQuickChipsRow } from "../../home/components/TrainerQuickChipsRow";
import { useHomeScrollHandler } from "../../home/hooks/useHomeScrollHandler";

function useDashboardHomeStyles() {
  return useThemedStyles((palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.surface },
  content: {},

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: space.lg,
    paddingBottom: space.md,
    backgroundColor: palette.surfaceElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  greeting: { ...typography.titleMd, color: palette.text },
  roleTag: { ...typography.bodySm, color: palette.textMuted, marginTop: 2 },
  avatarOnlineDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#43A047",
    borderWidth: 2,
    borderColor: palette.surfaceElevated,
  },
  avatarOfflineDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#E57373",
    borderWidth: 2,
    borderColor: palette.surfaceElevated,
  },

  quickRow: {
    flexDirection: "row",
    paddingVertical: space.md,
    gap: space.sm,
    backgroundColor: palette.surfaceElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
    flexWrap: "wrap",
  },
  quickBtn: {
    flex: 1,
    minWidth: 72,
    alignItems: "center",
    paddingVertical: space.md,
    backgroundColor: palette.brandSubtle,
    borderRadius: radii.md,
    gap: space.xs,
  },
  quickBtnPressed: { opacity: 0.8 },
  quickBtnText: { ...typography.label, color: palette.text, textAlign: "center", fontSize: 11 },

  section: { marginTop: space.md, backgroundColor: palette.surfaceElevated, paddingVertical: space.md },
  sectionHeader: {
    ...typography.titleSm,
    color: palette.brandNavy,
    paddingHorizontal: space.md,
    marginBottom: space.sm,
  },
  loadingRow: { alignItems: "center", paddingVertical: space.lg },

  coachName: {
    ...typography.label,
    color: palette.text,
    marginTop: space.xs,
    textAlign: "center",
  },
  coachCat: { ...typography.caption, color: palette.textMuted, textAlign: "center", marginTop: 2 },
  bookBtn: {
    marginTop: space.sm,
    backgroundColor: palette.brandNavy,
    borderRadius: radii.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 5,
  },
  bookBtnPressed: { opacity: 0.75 },
  bookBtnText: { fontSize: 12, color: palette.brandTextOn, fontWeight: "600" },

  recentChip: { alignItems: "center", width: 68 },
  recentName: {
    fontSize: 11,
    color: palette.text,
    marginTop: 4,
    textAlign: "center",
    fontWeight: "500",
  },

  friendName: { ...typography.label, color: palette.text, fontSize: 14 },
  friendActions: { flexDirection: "row", gap: space.sm, marginTop: 6 },
  friendBtn: { borderRadius: radii.sm, paddingHorizontal: space.md, paddingVertical: 5 },
  friendBtnText: { fontSize: 12, color: palette.brandTextOn, fontWeight: "600" },

  avatarFallback: {
    backgroundColor: palette.brandNavy,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { color: palette.brandTextOn, fontWeight: "700" },

}));
}

function Avatar({
  uri,
  name,
  size = 56,
  onlineStatus,
}: {
  uri?: string;
  name?: string;
  size?: number;
  onlineStatus?: "online" | "offline";
}) {
  const { t } = useAppTranslation();
  const styles = useDashboardHomeStyles();
  const [failed, setFailed] = React.useState(false);
  const url = getS3ImageUrl(uri);

  React.useEffect(() => {
    setFailed(false);
  }, [uri]);

  const inner =
    !url || failed ? (
      <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.avatarInitial, { fontSize: size * 0.38 }]}>
          {(name ?? "?")[0]?.toUpperCase()}
        </Text>
      </View>
    ) : (
      <ImageWithSkeleton
        uri={url}
        width={size}
        height={size}
        borderRadius={size / 2}
        resizeMode="cover"
        onLoadError={() => setFailed(true)}
        accessibilityLabel={
          name ? t("dashboardHome.photoOf", { name }) : t("dashboardHome.profilePhoto")
        }
      />
    );

  if (!onlineStatus) return inner;

  return (
    <View style={{ width: size, height: size }}>
      {inner}
      <View
        style={
          onlineStatus === "online" ? styles.avatarOnlineDot : styles.avatarOfflineDot
        }
      />
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  const styles = useDashboardHomeStyles();
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

/** Native compact friend-request row (replaces the old web-ported tile layout) */
function FriendRequestRow({
  request,
  onAccept,
  onReject,
  isLast,
}: {
  request: any;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  isLast?: boolean;
}) {
  const { t } = useAppTranslation();
  const themeColors = useThemeColors();
  const styles = useThemedStyles((palette) =>
    StyleSheet.create({
      row: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        gap: space.sm,
        borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: palette.border,
      },
      nameWrap: { flex: 1, minWidth: 0 },
      name: { ...typography.label, color: palette.text, fontSize: 14 },
      sport: { ...typography.caption, color: palette.textMuted, marginTop: 1 },
      actions: { flexDirection: "row", gap: space.xs },
      btn: {
        borderRadius: radii.sm,
        paddingHorizontal: space.sm,
        paddingVertical: 5,
        minWidth: 56,
        alignItems: "center",
      },
      btnText: { fontSize: 12, color: palette.brandTextOn, fontWeight: "600" },
    })
  );
  const sender = request?.senderId;
  const name = sender?.fullname || sender?.fullName || t("dashboardHome.userDefault");
  const sport = sender?.sport || sender?.sports?.[0];
  return (
    <View style={styles.row}>
      <Avatar uri={sender?.profile_picture} name={name} size={44} />
      <View style={styles.nameWrap}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        {!!sport && <Text style={styles.sport} numberOfLines={1}>{sport}</Text>}
      </View>
      <View style={styles.actions}>
        <Pressable
          style={[styles.btn, { backgroundColor: themeColors.success }]}
          onPress={() => onAccept(request._id)}
          accessibilityRole="button"
          accessibilityLabel={t("dashboardHome.acceptRequestA11y", { name })}
        >
          <Text style={styles.btnText}>{t("dashboardHome.accept")}</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, { backgroundColor: themeColors.danger }]}
          onPress={() => onReject(request._id)}
          accessibilityRole="button"
          accessibilityLabel={t("dashboardHome.rejectRequestA11y", { name })}
        >
          <Text style={styles.btnText}>{t("dashboardHome.reject")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function QuickActionButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const styles = useDashboardHomeStyles();
  const themeColors = useThemeColors();
  return (
    <Pressable
      style={({ pressed }) => [styles.quickBtn, pressed && styles.quickBtnPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={26} color={themeColors.brandNavy} />
      <Text style={styles.quickBtnText}>{label}</Text>
    </Pressable>
  );
}

type DashboardHomeProps = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, "DashboardHome">,
  BottomTabScreenProps<MainTabParamList>
>;

export function DashboardHomeScreen(_props: DashboardHomeProps) {
  const navigation = useNavigation<DashboardHomeProps["navigation"]>();
  const { t } = useAppTranslation();
  const themeColors = useThemeColors();
  const styles = useDashboardHomeStyles();
  const [aiOpen, setAiOpen] = useState(false);
  const [profileTrainer, setProfileTrainer] = useState<Record<string, unknown> | null>(null);
  const [wizardTrainer, setWizardTrainer] = useState<Record<string, unknown> | null>(null);
  const [scheduleTrainer, setScheduleTrainer] = useState<Record<string, unknown> | null>(null);
  const { user, accountType, patchUser } = useAuth();
  const { openSession } = useSessionBooking();
  const queryClient = useQueryClient();
  const showAsOnline = resolveShowAsOnline(user);
  const gutter = useHorizontalGutter("md");
  const marketplaceScrollBottom = useMarketplaceScrollPadding();
  const marketplaceContentWidth = useMarketplaceContentWidth();
  const homeScroll = useHomeScrollHandler();
  const isTrainee = accountType === AccountType.TRAINEE;
  const isTrainer = accountType === AccountType.TRAINER;

  const { data: cmsHome, isLoading: cmsHomeLoading } = useCmsHome(false, {
    enabled: isTrainer,
    refetchOnMount: "always",
  });
  const showTrainerHomeSkeleton = isTrainer && cmsHomeLoading && !cmsHome;

  const name =
    (user?.fullname as string) ||
    (user?.fullName as string) ||
    (user?.name as string) ||
    t("dashboardHome.userDefault");

  const handleAvailabilityToggle = useCallback(
    async (next: boolean) => {
      const confirmed = await setOnlineAvailability(next);
      patchUser({ showAsOnline: confirmed });
      void queryClient.invalidateQueries({ queryKey: queryKeys.presence.onlineUsers });
      void queryClient.invalidateQueries({ queryKey: queryKeys.chats.conversations });
    },
    [patchUser, queryClient]
  );

  const { data: sessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: queryKeys.sessions.upcoming,
    queryFn: () => fetchScheduledMeetings("upcoming"),
    staleTime: 60_000,
  });

  const [sessionListTick, setSessionListTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSessionListTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const { data: completedSessions = [] } = useQuery({
    queryKey: queryKeys.sessions.completed,
    queryFn: () => fetchScheduledMeetings("completed"),
    staleTime: 120_000,
  });

  const recentCompletedForConcern = useMemo(() => {
    const completed = completedSessions.filter(
      (s: any) => normalizeSessionStatus(s?.status) === "completed"
    );
    if (!completed.length) return null;
    const sorted = [...completed].sort((a, b) => {
      const ta = new Date(a.updatedAt || a.end_time || a.booked_date).getTime();
      const tb = new Date(b.updatedAt || b.end_time || b.booked_date).getTime();
      return tb - ta;
    });
    const latest = sorted[0];
    const endedAt = new Date(latest.updatedAt || latest.end_time || latest.booked_date).getTime();
    if (Date.now() - endedAt > 7 * 24 * 60 * 60 * 1000) return null;
    return latest;
  }, [completedSessions]);

  const { data: friendRequests = [], isLoading: loadingFriends } = useQuery({
    queryKey: queryKeys.friends.requests,
    queryFn: fetchFriendRequests,
    staleTime: 120_000,
  });

  const { data: recentTrainees = [] } = useQuery({
    queryKey: queryKeys.presence.recentTrainees,
    queryFn: fetchRecentTrainees,
    enabled: isTrainer,
    staleTime: 120_000,
  });

  /** Only true during an explicit pull-to-refresh — not background refetches
   *  (binding to isFetching breaks iOS scrolling / UIRefreshControl). */
  const [pullRefreshing, setPullRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      const tasks = [
        queryClient.refetchQueries({ queryKey: queryKeys.sessions.upcoming }),
        queryClient.refetchQueries({ queryKey: queryKeys.friends.requests }),
        queryClient.refetchQueries({ queryKey: queryKeys.presence.recentTrainees }),
        isTrainee
          ? queryClient.refetchQueries({ queryKey: queryKeys.presence.recentTrainers })
          : Promise.resolve(),
      ];
      if (isTrainee) {
        tasks.push(
          queryClient.refetchQueries({ queryKey: queryKeys.presence.onlineUsers }),
          queryClient.refetchQueries({ queryKey: queryKeys.presence.bookExpertOnline }),
          queryClient.refetchQueries({ queryKey: ["trainersDirectory"] }),
          queryClient.refetchQueries({ queryKey: queryKeys.trainee.favorites }),
          queryClient.refetchQueries({ queryKey: queryKeys.content.home(false) }),
        );
      } else {
        tasks.push(
          queryClient.refetchQueries({ queryKey: queryKeys.content.home(false) }),
        );
      }
      if (!isTrainee) {
        tasks.push(
          queryClient.refetchQueries({ queryKey: queryKeys.presence.onlineUsers }),
          queryClient.refetchQueries({ queryKey: queryKeys.wallet.earnings }),
          queryClient.refetchQueries({ queryKey: queryKeys.trainer.slots }),
          queryClient.refetchQueries({ queryKey: queryKeys.trainer.myStats }),
          queryClient.refetchQueries({
            queryKey: queryKeys.ai.reviewAnalysis(String(user?._id ?? "")),
          }),
          queryClient.refetchQueries({ queryKey: queryKeys.trainerRole.recentTraineeClips })
        );
      }
      await Promise.all(tasks);
    } finally {
      setPullRefreshing(false);
    }
  }, [queryClient, isTrainee, user?._id]);

  const morphHome = useMorphRefreshBundle(onRefresh, pullRefreshing);
  const onHomeScroll = useCombinedScroll(morphHome.onMorphScroll, homeScroll.onScroll);

  const openFeature = (id: DashboardRouteId, extra?: Partial<{ bookLessonTrainerId: string }>) => {
    // Some dashboard “features” map directly to bottom tabs for correct tab highlighting.
    if (id === "schedule") {
      try {
        navigation.getParent()?.navigate("Schedule" as never);
        return;
      } catch {
        /* fall through */
      }
    }
    if (id === "upcoming-sessions") {
      try {
        navigation.getParent()?.navigate("Schedule" as never);
        return;
      } catch {
        /* fall through */
      }
    }
    if (id === "chats") {
      try {
        navigation.getParent()?.navigate("Chats" as never);
        return;
      } catch {
        /* fall through */
      }
    }
    navigation.navigate("DashboardFeature", {
      featureId: id,
      ...extra,
    });
  };

  const openShell = (id: ShellSurfaceRouteId) => {
    navigation.navigate("ShellSurface", { surfaceId: id });
  };

  useLayoutEffect(() => {
    void queryClient.prefetchQuery({
      queryKey: queryKeys.wallet.balance,
      queryFn: async () => {
        const { fetchWalletBalance } = await import("../../wallet/walletApi");
        return fetchWalletBalance();
      },
    });
  }, [queryClient]);

  useLayoutEffect(() => {
    if (typeof navigation?.setOptions !== "function") return;
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: "row", alignItems: "center", marginRight: 6 }}>
          <Pressable
            onPress={() => openShell("wallet")}
            hitSlop={12}
            style={{ padding: 4 }}
            accessibilityLabel={t("dashboardHome.walletA11y")}
            accessibilityRole="button"
          >
            <Ionicons name="wallet-outline" size={24} color={themeColors.brandNavy} />
          </Pressable>
          <Pressable
            onPress={() => openShell("notifications")}
            hitSlop={12}
            style={{ padding: 4, marginLeft: 4 }}
            accessibilityLabel={t("dashboardHome.notificationsA11y")}
            accessibilityRole="button"
          >
            <Ionicons name="notifications-outline" size={24} color={themeColors.brandNavy} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, t, themeColors.brandNavy]);

  const handleAccept = useCallback(async (requestId: string) => {
    await postAcceptFriendRequest(requestId);
    queryClient.invalidateQueries({ queryKey: queryKeys.friends.requests });
  }, [queryClient]);

  const handleReject = useCallback(async (requestId: string) => {
    await postRejectFriendRequest(requestId);
    queryClient.invalidateQueries({ queryKey: queryKeys.friends.requests });
  }, [queryClient]);

  const nowSessions = useMemo(
    () => sessions.filter((s: any) => isSessionInProgress(s)),
    [sessions]
  );
  const pendingSessions = useMemo(
    () =>
      isTrainer
        ? sessions.filter((s: any) => shouldShowInDashboardRequests(s))
        : [],
    [sessions, isTrainer, sessionListTick]
  );
  const upcomingConfirmed = useMemo(
    () => sessions.filter((s: any) => shouldShowInDashboardUpcoming(s)),
    [sessions, sessionListTick]
  );
  const showEmptyDashboard =
    !loadingSessions &&
    nowSessions.length === 0 &&
    pendingSessions.length === 0 &&
    upcomingConfirmed.length === 0;

  const resumeBook = useCallback(
    (trainer: Record<string, unknown>, mode: "instant" | "schedule") => {
      if (mode === "schedule") {
        setScheduleTrainer(trainer);
      } else {
        setWizardTrainer(trainer);
      }
    },
    []
  );

  return (
    <>
      <PendingAuthResumeBridge onResumeBook={isTrainee ? resumeBook : undefined} />
      <InstantLessonBookingWizardModal
        visible={!!wizardTrainer}
        trainer={wizardTrainer}
        onDismiss={() => setWizardTrainer(null)}
      />
      <ScheduledBookingWizardModal
        visible={!!scheduleTrainer}
        trainer={scheduleTrainer}
        onDismiss={() => setScheduleTrainer(null)}
        onBooked={() => openFeature("upcoming-sessions")}
      />
      <TrainerProfileModal
        visible={!!profileTrainer}
        trainer={profileTrainer}
        onDismiss={() => setProfileTrainer(null)}
        onInstant={(t) => setWizardTrainer(t)}
        onSchedule={(t) => setScheduleTrainer(t)}
      />
    {isTrainee ? (
      <TabScreenShell clearFloatingTabBar={false} background={themeColors.surface}>
        <MorphRefreshHeader {...morphHome.headerProps} />
        <TraineeDiscoverDashboard
          name={name}
          accountType={accountType ?? AccountType.TRAINEE}
          profilePicture={(user as any)?.profile_picture}
          user={user as Record<string, unknown> | undefined}
          onSettings={() => openShell("settings")}
          onViewTrainer={setProfileTrainer}
          onInstantBook={setWizardTrainer}
          onScheduleBook={setScheduleTrainer}
          onOpenWallet={() => openShell("wallet")}
          onOpenSession={openSession}
          contentContainerStyle={[gutter, styles.content]}
          onScroll={onHomeScroll}
          scrollEventThrottle={morphHome.scrollEventThrottle}
          refreshControl={
            <RefreshControl
              refreshing={morphHome.refreshing}
              onRefresh={morphHome.onRefreshControl}
              tintColor={themeColors.brandNavy}
            />
          }
          footer={
            <>
              {(loadingFriends || friendRequests.length > 0) ? (
                <HomeSection
                  title={t("dashboardHome.recentFriendRequests")}
                  testID="home-friend-requests"
                >
                  {loadingFriends ? (
                    <View style={{ padding: space.md }}>
                      <FriendRequestTilesSkeleton count={2} />
                    </View>
                  ) : (
                    friendRequests.map((req: any, idx: number) => (
                      <FriendRequestRow
                        key={req._id}
                        request={req}
                        onAccept={handleAccept}
                        onReject={handleReject}
                        isLast={idx === friendRequests.length - 1}
                      />
                    ))
                  )}
                </HomeSection>
              ) : null}

              {showEmptyDashboard ? (
                <HomeSection testID="home-empty-sessions-hint" title={t("dashboardHome.upcomingSessions")}>
                  <DashboardEmptyWelcome
                    onBookLesson={() =>
                      (navigation as { navigate: (name: string) => void }).navigate("Schedule")
                    }
                    onOpenClips={() => openShell("clips")}
                  />
                </HomeSection>
              ) : null}

              {recentCompletedForConcern ? (
                <PostLessonConcernBanner
                  sessionId={String(recentCompletedForConcern._id ?? recentCompletedForConcern.id)}
                  otherPartyName={
                    getOtherParty(recentCompletedForConcern, isTrainer)?.fullname ||
                    getOtherParty(recentCompletedForConcern, isTrainer)?.fullName
                  }
                />
              ) : null}

              {(loadingSessions || nowSessions.length > 0) && (
                <SessionListSection
                  title={t("dashboardHome.activeSessions")}
                  subtitle={t("dashboardHome.activeSessionsSub")}
                  sessions={nowSessions}
                  accountType={accountType}
                  loading={loadingSessions}
                  maxPreview={5}
                  onSessionPress={openSession}
                  testID="home-active-sessions"
                />
              )}

              {upcomingConfirmed.length > 0 && nowSessions.length === 0 && (
                <SessionListSection
                  title={t("dashboardHome.upcomingSessions")}
                  subtitle={t("dashboardHome.upcomingSessionsSub")}
                  sessions={upcomingConfirmed}
                  accountType={accountType}
                  maxPreview={3}
                  seeAllLabel={t("dashboardHome.seeAllSessions", { count: upcomingConfirmed.length })}
                  onSeeAll={() => openFeature("upcoming-sessions")}
                  onSessionPress={openSession}
                  testID="home-upcoming-sessions"
                />
              )}

              <LockerHub accountType={accountType} onOpenSurface={openShell} />
            </>
          }
        />
      </TabScreenShell>
    ) : (
      <TabScreenShell clearFloatingTabBar={false} background={themeColors.surface}>
        <DiscoverHomeChrome
          compactTop
          headline={t("homeMarketplace.greeting", { name, defaultValue: `Hi, ${name}` })}
          subline={t("trainerDashboard.roleTrainer")}
          profilePicture={(user as any)?.profile_picture}
          profileName={name}
          onPressProfile={() => openShell("settings")}
          showSearch={false}
          bottomSlot={
            <TrainerQuickChipsRow
              onSchedule={() => openFeature("schedule")}
              onSessions={() => openFeature("upcoming-sessions")}
              onWallet={() => openShell("wallet")}
              onClips={() => openShell("clips")}
              onGoLive={() => void handleAvailabilityToggle(true)}
            />
          }
        />
        <MorphRefreshHeader {...morphHome.headerProps} />
        <ScrollView
          style={{ flex: 1, backgroundColor: themeColors.background }}
          contentContainerStyle={[
            gutter,
            styles.content,
            { paddingBottom: marketplaceScrollBottom },
          ]}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          onScroll={onHomeScroll}
          scrollEventThrottle={morphHome.scrollEventThrottle}
          refreshControl={
            <RefreshControl
              refreshing={morphHome.refreshing}
              onRefresh={morphHome.onRefreshControl}
              tintColor={themeColors.brandNavy}
            />
          }
        >
          {showTrainerHomeSkeleton ? (
            <TrainerHomeSkeleton />
          ) : (
            <>
              <HomeHeroCarousel contentWidth={marketplaceContentWidth} />
              <HomeOffersCarousel />
            </>
          )}
          <TrainerDashboardHub
            marketplaceHeader
            name={name}
            accountType={accountType ?? AccountType.TRAINER}
            profilePicture={(user as any)?.profile_picture}
            showAsOnline={showAsOnline}
            user={user as Record<string, unknown> | undefined}
            recentTrainees={recentTrainees}
            friendRequests={friendRequests}
            loadingFriendRequests={loadingFriends}
            onAcceptFriend={handleAccept}
            onRejectFriend={handleReject}
            onSettings={() => openShell("settings")}
            onAvailabilityToggle={handleAvailabilityToggle}
            onOpenWallet={() => openShell("wallet")}
            onOpenSchedule={() => openFeature("schedule")}
            onOpenSessions={() => openFeature("upcoming-sessions")}
            onOpenClips={() => openShell("clips")}
            onOpenSurface={openShell}
            onOpenReviews={() => openShell("trainerReviews")}
            onSessionPress={openSession}
          />
        </ScrollView>
        <StickyBottomPromoBar />
      </TabScreenShell>
    )}

      <AIFloatingButton onPress={() => setAiOpen(true)} />

      <Modal visible={aiOpen} animationType="slide" onRequestClose={() => setAiOpen(false)}>
        <AIAssistantScreen onClose={() => setAiOpen(false)} />
      </Modal>
    </>
  );
}

