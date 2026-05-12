import React, { useCallback, useLayoutEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
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
import { colors, radii, space } from "../../../theme/tokens";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import {
  fetchOnlineUsers,
  fetchScheduledMeetings,
  fetchFriendRequests,
  fetchRecentTrainees,
  fetchRecentTrainers,
  postAcceptFriendRequest,
  postRejectFriendRequest,
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

const FALLBACK_AVATAR = require("../../../../assets/icon.png");

function Avatar({ uri, name, size = 56 }: { uri?: string; name?: string; size?: number }) {
  const [failed, setFailed] = React.useState(false);
  const url = getS3ImageUrl(uri);
  if (!url || failed) {
    return (
      <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.avatarInitial, { fontSize: size * 0.38 }]}>
          {(name ?? "?")[0]?.toUpperCase()}
        </Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: url }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      onError={() => setFailed(true)}
    />
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
        <View style={[styles.badge, getStatusColor(session.status)]}>
          <Text style={styles.badgeText}>{session.status ?? "upcoming"}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </View>
  );
}

function getStatusColor(status?: string) {
  switch (status) {
    case "confirmed": return { backgroundColor: "#dcfce7" };
    case "completed": return { backgroundColor: "#f3f4f6" };
    case "cancelled": return { backgroundColor: "#fee2e2" };
    default: return { backgroundColor: "#dbeafe" };
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
          style={[styles.friendBtn, { backgroundColor: "#16a34a" }]}
          onPress={() => onAccept(request._id)}
        >
          <Text style={styles.friendBtnText}>Accept</Text>
        </Pressable>
        <Pressable
          style={[styles.friendBtn, { backgroundColor: "#dc2626" }]}
          onPress={() => onReject(request._id)}
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
    >
      <Ionicons name={icon} size={26} color={colors.brandNavy} />
      <Text style={styles.quickBtnText}>{label}</Text>
    </Pressable>
  );
}

export function DashboardHomeScreen({ navigation }: MainTabScreenProps<"Home">) {
  const { user, accountType } = useAuth();
  const queryClient = useQueryClient();
  const isTrainee = accountType === AccountType.TRAINEE;
  const isTrainer = accountType === AccountType.TRAINER;

  const name =
    (user?.fullname as string) ||
    (user?.fullName as string) ||
    (user?.name as string) ||
    "there";

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

  const openFeature = (id: DashboardRouteId) => {
    navigation.navigate("Menu", { screen: "DashboardFeature", params: { featureId: id } });
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
  const coaches = onlineUsers.map((u: any) => u.trainer_info ?? u).filter(Boolean);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={colors.brandNavy}
        />
      }
    >
      {/* Header — greeting row (app bar = native header + drawer) */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {name}</Text>
          <Text style={styles.roleTag}>{accountType ?? "Member"}</Text>
        </View>
      </View>

      {/* Quick Actions — mirrors website sidebar icons */}
      <View style={styles.quickRow}>
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
          icon="cloud-upload-outline"
          label="Uploads"
          onPress={() => openShell("uploads")}
        />
      </View>

      <View style={{ paddingHorizontal: space.md, paddingTop: space.md }}>
        {/* Web: trainer `UserInfoCard` inside `Home-main-Cont` above recent students */}
        {isTrainer && (
          <HomeMainCont
            title="Your profile"
            testID="card trainer-profile-card Home-main-Cont trainer-profile-summary"
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
              <Avatar
                uri={(user as any)?.profile_picture}
                name={name}
                size={64}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: "700", color: "#111827" }}>{name}</Text>
                <Text style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{accountType}</Text>
                <Pressable
                  style={{ marginTop: 10, alignSelf: "flex-start" }}
                  onPress={() => openShell("settings")}
                >
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.sidebarActive }}>
                    Account & settings →
                  </Text>
                </Pressable>
              </View>
            </View>
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
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.brandNavy} />
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
                    onBook={() => openFeature("book-lesson")}
                  />
                )}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: space.sm, paddingVertical: 4 }}
              />
            )}
          </HomeMainCont>
        )}

        {/* Active Sessions */}
        {(loadingSessions || nowSessions.length > 0) && (
          <HomeMainCont title="Active Sessions" testID="card trainer-profile-card Home-main-Cont active-sessions">
            {loadingSessions ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.brandNavy} />
              </View>
            ) : (
              nowSessions.map((session: any) => (
                <SessionCard
                  key={session._id}
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
            {sessions.slice(0, 3).map((session: any) => (
              <SessionCard
                key={session._id}
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
                <View key={u._id ?? i} style={webHomeStyles.recentUsersGridItemTrainer}>
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
                <RecentUserChip key={u._id ?? i} user={u} />
              ))}
            </RecentUsersGrid>
          </HomeMainCont>
        )}

        {/* Web: `UploadClipCard` + `InviteFriendsCard` row */}
        <HomeMainCont title="Locker" testID="card trainer-profile-card Home-main-Cont locker-promos">
          <HomeUploadInviteRow
            onUploads={() => openShell("uploads")}
            onInvite={() => openShell("invite")}
          />
        </HomeMainCont>
      </View>

      {/* More shortcuts */}
      <View style={styles.section}>
        <SectionHeader title="More" />
        <View style={styles.moreGrid}>
          {isTrainer && (
            <Pressable
              style={styles.moreItem}
              onPress={() => openFeature("students")}
            >
              <Ionicons name="people-outline" size={20} color={colors.brandNavy} />
              <Text style={styles.moreItemText}>Students</Text>
            </Pressable>
          )}
          <Pressable style={styles.moreItem} onPress={() => openFeature("my-community")}>
            <Ionicons name="globe-outline" size={20} color={colors.brandNavy} />
            <Text style={styles.moreItemText}>Community</Text>
          </Pressable>
          <Pressable style={styles.moreItem} onPress={() => openFeature("friends")}>
            <Ionicons name="person-add-outline" size={20} color={colors.brandNavy} />
            <Text style={styles.moreItemText}>Friends</Text>
          </Pressable>
          <Pressable style={styles.moreItem} onPress={() => openShell("transactions")}>
            <Ionicons name="wallet-outline" size={20} color={colors.brandNavy} />
            <Text style={styles.moreItemText}>Transactions</Text>
          </Pressable>
          <Pressable style={styles.moreItem} onPress={() => openFeature("meeting-room")}>
            <Ionicons name="videocam-outline" size={20} color={colors.brandNavy} />
            <Text style={styles.moreItemText}>Meeting Room</Text>
          </Pressable>
          <Pressable style={styles.moreItem} onPress={() => openShell("settings")}>
            <Ionicons name="settings-outline" size={20} color={colors.brandNavy} />
            <Text style={styles.moreItemText}>Settings</Text>
          </Pressable>
          <Pressable style={styles.moreItem} onPress={() => openFeature("contact-us")}>
            <Ionicons name="mail-outline" size={20} color={colors.brandNavy} />
            <Text style={styles.moreItemText}>Contact Us</Text>
          </Pressable>
          <Pressable style={styles.moreItem} onPress={() => openFeature("about-us")}>
            <Ionicons name="information-circle-outline" size={20} color={colors.brandNavy} />
            <Text style={styles.moreItemText}>About Us</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
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
  root: { flex: 1, backgroundColor: "#f6f7fb" },
  content: { paddingBottom: space.xl * 2 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.md,
    paddingTop: space.lg,
    paddingBottom: space.md,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  greeting: { fontSize: 20, fontWeight: "700", color: "#111827" },
  roleTag: { fontSize: 13, color: "#6b7280", marginTop: 2 },

  quickRow: {
    flexDirection: "row",
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    gap: space.sm,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
    flexWrap: "wrap",
  },
  quickBtn: {
    flex: 1,
    minWidth: 72,
    alignItems: "center",
    paddingVertical: space.md,
    backgroundColor: "#f0f4ff",
    borderRadius: radii.md,
    gap: space.xs,
  },
  quickBtnPressed: { opacity: 0.8 },
  quickBtnText: { fontSize: 11, fontWeight: "600", color: "#111827", textAlign: "center" },

  section: { marginTop: space.md, backgroundColor: "#fff", paddingVertical: space.md },
  sectionHeader: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.brandNavy,
    paddingHorizontal: space.md,
    marginBottom: space.sm,
  },
  loadingRow: { alignItems: "center", paddingVertical: space.lg },

  coachName: { fontSize: 13, fontWeight: "700", color: "#111827", marginTop: space.xs, textAlign: "center" },
  coachCat: { fontSize: 11, color: "#6b7280", textAlign: "center", marginTop: 2 },
  bookBtn: {
    marginTop: space.sm,
    backgroundColor: colors.brandNavy,
    borderRadius: radii.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 5,
  },
  bookBtnPressed: { opacity: 0.75 },
  bookBtnText: { fontSize: 12, color: "#fff", fontWeight: "600" },

  // Session cards
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
    gap: space.sm,
  },
  sessionInfo: { flex: 1 },
  sessionName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  sessionMeta: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  badge: { alignSelf: "flex-start", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 },
  badgeText: { fontSize: 11, fontWeight: "600", color: "#374151", textTransform: "capitalize" },

  recentChip: { alignItems: "center", width: 68 },
  recentName: { fontSize: 11, color: "#111827", marginTop: 4, textAlign: "center", fontWeight: "500" },

  friendName: { fontSize: 14, fontWeight: "600", color: "#111827" },
  friendActions: { flexDirection: "row", gap: space.sm, marginTop: 6 },
  friendBtn: { borderRadius: radii.sm, paddingHorizontal: space.md, paddingVertical: 5 },
  friendBtnText: { fontSize: 12, color: "#fff", fontWeight: "600" },

  // Avatar fallback
  avatarFallback: {
    backgroundColor: colors.brandNavy,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { color: "#fff", fontWeight: "700" },

  // See all
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: space.sm,
    gap: 4,
  },
  seeAllText: { fontSize: 14, color: colors.brandNavy, fontWeight: "600" },

  // More grid
  moreGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: space.sm },
  moreItem: {
    width: "25%",
    alignItems: "center",
    paddingVertical: space.md,
    gap: 6,
  },
  moreItemText: { fontSize: 11, color: "#111827", fontWeight: "500", textAlign: "center" },
});
