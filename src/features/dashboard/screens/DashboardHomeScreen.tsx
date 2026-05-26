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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Skeleton, ImageWithSkeleton } from "../../../components/ui";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { queryKeys } from "../../../lib/queryKeys";
import { haptics } from "../../../lib/haptics";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { resolveShowAsOnline } from "../../../lib/user/resolveShowAsOnline";
import { useHorizontalGutter } from "../../../lib/layout/useHorizontalGutter";
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
import { HomeMainCont, useWebHomeStyles } from "../components/webHome";
import {
  DashboardEmptyWelcome,
  LockerHub,
  SessionListSection,
  TraineeDiscoverDashboard,
} from "../components/home";
import { TrainerDashboardHub } from "../components/trainer/TrainerDashboardHub";
import { CallRejoinBanner } from "../../calling/components/CallRejoinBanner";
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
import {
  CoachMark,
  PreClassChecklistSheet,
  ProfileCompletionPill,
} from "../../onboarding";
import { useHapticRefresh } from "../../../lib/refresh/useHapticRefresh";
import { MorphRefreshHeader } from "../../../components/ui";
import { useMorphRefresh } from "../../../lib/refresh/useMorphRefresh";

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

/** Web `NavHomePage` friend request tiles — column card with navy border */
function FriendRequestWebTile({
  request,
  onAccept,
  onReject,
}: {
  request: any;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const { t } = useAppTranslation();
  const styles = useDashboardHomeStyles();
  const themeColors = useThemeColors();
  const webHomeStyles = useWebHomeStyles();
  const sender = request?.senderId;
  const name = sender?.fullname || sender?.fullName || t("dashboardHome.userDefault");
  return (
    <View style={webHomeStyles.friendRequestTile}>
      <Avatar uri={sender?.profile_picture} name={name} size={72} />
      <Text style={[styles.friendName, { marginTop: 10, textAlign: "center" }]} numberOfLines={2}>
        {name}
      </Text>
      <View style={[styles.friendActions, { justifyContent: "center" }]}>
        <Pressable
          style={[styles.friendBtn, { backgroundColor: themeColors.success }]}
          onPress={() => onAccept(request._id)}
          accessibilityRole="button"
          accessibilityLabel={t("dashboardHome.acceptRequestA11y", { name })}
        >
          <Text style={styles.friendBtnText}>{t("dashboardHome.accept")}</Text>
        </Pressable>
        <Pressable
          style={[styles.friendBtn, { backgroundColor: themeColors.danger }]}
          onPress={() => onReject(request._id)}
          accessibilityRole="button"
          accessibilityLabel={t("dashboardHome.rejectRequestA11y", { name })}
        >
          <Text style={styles.friendBtnText}>{t("dashboardHome.reject")}</Text>
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
      onPress={() => {
        haptics.tap();
        onPress();
      }}
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
  const webHomeStyles = useWebHomeStyles();
  const [aiOpen, setAiOpen] = useState(false);
  const [profileTrainer, setProfileTrainer] = useState<Record<string, unknown> | null>(null);
  const [wizardTrainer, setWizardTrainer] = useState<Record<string, unknown> | null>(null);
  const [scheduleTrainer, setScheduleTrainer] = useState<Record<string, unknown> | null>(null);
  const { user, accountType, patchUser } = useAuth();
  const { openSession } = useSessionBooking();
  const queryClient = useQueryClient();
  const showAsOnline = resolveShowAsOnline(user);
  const insets = useSafeAreaInsets();
  const gutter = useHorizontalGutter("md");
  const isTrainee = accountType === AccountType.TRAINEE;
  const isTrainer = accountType === AccountType.TRAINER;

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

  /**
   * Wrap the multi-query refetch in `useHapticRefresh` so the user gets
   * a tick on trigger + a success/error notification haptic on resolve.
   * Dropping the manual `pullRefreshing` flag keeps the spinner in
   * lockstep with the haptic state.
   */
  const refreshDashboard = useCallback(async () => {
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
        queryClient.refetchQueries({ queryKey: queryKeys.trainee.favorites })
      );
    } else {
      tasks.push(
        queryClient.refetchQueries({ queryKey: queryKeys.presence.onlineUsers }),
        queryClient.refetchQueries({ queryKey: queryKeys.wallet.earnings }),
        queryClient.refetchQueries({ queryKey: queryKeys.trainer.slots })
      );
    }
    await Promise.all(tasks);
  }, [queryClient, isTrainee]);

  const { refreshing: pullRefreshing, onRefresh } = useHapticRefresh(refreshDashboard);

  /**
   * `useMorphRefresh` augments the system RefreshControl with a
   * WhatsApp-Status-style arrow that morphs into a check the moment the
   * user crosses the threshold (a haptic also fires at the morph).
   * The hook's onRefreshControl handler delegates to our hapticised
   * `onRefresh` so spinners + completion haptics still flow.
   */
  const morphRefresh = useMorphRefresh({ onRefresh });

  const openFeature = (id: DashboardRouteId, extra?: Partial<{ bookLessonTrainerId: string }>) => {
    // Some dashboard “features” map directly to bottom tabs for correct tab highlighting.
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
    <View style={{ flex: 1 }}>
    <MorphRefreshHeader
      {...morphRefresh.headerProps}
      refreshing={pullRefreshing || morphRefresh.refreshing}
    />
    <ScrollView
      style={[styles.root, { backgroundColor: themeColors.background }]}
      contentContainerStyle={[
        gutter,
        styles.content,
        { paddingBottom: space.xl * 2 + insets.bottom },
      ]}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      {...morphRefresh.scrollProps}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={morphRefresh.onRefreshControl}
          tintColor="transparent"
          colors={["transparent"]}
          progressBackgroundColor="transparent"
        />
      }
    >
      {/* Quick Actions — trainee only (trainer hub has shortcuts) */}
      {isTrainee && (
        <View style={styles.quickRow}>
          <CoachMark
            id="dashboard.quickSessions.v1"
            title={t("coachMarks.dashboardSessions.title", {
              defaultValue: "Track your lessons here",
            })}
            description={t("coachMarks.dashboardSessions.description", {
              defaultValue:
                "Tap to see upcoming, active, and past lessons all in one place.",
            })}
            icon="calendar"
            placement="bottom"
            style={{ flex: 1 }}
          >
            <QuickActionButton
              icon="calendar-outline"
              label={t("dashboardHome.quickSessions")}
              onPress={() => openFeature("upcoming-sessions")}
            />
          </CoachMark>
          <CoachMark
            id="dashboard.quickChats.v1"
            title={t("coachMarks.dashboardChats.title", {
              defaultValue: "Message trainers and friends",
            })}
            description={t("coachMarks.dashboardChats.description", {
              defaultValue:
                "Chats live in the bottom tab — and this shortcut takes you straight there.",
            })}
            icon="chatbubbles"
            placement="bottom"
            style={{ flex: 1 }}
          >
            <QuickActionButton
              icon="chatbubbles-outline"
              label={t("dashboardHome.quickChats")}
              onPress={() => navigation.getParent()?.navigate("Chats" as never)}
            />
          </CoachMark>
        </View>
      )}

      {/* Profile completion pill — shows until 100%, snoozable for 14 days. */}
      <View style={{ paddingHorizontal: space.md, paddingTop: space.sm }}>
        <ProfileCompletionPill />
      </View>

      <View style={{ paddingHorizontal: space.md, paddingTop: space.sm }}>
        <CallRejoinBanner />
      </View>

      {/* Pre-class checklist surfaces when next confirmed session is ≤5 min out. */}
      <PreClassChecklistSheet
        sessions={sessions}
        tick={sessionListTick}
        onJoin={openSession}
      />
      

      <View style={isTrainee ? { paddingTop: space.md } : undefined}>
        {isTrainer && (
          <TrainerDashboardHub
            name={name}
            accountType={accountType ?? AccountType.TRAINER}
            profilePicture={(user as any)?.profile_picture}
            showAsOnline={showAsOnline}
            user={user as Record<string, unknown> | undefined}
            recentTrainees={recentTrainees}
            friendRequests={friendRequests}
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
        )}
        {isTrainee && (
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
          />
        )}

        {isTrainee && friendRequests.length > 0 && (
          <HomeMainCont
            title={t("dashboardHome.recentFriendRequests")}
            testID="card trainer-profile-card Home-main-Cont friend-requests"
          >
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 10,
                justifyContent: "center",
              }}
            >
              {friendRequests.map((req: any, idx: number) => (
                <FriendRequestWebTile
                  key={`fr-${req?._id ?? "row"}-${idx}`}
                  request={req}
                  onAccept={handleAccept}
                  onReject={handleReject}
                />
              ))}
            </View>
          </HomeMainCont>
        )}

        {isTrainee && showEmptyDashboard ? (
          <HomeMainCont testID="home-empty-sessions-hint" title={t("dashboardHome.upcomingSessions")}>
            <DashboardEmptyWelcome
              onBookLesson={() =>
                (navigation as { navigate: (name: string) => void }).navigate("Schedule")
              }
              onOpenClips={() => openShell("clips")}
            />
          </HomeMainCont>
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

        {/* Trainer session lists live in TrainerDashboardHub; trainee lists below discover */}
        {isTrainee && (loadingSessions || nowSessions.length > 0) && (
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

        {isTrainee && upcomingConfirmed.length > 0 && nowSessions.length === 0 && (
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

        {isTrainee && (
          <LockerHub accountType={accountType} onOpenSurface={openShell} />
        )}
      </View>
    </ScrollView>
    </View>

      <AIFloatingButton onPress={() => setAiOpen(true)} />

      <Modal visible={aiOpen} animationType="slide" onRequestClose={() => setAiOpen(false)}>
        <AIAssistantScreen onClose={() => setAiOpen(false)} />
      </Modal>
    </>
  );
}

