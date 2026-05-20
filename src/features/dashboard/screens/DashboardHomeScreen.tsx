import React, { useCallback, useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { useAuth } from "../../auth/context/AuthContext";
import { AccountType } from "../../../constants/accountType";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Skeleton, ImageWithSkeleton } from "../../../components/ui";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { resolveShowAsOnline } from "../../../lib/user/resolveShowAsOnline";
import { useHorizontalGutter } from "../../../lib/layout/useHorizontalGutter";
import {
  fetchOnlineUsers,
  fetchScheduledMeetings,
  fetchFriendRequests,
  fetchRecentTrainees,
  fetchRecentTrainers,
  postAcceptFriendRequest,
  postRejectFriendRequest,
  setOnlineAvailability,
} from "../../home/api/homeApi";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type {
  HomeStackParamList,
  MainTabParamList,
  ShellSurfaceRouteId,
} from "../../../navigation/types";
import type { DashboardRouteId } from "../config/dashboardRoutes";
import {
  HomeMainCont,
  RecentUsersGrid,
  TrainerBoxCard,
  useWebHomeStyles,
} from "../components/webHome";
import {
  DashboardEmptyWelcome,
  LockerHub,
  SessionListSection,
  TraineeProfileSection,
  TrainerProfileSection,
} from "../components/home";
import AIFloatingButton from "../../ai/AIFloatingButton";
import AIAssistantScreen from "../../ai/AIAssistantScreen";
import ReviewAnalysisCard from "../../ai/ReviewAnalysisCard";
import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { useSessionBooking } from "../../sessions/SessionBookingContext";
import {
  getOtherParty,
  isPendingBooking,
  isSessionInProgress,
  normalizeSessionStatus,
} from "../../../lib/sessions/sessionUtils";
import { PostLessonConcernBanner } from "../../sessions/components/PostLessonConcernBanner";
import { TrainerProfileModal } from "../../bookexpert/components/TrainerProfileModal";
import { InstantLessonBookingWizardModal } from "../../instant-lesson/booking-wizard";
import { ScheduledBookingWizardModal } from "../../scheduled-booking/ScheduledBookingWizardModal";
import { getTrainerCategories } from "../../bookexpert/lib/trainerUtils";
import { useAppTranslation } from "../../../i18n/useAppTranslation";

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

function CoachCard({
  trainer,
  onView,
}: {
  trainer: any;
  onView: (trainer: any) => void;
}) {
  const { t } = useAppTranslation();
  const styles = useDashboardHomeStyles();
  const name = trainer?.fullname || trainer?.fullName || t("dashboardHome.coachDefault");
  const cats = getTrainerCategories(trainer).slice(0, 2).join(", ");
  return (
    <Pressable
      style={({ pressed }) => [pressed && { opacity: 0.9 }]}
      onPress={() => onView(trainer)}
      accessibilityRole="button"
      accessibilityLabel={t("dashboardHome.viewCoachA11y", { name })}
    >
      <TrainerBoxCard style={{ width: 132, flexShrink: 0 }}>
        <Avatar uri={trainer?.profile_picture} name={name} size={70} onlineStatus="online" />
        <Text style={styles.coachName} numberOfLines={1}>{name}</Text>
        {!!cats && <Text style={styles.coachCat} numberOfLines={1}>{cats}</Text>}
        <View style={styles.bookBtn}>
          <Text style={styles.bookBtnText}>{t("dashboardHome.viewProfile")}</Text>
        </View>
      </TrainerBoxCard>
    </Pressable>
  );
}

function RecentUserChip({ user, label }: { user: any; label?: string }) {
  const { t } = useAppTranslation();
  const styles = useDashboardHomeStyles();
  const name = user?.fullname || user?.fullName || label || t("dashboardHome.userDefault");
  return (
    <View style={styles.recentChip}>
      <Avatar uri={user?.profile_picture} name={name} size={44} />
      <Text style={styles.recentName} numberOfLines={1}>{name}</Text>
    </View>
  );
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
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={26} color={themeColors.brandNavy} />
      <Text style={styles.quickBtnText}>{label}</Text>
    </Pressable>
  );
}

function AIRecommendedSection({ onView }: { onView: (t: any) => void }) {
  const { t } = useAppTranslation();
  const styles = useDashboardHomeStyles();
  const themeColors = useThemeColors();
  const { data, isLoading } = useQuery({
    queryKey: ["aiRecommendations"],
    queryFn: async () => {
      const res = await apiClient.get(API_ROUTES.ai.recommendTrainers);
      return res.data?.result?.recommendations || [];
    },
    staleTime: 300_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <HomeMainCont title={t("dashboardHome.recommendedForYou")} testID="card ai-recommended">
        <View style={{ flexDirection: "row", gap: space.sm }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} width={160} height={180} radius={radii.md} />
          ))}
        </View>
      </HomeMainCont>
    );
  }

  if (!data?.length) return null;

  return (
    <HomeMainCont title={t("dashboardHome.recommendedForYou")} testID="card ai-recommended">
      <FlatList
        horizontal
        nestedScrollEnabled
        data={data.slice(0, 6)}
        keyExtractor={(item: any, i: number) => item?.trainerId ?? String(i)}
        renderItem={({ item }: { item: any }) => (
          <Pressable
            style={({ pressed }) => [pressed && { opacity: 0.9 }]}
            onPress={() => item.trainer && onView(item.trainer)}
          >
            <TrainerBoxCard style={{ width: 150, flexShrink: 0 }}>
              <Avatar uri={item.trainer?.profile_picture} name={item.trainer?.fullname} size={60} />
              <Text style={styles.coachName} numberOfLines={1}>
                {item.trainer?.fullname || t("dashboardHome.coachDefault")}
              </Text>
              <Text style={[styles.coachCat, { fontSize: 11 }]} numberOfLines={1}>
                {item.trainer?.category || ""}
              </Text>
              <Text style={{ fontSize: 10, color: themeColors.textMuted, textAlign: "center", marginTop: 2 }} numberOfLines={2}>
                {item.reason || ""}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: 2 }}>
                <Ionicons name="star" size={12} color="#f59e0b" />
                <Text style={{ fontSize: 11, color: themeColors.text, fontWeight: "600" }}>
                  {item.trainer?.avgRating || t("dashboardHome.newRating")}
                </Text>
              </View>
              <View style={styles.bookBtn}>
                <Text style={styles.bookBtnText}>{t("dashboardHome.viewProfile")}</Text>
              </View>
            </TrainerBoxCard>
          </Pressable>
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space.sm, paddingVertical: 4 }}
      />
    </HomeMainCont>
  );
}

type DashboardHomeProps = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, "DashboardHome">,
  BottomTabScreenProps<MainTabParamList>
>;

export function DashboardHomeScreen({ navigation }: DashboardHomeProps) {
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
      void queryClient.invalidateQueries({ queryKey: ["onlineUsers"] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    [patchUser, queryClient]
  );

  const { data: onlineUsers = [], isLoading: loadingCoaches } = useQuery({
    queryKey: ["onlineUsers"],
    queryFn: fetchOnlineUsers,
    enabled: isTrainee,
    staleTime: 60_000,
  });

  const { data: sessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ["sessions", "upcoming"],
    queryFn: () => fetchScheduledMeetings("upcoming"),
    staleTime: 60_000,
  });

  const { data: completedSessions = [] } = useQuery({
    queryKey: ["sessions", "completed"],
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
    queryKey: ["friendRequests"],
    queryFn: fetchFriendRequests,
    staleTime: 120_000,
  });

  const { data: recentTrainees = [] } = useQuery({
    queryKey: ["recentTrainees"],
    queryFn: fetchRecentTrainees,
    enabled: isTrainer,
    staleTime: 120_000,
  });

  const { data: recentTrainers = [] } = useQuery({
    queryKey: ["recentTrainers"],
    queryFn: fetchRecentTrainers,
    enabled: isTrainee,
    staleTime: 120_000,
  });

  /** Only true during an explicit pull-to-refresh — not background refetches
   *  (binding to isFetching breaks iOS scrolling / UIRefreshControl). */
  const [pullRefreshing, setPullRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["onlineUsers"] }),
        queryClient.refetchQueries({ queryKey: ["sessions", "upcoming"] }),
        queryClient.refetchQueries({ queryKey: ["friendRequests"] }),
        queryClient.refetchQueries({ queryKey: ["recentTrainees"] }),
        queryClient.refetchQueries({ queryKey: ["recentTrainers"] }),
      ]);
    } finally {
      setPullRefreshing(false);
    }
  }, [queryClient]);

  const openFeature = (id: DashboardRouteId, extra?: Partial<{ bookLessonTrainerId: string }>) => {
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
      queryKey: ["wallet", "balance"],
      queryFn: async () => {
        const { fetchWalletBalance } = await import("../../wallet/walletApi");
        return fetchWalletBalance();
      },
    });
  }, [queryClient]);

  useLayoutEffect(() => {
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
    queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
  }, [queryClient]);

  const handleReject = useCallback(async (requestId: string) => {
    await postRejectFriendRequest(requestId);
    queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
  }, [queryClient]);

  const nowSessions = sessions.filter((s: any) => isSessionInProgress(s));
  const pendingSessions = useMemo(
    () => (isTrainer ? sessions.filter((s: any) => isPendingBooking(s)) : []),
    [sessions, isTrainer]
  );
  const upcomingConfirmed = useMemo(
    () => sessions.filter((s: any) => !isPendingBooking(s)),
    [sessions]
  );
  const coaches = useMemo(() => {
    const map = new Map<string, any>();
    for (const u of onlineUsers) {
      const t = u.trainer_info ?? u;
      if (t?._id && !map.has(String(t._id))) map.set(String(t._id), t);
    }
    return Array.from(map.values());
  }, [onlineUsers]);

  const showEmptyDashboard =
    !loadingSessions &&
    nowSessions.length === 0 &&
    pendingSessions.length === 0 &&
    upcomingConfirmed.length === 0;

  return (
    <>
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
    <ScrollView
      style={[styles.root, { backgroundColor: themeColors.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: space.xl * 2 + insets.bottom }]}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={pullRefreshing}
          onRefresh={onRefresh}
          tintColor={themeColors.brandNavy}
        />
      }
    >
      {/* Header — greeting row (app bar = native header + drawer) */}
      <View style={[styles.header, gutter]}>
        <View>
          <Text style={[styles.greeting, { color: themeColors.headerTitle }]}>
            {t("dashboardHome.greeting", { name })}
          </Text>
          <Text style={styles.roleTag}>{accountType ?? t("menu.member")}</Text>
        </View>
      </View>

      {/* Quick Actions — mirrors website sidebar icons */}
      <View style={[styles.quickRow, gutter]}>
        {isTrainee && (
          <>
            <QuickActionButton
              icon="calendar-outline"
              label={t("dashboardHome.quickSessions")}
              onPress={() => openFeature("upcoming-sessions")}
            />
            <QuickActionButton
              icon="book-outline"
              label={t("dashboardHome.quickBookExpert")}
              onPress={() => openFeature("book-lesson")}
            />
          </>
        )}
        {isTrainer && (
          <>
            <QuickActionButton
              icon="calendar-outline"
              label={t("dashboardHome.quickSchedule")}
              onPress={() => navigation.navigate("Schedule")}
            />
            <QuickActionButton
              icon="time-outline"
              label={t("dashboardHome.quickSessions")}
              onPress={() => openFeature("upcoming-sessions")}
            />
          </>
        )}
        <QuickActionButton
          icon="chatbubbles-outline"
          label={t("dashboardHome.quickChats")}
          onPress={() => navigation.navigate("Chats")}
        />
      </View>

      <View style={[{ paddingTop: space.md }, gutter]}>
        {/* Web: trainer `UserInfoCard` inside `Home-main-Cont` above recent students */}
        {isTrainer && (
          <TrainerProfileSection
            name={name}
            accountType={accountType ?? AccountType.TRAINER}
            profilePicture={(user as any)?.profile_picture}
            showAsOnline={showAsOnline}
            onSettings={() => openShell("settings")}
            onAvailabilityToggle={handleAvailabilityToggle}
          />
        )}
        {isTrainee && (
          <TraineeProfileSection
            name={name}
            accountType={accountType ?? AccountType.TRAINEE}
            profilePicture={(user as any)?.profile_picture}
            onSettings={() => openShell("settings")}
          />
        )}

        {/* Web `NavHomePage` — Recent Friend Requests card */}
        {friendRequests.length > 0 && (
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
              {friendRequests.map((req: any) => (
                <FriendRequestWebTile
                  key={req._id}
                  request={req}
                  onAccept={handleAccept}
                  onReject={handleReject}
                />
              ))}
            </View>
          </HomeMainCont>
        )}

        {/* Coaches Online Now — trainee; tiles use `Trainer-box-1` */}
        {isTrainee && (loadingCoaches || coaches.length > 0) && (
          <HomeMainCont title={t("dashboardHome.coachesOnlineNow")} testID="card trainer-profile-card Home-main-Cont coaches-online">
            {loadingCoaches ? (
              <View style={[styles.loadingRow, { flexDirection: "row", gap: space.sm }]}>
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} width={160} height={180} radius={radii.md} />
                ))}
              </View>
            ) : (
              <FlatList
                horizontal
                nestedScrollEnabled
                data={coaches}
                keyExtractor={(item, i) => item?._id ?? String(i)}
                renderItem={({ item }) => (
                  <CoachCard trainer={item} onView={setProfileTrainer} />
                )}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: space.sm, paddingVertical: 4 }}
              />
            )}
          </HomeMainCont>
        )}

        {/* AI Recommended Trainers */}
        {isTrainee && <AIRecommendedSection onView={setProfileTrainer} />}

        {showEmptyDashboard ? (
          <HomeMainCont testID="home-empty-dashboard">
            <DashboardEmptyWelcome
              onBookLesson={() =>
                isTrainer
                  ? openFeature("upcoming-sessions")
                  : (navigation as { navigate: (name: string) => void }).navigate("Schedule")
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

        {/* Trainer: pending session requests (realtime via socket) */}
        {isTrainer && (loadingSessions || pendingSessions.length > 0) && (
          <SessionListSection
            title={t("dashboardHome.sessionRequests")}
            subtitle={t("dashboardHome.sessionRequestsSub")}
            sessions={pendingSessions}
            accountType={accountType}
            loading={loadingSessions}
            count={pendingSessions.length}
            maxPreview={3}
            seeAllLabel={t("dashboardHome.reviewAllRequests", { count: pendingSessions.length })}
            onSeeAll={() => openFeature("upcoming-sessions")}
            onSessionPress={openSession}
            testID="home-session-requests"
          />
        )}

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

        {/* Recent Users — `recent-users-grid` / `trainer-students-grid` vs `single-row-experts` */}
        {isTrainer && recentTrainees.length > 0 && (
          <HomeMainCont
            title={t("dashboardHome.recentTrainees")}
            testID="card rounded trainer-profile-card Select Recent Student"
          >
            <RecentUsersGrid accountIsTrainer>
              {recentTrainees.map((u: any, i: number) => (
                <View key={`${u._id ?? "t"}-${i}`} style={webHomeStyles.recentUsersGridItemTrainer}>
                  <RecentUserChip user={u} />
                </View>
              ))}
            </RecentUsersGrid>
          </HomeMainCont>
        )}

        {isTrainee && recentTrainers.length > 0 && (
          <HomeMainCont
            title={t("dashboardHome.recentTrainers")}
            testID="card rounded trainer-profile-card Select Recent Student"
          >
            <RecentUsersGrid accountIsTrainer={false}>
              {recentTrainers.map((u: any, i: number) => (
                <RecentUserChip key={`${u._id ?? "e"}-${i}`} user={u} />
              ))}
            </RecentUsersGrid>
          </HomeMainCont>
        )}

        {/* AI Review Analysis — trainer only */}
        {isTrainer && (
          <View style={[{ paddingHorizontal: space.md }]}>
            <ReviewAnalysisCard />
          </View>
        )}

        <LockerHub accountType={accountType} onOpenSurface={openShell} />
      </View>
    </ScrollView>

      <AIFloatingButton onPress={() => setAiOpen(true)} />

      <Modal visible={aiOpen} animationType="slide" onRequestClose={() => setAiOpen(false)}>
        <AIAssistantScreen onClose={() => setAiOpen(false)} />
      </Modal>
    </>
  );
}

