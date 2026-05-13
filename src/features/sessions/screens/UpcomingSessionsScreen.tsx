import React, { useEffect, useMemo, useState } from "react";
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
import { Button, Card, EmptyState, Pill, Skeleton, Stack } from "../../../components/ui";
import { colors, radii, space, typography } from "../../../theme";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { fetchScheduledMeetings } from "../../home/api/homeApi";
import type { RootStackParamList } from "../../../navigation/types";

/**
 * Instant lessons must be joined within 1 hour of being booked. After that we hide them
 * from the Upcoming / Confirmed tabs and the trainee can't join (web parity for the
 * "lesson is no longer available" auto-expiry). Scheduled sessions are unaffected.
 */
const INSTANT_LESSON_JOIN_WINDOW_MS = 60 * 60 * 1000;

function isInstantLesson(session: any): boolean {
  if (typeof session?.is_instant === "boolean") return session.is_instant;
  /** Defensive heuristic for legacy rows that pre-date the `is_instant` field. */
  return !session?.time_zone && !session?.start_time && !session?.end_time;
}

function isInstantLessonExpired(session: any, nowMs: number): boolean {
  if (!isInstantLesson(session)) return false;
  const bookedAt = session?.booked_date ? new Date(session.booked_date).getTime() : NaN;
  if (!Number.isFinite(bookedAt)) return false;
  return nowMs - bookedAt > INSTANT_LESSON_JOIN_WINDOW_MS;
}

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
  const label = (status ?? "upcoming").charAt(0).toUpperCase() + (status ?? "upcoming").slice(1);
  return <Pill label={label} tone={getBadgeTone(status)} />;
}

function getBadgeTone(status?: string): React.ComponentProps<typeof Pill>["tone"] {
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

function SessionCard({ session, accountType }: { session: any; accountType: string | null }) {
  const isTrainer = accountType === AccountType.TRAINER;
  const other = isTrainer ? session.trainee_info : session.trainer_info;
  const name = other?.fullname || other?.fullName || "Unknown";
  const theirRole = isTrainer ? "Student" : "Trainer";
  const instant = isInstantLesson(session);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const date = session.booked_date ?? "";
  const time =
    session.start_time && session.end_time
      ? `${session.start_time} – ${session.end_time}`
      : instant && session.session_start_time && session.session_end_time
        ? `${session.session_start_time} – ${session.session_end_time}`
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
              <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
              <Text style={styles.metaText}>{date}</Text>
            </View>
          )}
          {!!time && (
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={13} color={colors.textMuted} />
              <Text style={styles.metaText}>{time}</Text>
            </View>
          )}
        </View>
        <StatusBadge status={session.status} />
      </View>

      {(session.category || instant) && (
        <View style={styles.categoryRow}>
          {instant ? (
            <>
              <Ionicons name="flash" size={13} color={colors.brandAccent} />
              <Text style={[styles.categoryText, { color: colors.brandAccent, fontWeight: "700" }]}>
                Instant lesson
              </Text>
              {!!session.category && (
                <Text style={styles.categoryText}>· {session.category}</Text>
              )}
            </>
          ) : (
            <>
              <Ionicons name="bookmark-outline" size={13} color={colors.textMuted} />
              <Text style={styles.categoryText}>{session.category}</Text>
            </>
          )}
        </View>
      )}

      {(session.status === "upcoming" || session.status === "confirmed") ? (
        <View style={styles.cardFooter}>
          <Button
            label="Join Session"
            leftIcon="videocam-outline"
            onPress={handleJoin}
            size="md"
            fullWidth={false}
          />
        </View>
      ) : null}
    </View>
  );
}

export function UpcomingSessionsScreen() {
  const { accountType } = useAuth();
  const [activeTab, setActiveTab] = useState<StatusTab>("upcoming");
  const queryClient = useQueryClient();

  const { data: rawSessions = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["sessions", activeTab],
    queryFn: () => fetchScheduledMeetings(activeTab),
    staleTime: 60_000,
  });

  /**
   * Tick every 30 s while the screen is mounted so any instant lesson that crosses the
   * 1-hour join window disappears without needing a manual refresh.
   */
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const sessions = useMemo(() => {
    const nowMs = Date.now();
    /** Hide expired instant lessons from Upcoming + Confirmed; keep Completed/historical as-is. */
    if (activeTab === "completed") return rawSessions;
    return rawSessions.filter((s: any) => !isInstantLessonExpired(s, nowMs));
  }, [rawSessions, activeTab]);

  /** Silently refresh the cache when expired rows are filtered, so the count is honest after refresh. */
  useEffect(() => {
    if (rawSessions.length !== sessions.length) {
      queryClient.invalidateQueries({ queryKey: ["sessions", activeTab] });
    }
  }, [rawSessions.length, sessions.length, queryClient, activeTab]);

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
        <Stack gap="sm" style={styles.list}>
          {[0, 1, 2].map((i) => (
            <Card key={i} variant="outlined" padding="md">
              <Stack gap="xs">
                <Skeleton width="60%" height={14} />
                <Skeleton width="40%" height={12} />
                <Skeleton width="80%" height={12} />
                <Skeleton width="30%" height={32} radius={radii.sm} />
              </Stack>
            </Card>
          ))}
        </Stack>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.brand}
            />
          }
        >
          {sessions.length === 0 ? (
            <EmptyState
              icon="calendar-outline"
              title={`No ${activeTab} sessions`}
              description={
                activeTab === "upcoming"
                  ? "Your booked sessions will appear here."
                  : `No ${activeTab} sessions found.`
              }
            />
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
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  tabs: {
    flexDirection: "row",
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: space.md,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: colors.brandNavy },
  tabText: { ...typography.label, color: colors.textMuted },
  tabTextActive: { color: colors.brandNavy },

  list: { padding: space.md, gap: space.sm, paddingBottom: space.xl },

  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  cardInfo: { flex: 1 },
  cardName: { ...typography.subtitle, color: colors.text },
  cardRole: { ...typography.caption, color: colors.textMuted, marginTop: 2, marginBottom: space.xs },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  metaText: { ...typography.bodySm, color: colors.textMuted },

  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: space.sm,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  categoryText: { ...typography.caption, color: colors.textMuted },

  cardFooter: {
    marginTop: space.sm,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    alignItems: "flex-end",
  },

  avatarFallback: {
    backgroundColor: colors.brandNavy,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { color: colors.brandTextOn, fontWeight: "700" },
});
