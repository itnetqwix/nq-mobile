import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../auth/context/AuthContext";
import { AccountType } from "../../../constants/accountType";
import { colors, radii, space } from "../../../theme/tokens";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { fetchScheduledMeetings } from "../../home/api/homeApi";
import type { RootStackParamList } from "../../../navigation/types";

const NAVY = "#000080";

const STATUS_TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "confirmed", label: "Confirmed" },
  { key: "completed", label: "Completed" },
] as const;

type StatusTab = (typeof STATUS_TABS)[number]["key"];

function Avatar({ uri, name, size = 52 }: { uri?: string; name?: string; size?: number }) {
  const [failed, setFailed] = React.useState(false);
  const url = getS3ImageUrl(uri);
  if (!url || failed) {
    return (
      <View
        style={[
          styles.avatarFallback,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
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

function StatusBadge({ status }: { status?: string }) {
  const colors = getBadgeColors(status);
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.badgeText, { color: colors.text }]}>
        {(status ?? "upcoming").charAt(0).toUpperCase() + (status ?? "upcoming").slice(1)}
      </Text>
    </View>
  );
}

function getBadgeColors(status?: string) {
  switch (status) {
    case "confirmed": return { bg: "#dcfce7", text: "#15803d" };
    case "completed": return { bg: "#f3f4f6", text: "#374151" };
    case "cancelled": return { bg: "#fee2e2", text: "#b91c1c" };
    default: return { bg: "#dbeafe", text: "#1d4ed8" };
  }
}

function SessionCard({ session, accountType }: { session: any; accountType: string | null }) {
  const isTrainer = accountType === AccountType.TRAINER;
  const other = isTrainer ? session.trainee_info : session.trainer_info;
  const name = other?.fullname || other?.fullName || "Unknown";
  const theirRole = isTrainer ? "Student" : "Trainer";
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const date = session.booked_date ?? "";
  const time =
    session.start_time && session.end_time
      ? `${session.start_time} – ${session.end_time}`
      : "";

  const handleJoin = () => {
    const lessonId = session._id ?? session.id;
    if (lessonId) navigation.navigate("Meeting", { lessonId });
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Avatar uri={other?.profile_picture} name={name} size={56} />
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{name}</Text>
          <Text style={styles.cardRole}>{theirRole}</Text>
          {!!date && (
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={13} color="#6b7280" />
              <Text style={styles.metaText}>{date}</Text>
            </View>
          )}
          {!!time && (
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={13} color="#6b7280" />
              <Text style={styles.metaText}>{time}</Text>
            </View>
          )}
        </View>
        <StatusBadge status={session.status} />
      </View>

      {session.category && (
        <View style={styles.categoryRow}>
          <Ionicons name="bookmark-outline" size={13} color="#6b7280" />
          <Text style={styles.categoryText}>{session.category}</Text>
        </View>
      )}

      {(session.status === "upcoming" || session.status === "confirmed") ? (
        <View style={styles.cardFooter}>
          <Pressable
            style={({ pressed }) => [styles.joinBtn, pressed && { opacity: 0.8 }]}
            onPress={handleJoin}
          >
            <Ionicons name="videocam-outline" size={16} color="#fff" />
            <Text style={styles.joinBtnText}>Join Session</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function UpcomingSessionsScreen() {
  const { accountType } = useAuth();
  const [activeTab, setActiveTab] = useState<StatusTab>("upcoming");
  const queryClient = useQueryClient();

  const { data: sessions = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["sessions", activeTab],
    queryFn: () => fetchScheduledMeetings(activeTab),
    staleTime: 60_000,
  });

  return (
    <View style={styles.root}>
      {/* Status Tabs */}
      <View style={styles.tabs}>
        {STATUS_TABS.map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={NAVY} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={NAVY}
            />
          }
        >
          {sessions.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyTitle}>No {activeTab} sessions</Text>
              <Text style={styles.emptyBody}>
                {activeTab === "upcoming"
                  ? "Your booked sessions will appear here."
                  : `No ${activeTab} sessions found.`}
              </Text>
            </View>
          ) : (
            sessions.map((session: any) => (
              <SessionCard
                key={session._id}
                session={session}
                accountType={accountType}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f6f7fb" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  tabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  tab: {
    flex: 1,
    paddingVertical: space.md,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: NAVY },
  tabText: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  tabTextActive: { color: NAVY },

  list: { padding: space.md, gap: space.sm, paddingBottom: space.xl },

  card: {
    backgroundColor: "#fff",
    borderRadius: radii.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  cardRole: { fontSize: 12, color: "#6b7280", marginTop: 2, marginBottom: space.xs },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  metaText: { fontSize: 13, color: "#6b7280" },

  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: space.sm,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#f3f4f6",
  },
  categoryText: { fontSize: 12, color: "#6b7280" },

  badge: {
    alignSelf: "flex-start",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },

  cardFooter: {
    marginTop: space.sm,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#f3f4f6",
    alignItems: "flex-end",
  },
  joinBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: NAVY,
    borderRadius: radii.sm,
    paddingHorizontal: space.md,
    paddingVertical: 8,
  },
  joinBtnText: { fontSize: 13, color: "#fff", fontWeight: "600" },

  avatarFallback: {
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { color: "#fff", fontWeight: "700" },

  empty: {
    alignItems: "center",
    paddingVertical: space.xl * 2,
    gap: space.sm,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#374151" },
  emptyBody: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20 },
});
