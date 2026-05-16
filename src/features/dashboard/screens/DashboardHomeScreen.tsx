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
import { Pill, Skeleton, ImageWithSkeleton } from "../../../components/ui";
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
import type { MainTabScreenProps } from "../../../navigation/types";
import type { DashboardRouteId } from "../config/dashboardRoutes";
import type { ShellSurfaceRouteId } from "../../../navigation/types";
import {
  HomeMainCont,
  HomeUploadInviteRow,
  RecentUsersGrid,
  TrainerBoxCard,
  webHomeStyles,
} from "../components/webHome";
import AIFloatingButton from "../../ai/AIFloatingButton";
import AIAssistantScreen from "../../ai/AIAssistantScreen";
import ReviewAnalysisCard from "../../ai/ReviewAnalysisCard";
import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { TrainerOnlineToggle } from "../components/TrainerOnlineToggle";
import { useSessionBooking } from "../../sessions/SessionBookingContext";
import { isPendingBooking, normalizeSessionStatus } from "../../../lib/sessions/sessionUtils";
import { TrainerProfileModal } from "../../bookexpert/components/TrainerProfileModal";
import { InstantLessonBookingWizardModal } from "../../instant-lesson/booking-wizard";
import { ScheduledBookingModal } from "../../bookings/screens/ScheduledBookingModal";
import { getTrainerCategories } from "../../bookexpert/lib/trainerUtils";

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
        accessibilityLabel={name ? `Photo of ${name}` : "Profile photo"}
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
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function CoachCard({
  trainer,
  onView,
}: {
  trainer: any;
  onView: (trainer: any) => void;
}) {
  const name = trainer?.fullname || trainer?.fullName || "Coach";
  const cats = getTrainerCategories(trainer).slice(0, 2).join(", ");
  return (
    <Pressable
      style={({ pressed }) => [pressed && { opacity: 0.9 }]}
      onPress={() => onView(trainer)}
      accessibilityRole="button"
      accessibilityLabel={`View coach ${name}`}
    >
      <TrainerBoxCard style={{ width: 132, flexShrink: 0 }}>
        <Avatar uri={trainer?.profile_picture} name={name} size={70} onlineStatus="online" />
        <Text style={styles.coachName} numberOfLines={1}>{name}</Text>
        {!!cats && <Text style={styles.coachCat} numberOfLines={1}>{cats}</Text>}
        <View style={styles.bookBtn}>
          <Text style={styles.bookBtnText}>View profile</Text>
        </View>
      </TrainerBoxCard>
    </Pressable>
  );
}

function SessionCard({
  session,
  accountType,
  onPress,
}: {
  session: any;
  accountType: string | null;
  onPress?: () => void;
}) {
  const isTrainer = accountType === AccountType.TRAINER;
  const other = isTrainer ? session.trainee_info : session.trainer_info;
  const name = other?.fullname || other?.fullName || "Unknown";
  const date = session.booked_date ?? "";
  const time =
    session.session_start_time && session.session_end_time
      ? `${session.session_start_time} – ${session.session_end_time}`
      : session.start_time && session.end_time
        ? `${session.start_time} – ${session.end_time}`
        : "";
  const pending = isPendingBooking(session);
  const status = normalizeSessionStatus(session.status);

  const inner = (
    <>
      <Avatar uri={other?.profile_picture} name={name} size={52} />
      <View style={styles.sessionInfo}>
        <Text style={styles.sessionName}>{name}</Text>
        {!!date && <Text style={styles.sessionMeta}>{String(date).slice(0, 10)}</Text>}
        {!!time && <Text style={styles.sessionMeta}>{time}</Text>}
        <Pill
          label={pending ? "Needs confirmation" : status}
          tone={pending ? "warning" : getStatusTone(status)}
          style={{ marginTop: 4 }}
        />
      </View>
      <Ionicons name="chevron-forward" size={18} color={themeColors.textMuted} />
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [styles.sessionCard, pressed && { opacity: 0.85 }]}
        onPress={onPress}
        accessibilityRole="button"
      >
        {inner}
      </Pressable>
    );
  }

  return <View style={styles.sessionCard}>{inner}</View>;
}

function getStatusTone(status?: string): React.ComponentProps<typeof Pill>["tone"] {
  switch (status) {
    case "confirmed":
      return "success";
    case "completed":
      return "neutral";
    case "cancelled":
      return "danger";
    default:
      return "info";
  }
}

function RecentUserChip({ user, label }: { user: any; label?: string }) {
  const name = user?.fullname || user?.fullName || label || "User";
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
  const sender = request?.senderId;
  const name = sender?.fullname || sender?.fullName || "User";
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
          accessibilityLabel={`Accept friend request from ${name}`}
        >
          <Text style={styles.friendBtnText}>Accept</Text>
        </Pressable>
        <Pressable
          style={[styles.friendBtn, { backgroundColor: themeColors.danger }]}
          onPress={() => onReject(request._id)}
          accessibilityRole="button"
          accessibilityLabel={`Reject friend request from ${name}`}
        >
          <Text style={styles.friendBtnText}>Reject</Text>
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
      <HomeMainCont title="Recommended For You ✨" testID="card ai-recommended">
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
    <HomeMainCont title="Recommended For You ✨" testID="card ai-recommended">
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
              <Text style={styles.coachName} numberOfLines={1}>{item.trainer?.fullname || "Coach"}</Text>
              <Text style={[styles.coachCat, { fontSize: 11 }]} numberOfLines={1}>
                {item.trainer?.category || ""}
              </Text>
              <Text style={{ fontSize: 10, color: themeColors.textMuted, textAlign: "center", marginTop: 2 }} numberOfLines={2}>
                {item.reason || ""}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: 2 }}>
                <Ionicons name="star" size={12} color="#f59e0b" />
                <Text style={{ fontSize: 11, color: themeColors.text, fontWeight: "600" }}>
                  {item.trainer?.avgRating || "New"}
                </Text>
              </View>
              <View style={styles.bookBtn}>
                <Text style={styles.bookBtnText}>View profile</Text>
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

export function DashboardHomeScreen({ navigation }: MainTabScreenProps<"Home">) {
  const themeColors = useThemeColors();
  const styles = useThemedStyles((palette) => StyleSheet.create({
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
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  profileMeta: {
    flex: 1,
    minWidth: 0,
  },
  settingsLink: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    alignSelf: "flex-start",
    gap: 2,
  },
  settingsLinkText: {
    ...typography.bodyMd,
    fontWeight: "600",
    color: palette.sidebarActive,
  },
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

  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
    gap: space.sm,
  },
  sessionInfo: { flex: 1 },
  sessionName: { ...typography.subtitle, color: palette.text },
  sessionMeta: { ...typography.bodySm, color: palette.textMuted, marginTop: 2 },

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

  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: space.sm,
    gap: 4,
  },
  seeAllText: { fontSize: 14, color: palette.brandNavy, fontWeight: "600" },

});
  const [aiOpen, setAiOpen] = useState(false);
  const [profileTrainer, setProfileTrainer] = useState<Record<string, unknown> | null>(null);
  const [wizardTrainer, setWizardTrainer] = useState<Record<string, unknown> | null>(null);
  const [scheduleTrainer, setScheduleTrainer] = useState<Record<string, unknown> | null>(null);
  const { user, accountType, refreshUser, patchUser } = useAuth();
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
    "there";

  const handleAvailabilityToggle = useCallback(
    async (next: boolean) => {
      const confirmed = await setOnlineAvailability(next);
      patchUser({ showAsOnline: confirmed });
      await refreshUser();
      await queryClient.invalidateQueries({ queryKey: ["onlineUsers"] });
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    [patchUser, refreshUser, queryClient]
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

  const isRefreshing =
    queryClient.isFetching({ queryKey: ["onlineUsers"] }) > 0 ||
    queryClient.isFetching({ queryKey: ["sessions", "upcoming"] }) > 0;

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["onlineUsers"] });
    queryClient.invalidateQueries({ queryKey: ["sessions", "upcoming"] });
    queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
    queryClient.invalidateQueries({ queryKey: ["recentTrainees"] });
    queryClient.invalidateQueries({ queryKey: ["recentTrainers"] });
  }, [queryClient]);

  const openFeature = (id: DashboardRouteId, extra?: Partial<{ bookLessonTrainerId: string }>) => {
    navigation.navigate("Menu", {
      screen: "DashboardFeature",
      params: { featureId: id, ...extra },
    });
  };

  const openShell = (id: ShellSurfaceRouteId) => {
    navigation.navigate("Menu", { screen: "ShellSurface", params: { surfaceId: id } });
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
            accessibilityLabel="Wallet"
            accessibilityRole="button"
          >
            <Ionicons name="wallet-outline" size={24} color={themeColors.brandNavy} />
          </Pressable>
          <Pressable
            onPress={() => openShell("notifications")}
            hitSlop={12}
            style={{ padding: 4, marginLeft: 4 }}
            accessibilityLabel="Notifications"
            accessibilityRole="button"
          >
            <Ionicons name="notifications-outline" size={24} color={themeColors.brandNavy} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation]);

  const handleAccept = useCallback(async (requestId: string) => {
    await postAcceptFriendRequest(requestId);
    queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
  }, [queryClient]);

  const handleReject = useCallback(async (requestId: string) => {
    await postRejectFriendRequest(requestId);
    queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
  }, [queryClient]);

  const nowSessions = sessions.filter((s: any) => isSessionLiveNow(s));
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

  return (
    <>
      <InstantLessonBookingWizardModal
        visible={!!wizardTrainer}
        trainer={wizardTrainer}
        onDismiss={() => setWizardTrainer(null)}
      />
      <ScheduledBookingModal
        visible={!!scheduleTrainer}
        trainer={scheduleTrainer}
        onDismiss={() => setScheduleTrainer(null)}
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
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={themeColors.brandNavy}
        />
      }
    >
      {/* Header — greeting row (app bar = native header + drawer) */}
      <View style={[styles.header, gutter]}>
        <View>
          <Text style={[styles.greeting, { color: themeColors.headerTitle }]}>Hello, {name}</Text>
          <Text style={styles.roleTag}>{accountType ?? "Member"}</Text>
        </View>
      </View>

      {/* Quick Actions — mirrors website sidebar icons */}
      <View style={[styles.quickRow, gutter]}>
        {isTrainee && (
          <>
            <QuickActionButton
              icon="calendar-outline"
              label="Sessions"
              onPress={() => openFeature("upcoming-sessions")}
            />
            <QuickActionButton
              icon="book-outline"
              label="Book Expert"
              onPress={() => openFeature("book-lesson")}
            />
          </>
        )}
        {isTrainer && (
          <>
            <QuickActionButton
              icon="calendar-outline"
              label="Schedule"
              onPress={() => navigation.navigate("Schedule")}
            />
            <QuickActionButton
              icon="time-outline"
              label="Sessions"
              onPress={() => openFeature("upcoming-sessions")}
            />
          </>
        )}
        <QuickActionButton
          icon="chatbubbles-outline"
          label="Chats"
          onPress={() => navigation.navigate("Chats")}
        />
        <QuickActionButton
          icon="film-outline"
          label="Clips"
          onPress={() => openShell("clips")}
        />
      </View>

      <View style={[{ paddingTop: space.md }, gutter]}>
        {/* Web: trainer `UserInfoCard` inside `Home-main-Cont` above recent students */}
        {isTrainer && (
          <HomeMainCont
            title="Your profile"
            testID="card trainer-profile-card Home-main-Cont trainer-profile-summary"
          >
            <View style={styles.profileRow}>
              <Avatar
                uri={(user as any)?.profile_picture}
                name={name}
                size={64}
                onlineStatus={showAsOnline ? "online" : "offline"}
              />
              <View style={styles.profileMeta}>
                <Text style={{ ...typography.titleSm, color: themeColors.text }}>{name}</Text>
                <Text style={{ ...typography.bodySm, color: themeColors.textMuted, marginTop: 4 }}>
                  {accountType}
                </Text>
                <Pressable
                  style={styles.settingsLink}
                  onPress={() => openShell("settings")}
                >
                  <Text style={styles.settingsLinkText}>Account & settings</Text>
                  <Ionicons name="chevron-forward" size={16} color={themeColors.sidebarActive} />
                </Pressable>
              </View>
            </View>
            <TrainerOnlineToggle
              value={showAsOnline}
              onToggle={handleAvailabilityToggle}
            />
          </HomeMainCont>
        )}

        {/* Web `NavHomePage` — Recent Friend Requests card */}
        {friendRequests.length > 0 && (
          <HomeMainCont
            title="Recent Friend Requests"
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
          <HomeMainCont title="Coaches Online Now" testID="card trainer-profile-card Home-main-Cont coaches-online">
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

        {/* Trainer: pending session requests (realtime via socket) */}
        {isTrainer && (loadingSessions || pendingSessions.length > 0) && (
          <HomeMainCont
            title={
              pendingSessions.length > 0
                ? `Session requests (${pendingSessions.length})`
                : "Session requests"
            }
            testID="card trainer-profile-card Home-main-Cont session-requests"
          >
            {loadingSessions ? (
              <View style={[styles.loadingRow, { gap: space.sm }]}>
                <Skeleton width="100%" height={80} radius={radii.md} />
              </View>
            ) : (
              <>
                {pendingSessions.slice(0, 3).map((session: any, idx: number) => (
                  <SessionCard
                    key={`${session._id}-pending-${idx}`}
                    session={session}
                    accountType={accountType}
                    onPress={() => openSession(session)}
                  />
                ))}
                {pendingSessions.length > 3 ? (
                  <Pressable
                    style={styles.seeAllBtn}
                    onPress={() => openFeature("upcoming-sessions")}
                  >
                    <Text style={styles.seeAllText}>
                      Review all {pendingSessions.length} requests
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={themeColors.brandNavy} />
                  </Pressable>
                ) : null}
              </>
            )}
          </HomeMainCont>
        )}

        {/* Active Sessions */}
        {(loadingSessions || nowSessions.length > 0) && (
          <HomeMainCont title="Active Sessions" testID="card trainer-profile-card Home-main-Cont active-sessions">
            {loadingSessions ? (
              <View style={[styles.loadingRow, { gap: space.sm }]}>
                {[0, 1].map((i) => (
                  <Skeleton key={i} width="100%" height={80} radius={radii.md} />
                ))}
              </View>
            ) : (
              nowSessions.map((session: any, idx: number) => (
                <SessionCard
                  key={`${session._id}-now-${idx}`}
                  session={session}
                  accountType={accountType}
                  onPress={() => openSession(session)}
                />
              ))
            )}
          </HomeMainCont>
        )}

        {/* Upcoming Sessions (next 3) */}
        {upcomingConfirmed.length > 0 && nowSessions.length === 0 && (
          <HomeMainCont title="Upcoming Sessions" testID="card trainer-profile-card Home-main-Cont upcoming-sessions">
            {upcomingConfirmed.slice(0, 3).map((session: any, idx: number) => (
              <SessionCard
                key={`${session._id}-up-${idx}`}
                session={session}
                accountType={accountType}
                onPress={() => openSession(session)}
              />
            ))}
            {upcomingConfirmed.length > 3 && (
              <Pressable
                style={styles.seeAllBtn}
                onPress={() => openFeature("upcoming-sessions")}
              >
                <Text style={styles.seeAllText}>
                  See all {upcomingConfirmed.length} sessions
                </Text>
                <Ionicons name="chevron-forward" size={16} color={themeColors.brandNavy} />
              </Pressable>
            )}
          </HomeMainCont>
        )}

        {/* Recent Users — `recent-users-grid` / `trainer-students-grid` vs `single-row-experts` */}
        {isTrainer && recentTrainees.length > 0 && (
          <HomeMainCont
            title="Recent Trainees"
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
            title="Recent Trainers"
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

        {/* Web: `UploadClipCard` + `InviteFriendsCard` row */}
        <HomeMainCont title="Locker" testID="card trainer-profile-card Home-main-Cont locker-promos">
          <HomeUploadInviteRow
            onClips={() => openShell("clips")}
            onInvite={() => openShell("invite")}
          />
        </HomeMainCont>
      </View>
    </ScrollView>

      <AIFloatingButton onPress={() => setAiOpen(true)} />

      <Modal visible={aiOpen} animationType="slide" onRequestClose={() => setAiOpen(false)}>
        <AIAssistantScreen onClose={() => setAiOpen(false)} />
      </Modal>
    </>
  );
}

function isSessionLiveNow(session: any): boolean {
  if (!session?.booked_date || !session?.start_time || !session?.end_time) return false;
  try {
    const now = new Date();
    const [sh, sm] = session.start_time.split(":").map(Number);
    const [eh, em] = session.end_time.split(":").map(Number);
    const [dy, dm, dd] = session.booked_date.split("-").map(Number);

    const start = new Date(dy, dm - 1, dd, sh, sm);
    const end = new Date(dy, dm - 1, dd, eh, em);

    if (start > end) end.setDate(end.getDate() + 1);

    return now >= start && now <= end;
  } catch {
    return false;
  }
}


