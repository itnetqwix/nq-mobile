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
import { colors, radii, space, typography } from "../../../theme";
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
  onBook,
}: {
  trainer: any;
  onBook: (trainer: any) => void;
}) {
  const name = trainer?.fullname || trainer?.fullName || "Coach";
  const cats = trainer?.categories?.slice(0, 2).join(", ") ?? "";
  return (
    <TrainerBoxCard style={{ width: 132, flexShrink: 0 }}>
      <Avatar uri={trainer?.profile_picture} name={name} size={70} />
      <Text style={styles.coachName} numberOfLines={1}>{name}</Text>
      {!!cats && <Text style={styles.coachCat} numberOfLines={1}>{cats}</Text>}
      <Pressable
        style={({ pressed }) => [styles.bookBtn, pressed && styles.bookBtnPressed]}
        onPress={() => onBook(trainer)}
        accessibilityRole="button"
        accessibilityLabel={`Book session with ${trainer?.fullname ?? "trainer"}`}
      >
        <Text style={styles.bookBtnText}>Book Now</Text>
      </Pressable>
    </TrainerBoxCard>
  );
}

function SessionCard({ session, accountType }: { session: any; accountType: string | null }) {
  const isTrainer = accountType === AccountType.TRAINER;
  const other = isTrainer ? session.trainee_info : session.trainer_info;
  const name = other?.fullname || other?.fullName || "Unknown";
  const date = session.booked_date ?? "";
  const time = session.start_time && session.end_time
    ? `${session.start_time} – ${session.end_time}`
    : "";

  return (
    <View style={styles.sessionCard}>
      <Avatar uri={other?.profile_picture} name={name} size={52} />
      <View style={styles.sessionInfo}>
        <Text style={styles.sessionName}>{name}</Text>
        {!!date && <Text style={styles.sessionMeta}>{date}</Text>}
        {!!time && <Text style={styles.sessionMeta}>{time}</Text>}
        <Pill
          label={session.status ?? "upcoming"}
          tone={getStatusTone(session.status)}
          style={{ marginTop: 4 }}
        />
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </View>
  );
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
          style={[styles.friendBtn, { backgroundColor: colors.success }]}
          onPress={() => onAccept(request._id)}
          accessibilityRole="button"
          accessibilityLabel={`Accept friend request from ${name}`}
        >
          <Text style={styles.friendBtnText}>Accept</Text>
        </Pressable>
        <Pressable
          style={[styles.friendBtn, { backgroundColor: colors.danger }]}
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
      <Ionicons name={icon} size={26} color={colors.brandNavy} />
      <Text style={styles.quickBtnText}>{label}</Text>
    </Pressable>
  );
}

function AIRecommendedSection({ onBook }: { onBook: (t: any) => void }) {
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
          <TrainerBoxCard style={{ width: 150, flexShrink: 0 }}>
            <Avatar uri={item.trainer?.profile_picture} name={item.trainer?.fullname} size={60} />
            <Text style={styles.coachName} numberOfLines={1}>{item.trainer?.fullname || "Coach"}</Text>
            <Text style={[styles.coachCat, { fontSize: 11 }]} numberOfLines={1}>
              {item.trainer?.category || ""}
            </Text>
            <Text style={{ fontSize: 10, color: colors.textMuted, textAlign: "center", marginTop: 2 }} numberOfLines={2}>
              {item.reason || ""}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: 2 }}>
              <Ionicons name="star" size={12} color="#f59e0b" />
              <Text style={{ fontSize: 11, color: colors.text, fontWeight: "600" }}>
                {item.trainer?.avgRating || "New"}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.bookBtn, pressed && styles.bookBtnPressed]}
              onPress={() => onBook(item.trainer)}
            >
              <Text style={styles.bookBtnText}>Book Now</Text>
            </Pressable>
          </TrainerBoxCard>
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space.sm, paddingVertical: 4 }}
      />
    </HomeMainCont>
  );
}

export function DashboardHomeScreen({ navigation }: MainTabScreenProps<"Home">) {
  const [aiOpen, setAiOpen] = useState(false);
  const { user, accountType, refreshUser, patchUser } = useAuth();
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
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() =>
            navigation.navigate("Menu", {
              screen: "ShellSurface",
              params: { surfaceId: "notifications" },
            })
          }
          hitSlop={12}
          style={{ marginRight: 10, padding: 4 }}
        >
          <Ionicons name="notifications-outline" size={24} color={colors.brandNavy} />
        </Pressable>
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
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: space.xl * 2 + insets.bottom }]}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={colors.brandNavy}
        />
      }
    >
      {/* Header — greeting row (app bar = native header + drawer) */}
      <View style={[styles.header, gutter]}>
        <View>
          <Text style={styles.greeting}>Hello, {name}</Text>
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
                <Text style={{ ...typography.titleSm, color: colors.text }}>{name}</Text>
                <Text style={{ ...typography.bodySm, color: colors.textMuted, marginTop: 4 }}>
                  {accountType}
                </Text>
                <Pressable
                  style={styles.settingsLink}
                  onPress={() => openShell("settings")}
                >
                  <Text style={styles.settingsLinkText}>Account & settings</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.sidebarActive} />
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
                  <CoachCard
                    trainer={item}
                    onBook={(t) =>
                      t?._id != null
                        ? openFeature("book-lesson", { bookLessonTrainerId: String(t._id) })
                        : openFeature("book-lesson")
                    }
                  />
                )}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: space.sm, paddingVertical: 4 }}
              />
            )}
          </HomeMainCont>
        )}

        {/* AI Recommended Trainers */}
        {isTrainee && <AIRecommendedSection onBook={(t: any) =>
          t?._id != null
            ? openFeature("book-lesson", { bookLessonTrainerId: String(t._id) })
            : openFeature("book-lesson")
        } />}

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
                />
              ))
            )}
          </HomeMainCont>
        )}

        {/* Upcoming Sessions (next 3) */}
        {sessions.length > 0 && nowSessions.length === 0 && (
          <HomeMainCont title="Upcoming Sessions" testID="card trainer-profile-card Home-main-Cont upcoming-sessions">
            {sessions.slice(0, 3).map((session: any, idx: number) => (
              <SessionCard
                key={`${session._id}-up-${idx}`}
                session={session}
                accountType={accountType}
              />
            ))}
            {sessions.length > 3 && (
              <Pressable
                style={styles.seeAllBtn}
                onPress={() => openFeature("upcoming-sessions")}
              >
                <Text style={styles.seeAllText}>See all {sessions.length} sessions</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.brandNavy} />
              </Pressable>
            )}
          </HomeMainCont>
        )}

        {/* Recent Users — `recent-users-grid` / `trainer-students-grid` vs `single-row-experts` */}
        {isTrainer && recentTrainees.length > 0 && (
          <HomeMainCont
            title="Recent Students"
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: {},

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: space.lg,
    paddingBottom: space.md,
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  greeting: { ...typography.titleMd, color: colors.text },
  roleTag: { ...typography.bodySm, color: colors.textMuted, marginTop: 2 },
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
    color: colors.sidebarActive,
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
    borderColor: colors.surfaceElevated,
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
    borderColor: colors.surfaceElevated,
  },

  quickRow: {
    flexDirection: "row",
    paddingVertical: space.md,
    gap: space.sm,
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    flexWrap: "wrap",
  },
  quickBtn: {
    flex: 1,
    minWidth: 72,
    alignItems: "center",
    paddingVertical: space.md,
    backgroundColor: colors.brandSubtle,
    borderRadius: radii.md,
    gap: space.xs,
  },
  quickBtnPressed: { opacity: 0.8 },
  quickBtnText: { ...typography.label, color: colors.text, textAlign: "center", fontSize: 11 },

  section: { marginTop: space.md, backgroundColor: colors.surfaceElevated, paddingVertical: space.md },
  sectionHeader: {
    ...typography.titleSm,
    color: colors.brandNavy,
    paddingHorizontal: space.md,
    marginBottom: space.sm,
  },
  loadingRow: { alignItems: "center", paddingVertical: space.lg },

  coachName: {
    ...typography.label,
    color: colors.text,
    marginTop: space.xs,
    textAlign: "center",
  },
  coachCat: { ...typography.caption, color: colors.textMuted, textAlign: "center", marginTop: 2 },
  bookBtn: {
    marginTop: space.sm,
    backgroundColor: colors.brandNavy,
    borderRadius: radii.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 5,
  },
  bookBtnPressed: { opacity: 0.75 },
  bookBtnText: { fontSize: 12, color: colors.brandTextOn, fontWeight: "600" },

  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: space.sm,
  },
  sessionInfo: { flex: 1 },
  sessionName: { ...typography.subtitle, color: colors.text },
  sessionMeta: { ...typography.bodySm, color: colors.textMuted, marginTop: 2 },

  recentChip: { alignItems: "center", width: 68 },
  recentName: {
    fontSize: 11,
    color: colors.text,
    marginTop: 4,
    textAlign: "center",
    fontWeight: "500",
  },

  friendName: { ...typography.label, color: colors.text, fontSize: 14 },
  friendActions: { flexDirection: "row", gap: space.sm, marginTop: 6 },
  friendBtn: { borderRadius: radii.sm, paddingHorizontal: space.md, paddingVertical: 5 },
  friendBtnText: { fontSize: 12, color: colors.brandTextOn, fontWeight: "600" },

  avatarFallback: {
    backgroundColor: colors.brandNavy,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { color: colors.brandTextOn, fontWeight: "700" },

  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: space.sm,
    gap: 4,
  },
  seeAllText: { fontSize: 14, color: colors.brandNavy, fontWeight: "600" },

});
