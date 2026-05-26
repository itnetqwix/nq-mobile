import * as SecureStore from "expo-secure-store";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../auth/context/AuthContext";
import { AccountType } from "../../../constants/accountType";
import { Button, Card, EmptyState, Pill, SessionRowSkeleton, Skeleton, SkeletonGroup, Stack } from "../../../components/ui";
import { colors, radii, space, typography } from "../../../theme";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { queryKeys } from "../../../lib/queryKeys";
import { fetchScheduledMeetings } from "../../home/api/homeApi";
import { useHapticRefresh } from "../../../lib/refresh/useHapticRefresh";
import {
  canEnterLesson,
  canJoinSession,
  formatSessionWhen,
  getInstantAcceptDeadlineMs,
  getInstantJoinDeadlineMs,
  getJoinDisabledReason,
  getOtherParty,
  getSessionOutcomeI18nKey,
  isInstantExpiredForLists,
  isInstantLesson,
  isPendingBooking,
  isSessionTerminalForUI,
  normalizeSessionStatus,
} from "../../../lib/sessions/sessionUtils";
import { InstantLessonDeadlineChip } from "../../instant-lesson/components/InstantLessonDeadlineChip";
import { InstantLessonSessionActions } from "../../instant-lesson/components/InstantLessonSessionActions";
import { useSessionBooking } from "../SessionBookingContext";
import { SessionsCalendar } from "../components/SessionsCalendar";
import type { RootStackParamList } from "../../../navigation/types";
import { useAppTranslation } from "../../../i18n/useAppTranslation";

const CALENDAR_COLLAPSED_KEY = "nq.sessions-calendar-collapsed";

const STATUS_TAB_KEYS = [
  { key: "upcoming", labelKey: "sessions.tabUpcoming" },
  { key: "confirmed", labelKey: "sessions.tabConfirmed" },
  { key: "completed", labelKey: "sessions.tabCompleted" },
  { key: "cancelled", labelKey: "sessions.tabCancelled" },
] as const;

type StatusTab = (typeof STATUS_TAB_KEYS)[number]["key"];

type SessionsTabLabelKey =
  | "sessions.tabUpcoming"
  | "sessions.tabConfirmed"
  | "sessions.tabCompleted"
  | "sessions.tabCancelled";

const TAB_LABEL_KEYS: Record<StatusTab, SessionsTabLabelKey> = {
  upcoming: "sessions.tabUpcoming",
  confirmed: "sessions.tabConfirmed",
  completed: "sessions.tabCompleted",
  cancelled: "sessions.tabCancelled",
};

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
  switch (normalizeSessionStatus(status)) {
    case "confirmed":
      return "success";
    case "completed":
      return "neutral";
    case "cancelled":
      return "danger";
    case "booked":
      return "warning";
    default:
      return "info";
  }
}

function SessionCard({
  session,
  accountType,
  activeTab,
}: {
  session: any;
  accountType: string | null;
  activeTab: StatusTab;
}) {
  const { t } = useAppTranslation();
  const isTrainer = accountType === AccountType.TRAINER;
  const other = getOtherParty(session, isTrainer);
  const name = other?.fullname || other?.fullName || t("sessions.unknown");
  const theirRole = isTrainer ? t("sessions.student") : t("sessions.trainer");
  const instant = isInstantLesson(session);
  const pending = isPendingBooking(session);
  const status = normalizeSessionStatus(session.status);
  const isCancelledTab = activeTab === "cancelled";
  const terminal = isCancelledTab || isSessionTerminalForUI(session);
  const outcomeKey = getSessionOutcomeI18nKey(session);
  const outcomeLabel = outcomeKey ? t(outcomeKey as any) : null;
  const { openSession } = useSessionBooking();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { dateLabel, timeLabel } = formatSessionWhen(session);
  const joinEnabled = !terminal && canEnterLesson(session);
  const isRejoin = joinEnabled && !canJoinSession(session);
  const acceptDeadlineMs = getInstantAcceptDeadlineMs(session);
  const joinDeadlineMs = getInstantJoinDeadlineMs(session);

  const handleJoin = () => {
    const lessonId = session._id ?? session.id;
    if (lessonId) navigation.navigate("Meeting", { lessonId: String(lessonId) });
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
      onPress={() => openSession(session)}
    >
      <View style={styles.cardTop}>
        <Avatar uri={other?.profile_picture} name={name} size={56} />
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{name}</Text>
          <Text style={styles.cardRole}>{theirRole}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
            <Text style={styles.metaText}>{dateLabel}</Text>
          </View>
          {!!timeLabel && (
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={13} color={colors.textMuted} />
              <Text style={styles.metaText}>{timeLabel}</Text>
            </View>
          )}
        </View>
        <StatusBadge status={pending && !terminal ? "booked" : status} />
      </View>

      {outcomeLabel ? (
        <View style={styles.outcomeRow}>
          <Ionicons name="information-circle-outline" size={14} color={colors.danger} />
          <Text style={styles.outcomeText}>{outcomeLabel}</Text>
        </View>
      ) : null}

      {instant && acceptDeadlineMs && isTrainer && pending && !terminal ? (
        <InstantLessonDeadlineChip
          deadlineMs={acceptDeadlineMs}
          label={t("sessions.respondWithin")}
        />
      ) : null}
      {instant && joinDeadlineMs && !pending && !terminal ? (
        <InstantLessonDeadlineChip
          deadlineMs={joinDeadlineMs}
          label={isTrainer ? t("sessions.traineeMustJoinWithin") : t("sessions.joinWithin")}
        />
      ) : null}
      {!isTrainer && instant && acceptDeadlineMs && pending && !terminal ? (
        <InstantLessonDeadlineChip
          deadlineMs={acceptDeadlineMs}
          label={t("sessions.coachHas")}
        />
      ) : null}

      {(session.category || instant) && (
        <View style={styles.categoryRow}>
          {instant ? (
            <>
              <Ionicons name="flash" size={13} color={colors.brandAccent} />
              <Text style={[styles.categoryText, { color: colors.brandAccent, fontWeight: "700" }]}>
                {t("sessions.instantLesson")}
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

      <View style={styles.cardFooter}>
        {terminal ? (
          <Button
            label={t("sessions.viewBookingDetails")}
            variant="secondary"
            leftIcon="document-text-outline"
            onPress={() => openSession(session)}
            size="md"
            fullWidth={false}
          />
        ) : (
          <>
            {isTrainer && pending && instant ? (
              <InstantLessonSessionActions session={session} layout="row" size="md" />
            ) : null}
            {isTrainer && pending && !instant ? (
              <Button
                label={t("sessions.reviewAndConfirm")}
                leftIcon="checkmark-circle-outline"
                onPress={() => openSession(session)}
                size="md"
                fullWidth={false}
              />
            ) : null}
            {!pending && (
              <Button
                label={
                  isRejoin ? t("sessions.rejoinSession", "Rejoin session") : t("sessions.joinSession")
                }
                leftIcon="videocam-outline"
                onPress={handleJoin}
                size="md"
                fullWidth={false}
                disabled={!joinEnabled}
              />
            )}
            {!pending && !joinEnabled ? (
              <Text style={styles.joinHint}>
                {getJoinDisabledReason(session) || t("sessions.joinOpensLater")}
              </Text>
            ) : null}
          </>
        )}
      </View>
    </Pressable>
  );
}

function isSameDay(dateStr: string | undefined, target: string): boolean {
  if (!dateStr) return false;
  try {
    const d = new Date(dateStr);
    return d.toISOString().slice(0, 10) === target || dateStr.slice(0, 10) === target;
  } catch {
    return false;
  }
}

export function UpcomingSessionsScreen() {
  const { t } = useAppTranslation();
  const { accountType } = useAuth();
  const insets = useSafeAreaInsets();
  const isTrainerOuter = accountType === AccountType.TRAINER;
  const outerNavigation = useNavigation<NativeStackNavigationProp<any>>();
  const [activeTab, setActiveTab] = useState<StatusTab>("upcoming");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  /** Inner list ScrollView ref — reset to top on tab change so an old offset
   *  from a long list doesn't show as a tall blank area on a short list. */
  const listScrollRef = useRef<ScrollView | null>(null);
  const [monthAnchor, setMonthAnchor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [calendarCollapsed, setCalendarCollapsed] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(CALENDAR_COLLAPSED_KEY)
      .then((v) => {
        if (v === "1") setCalendarCollapsed(true);
      })
      .catch(() => undefined);
  }, []);

  const toggleCalendarCollapsed = useCallback(() => {
    setCalendarCollapsed((prev) => {
      const next = !prev;
      SecureStore.setItemAsync(CALENDAR_COLLAPSED_KEY, next ? "1" : "0").catch(() => undefined);
      return next;
    });
  }, []);

  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);

  /**
   * Active tabs (upcoming/confirmed) merge both statuses because the backend may
   * file an active instant lesson under either bucket depending on whether the
   * trainer joined yet. This ensures rejoinable instant lessons always surface
   * regardless of server-side bookkeeping.
   */
  const { data: rawSessions = [], isLoading, refetch } = useQuery({
    queryKey: queryKeys.sessions.list(activeTab),
    queryFn: async () => {
      if (activeTab === "upcoming" || activeTab === "confirmed") {
        const [upcoming, confirmed] = await Promise.all([
          fetchScheduledMeetings("upcoming").catch(() => []),
          fetchScheduledMeetings("confirmed").catch(() => []),
        ]);
        return [...upcoming, ...confirmed];
      }
      return fetchScheduledMeetings(activeTab);
    },
    staleTime: 60_000,
  });

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  /** Pull-to-refresh haptics — tick on trigger, success/error on resolve. */
  const { refreshing: isRefetching, onRefresh: onRefreshSessions } = useHapticRefresh(refetch);

  const sessions = useMemo(() => {
    const nowMs = Date.now();
    let list = rawSessions;
    if (activeTab === "upcoming" || activeTab === "confirmed") {
      list = list.filter((s: any) => !isInstantExpiredForLists(s, new Date(nowMs)));
      list = list.filter((s: any) => {
        const status = (s?.status ?? "").toString().toLowerCase();
        if (activeTab === "confirmed") {
          return status === "confirmed" || isInstantLesson(s);
        }
        return status !== "confirmed";
      });
    }
    if (selectedDate) {
      list = list.filter((s: any) => isSameDay(s.booked_date, selectedDate));
    }
    const seen = new Set<string>();
    return list.filter((s: any) => {
      const id = String(s._id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [rawSessions, activeTab, selectedDate]);

  const sessionDates = useMemo(() => {
    const dates = new Set<string>();
    for (const s of rawSessions as any[]) {
      if (s.booked_date) {
        try {
          const key = new Date(s.booked_date).toISOString().slice(0, 10);
          dates.add(key);
        } catch { /* skip invalid */ }
      }
    }
    return dates;
  }, [rawSessions]);

  return (
    <View style={styles.root}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
        style={styles.tabsScroll}
      >
        {STATUS_TAB_KEYS.map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => {
              setActiveTab(tab.key);
              setSelectedDate(null);
              listScrollRef.current?.scrollTo({ y: 0, animated: false });
            }}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {t(tab.labelKey)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <SessionsCalendar
        monthAnchor={monthAnchor}
        selectedDate={selectedDate}
        sessionDates={sessionDates}
        todayKey={todayKey}
        collapsed={calendarCollapsed}
        onToggleCollapsed={toggleCalendarCollapsed}
        onMonthChange={(delta) => {
          setMonthAnchor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
        }}
        onSelectDate={setSelectedDate}
      />

      {isLoading ? (
        /** Session-row shape skeleton: avatar + 3 stacked lines + CTA pill,
         *  mirroring the upcoming session card so the page doesn't jolt. */
        <SkeletonGroup
          count={3}
          gap={space.sm}
          renderRow={() => <SessionRowSkeleton />}
          style={styles.list}
        />
      ) : (
        <ScrollView
          ref={listScrollRef}
          contentContainerStyle={[
            styles.list,
            { flexGrow: 1, paddingBottom: insets.bottom + space.md },
          ]}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefreshSessions} tintColor={colors.brand} />
          }
        >
          {sessions.length === 0 ? (
            <EmptyState
              icon="calendar-outline"
              title={
                selectedDate
                  ? t("sessions.emptyOnDate", { date: selectedDate })
                  : t("sessions.emptyTab", { tab: t(TAB_LABEL_KEYS[activeTab]) })
              }
              description={
                selectedDate
                  ? t("sessions.emptyDateHint")
                  : activeTab === "upcoming"
                    ? t("sessions.emptyUpcomingDescription")
                    : activeTab === "cancelled"
                      ? t("sessions.emptyCancelledDescription")
                      : t("sessions.emptyTabDescription", { tab: t(TAB_LABEL_KEYS[activeTab]) })
              }
              actionLabel={
                activeTab === "upcoming" && !selectedDate
                  ? isTrainerOuter
                    ? t("sessions.emptyCtaTrainer", { defaultValue: "Edit availability" })
                    : t("sessions.emptyCtaTrainee", { defaultValue: "Find a trainer" })
                  : undefined
              }
              onAction={
                activeTab === "upcoming" && !selectedDate
                  ? () => {
                      try {
                        if (isTrainerOuter) {
                          outerNavigation.navigate("Home", {
                            screen: "ShellSurface",
                            params: { surfaceId: "trainerSchedule" },
                          });
                        } else {
                          outerNavigation.navigate("Home", {
                            screen: "DashboardFeature",
                            params: { featureId: "book-lesson" },
                          });
                        }
                      } catch {
                        /* Older navigators — best effort. */
                      }
                    }
                  : undefined
              }
            />
          ) : (
            sessions.map((session: any, idx: number) => (
              <SessionCard
                key={`sess-${session?._id ?? "row"}-${idx}`}
                session={session}
                accountType={accountType}
                activeTab={activeTab}
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

  tabsScroll: {
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    maxHeight: 44,
  },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: space.sm,
    gap: 8,
    alignItems: "center",
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: space.md,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: colors.brandNavy },
  tabText: { ...typography.label, color: colors.textMuted },
  tabTextActive: { color: colors.brandNavy },

  list: { padding: space.md, gap: space.sm },

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
  outcomeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: space.sm,
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    backgroundColor: colors.dangerSubtle,
    borderRadius: radii.sm,
  },
  outcomeText: { ...typography.caption, color: colors.danger, flex: 1 },

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
    gap: space.xs,
  },
  joinHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "right",
  },

  avatarFallback: {
    backgroundColor: colors.brandNavy,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { color: colors.brandTextOn, fontWeight: "700" },

  calStrip: {
    flexDirection: "row",
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    gap: 6,
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  calDay: {
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    minWidth: 48,
  },
  calDaySelected: {
    backgroundColor: colors.brandNavy,
  },
  calDayToday: {
    borderWidth: 1,
    borderColor: colors.brandNavy,
  },
  calDayName: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  calDayNum: { ...typography.subtitle, color: colors.text, marginTop: 2 },
  calDayTextSelected: { color: colors.brandTextOn },
  calDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.brandAccent,
    marginTop: 3,
  },
  calMonthLabel: {
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  calMonthText: {
    ...typography.overline,
    color: colors.brandNavy,
    fontWeight: "700",
    fontSize: 10,
  },
});
