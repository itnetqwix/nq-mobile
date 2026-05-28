import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Pill } from "../../../../components/ui";
import { ProfileAvatar } from "../../../../components/ui/ProfileAvatar";
import { navigationRef } from "../../../../navigation/navigationRef";
import {
  canEnterLesson,
  canJoinSession,
  formatSessionWhen,
  getInstantAcceptDeadlineMs,
  getInstantJoinDeadlineMs,
  getSessionStart,
  isInstantLesson,
  isPendingBooking,
  isSessionInProgress,
  isSessionToday,
  normalizeSessionStatus,
} from "../../../../lib/sessions/sessionUtils";
import { InstantLessonDeadlineChip } from "../../../instant-lesson/components/InstantLessonDeadlineChip";
import { DashboardSection } from "../shared/DashboardSection";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";

type Props = {
  sessions: Record<string, unknown>[];
  onSessionPress: (session: Record<string, unknown>) => void;
  onSeeAll: () => void;
  onOpenSchedule?: () => void;
};

function sessionSportLabel(session: Record<string, unknown>): string | null {
  const raw =
    session.sport ??
    session.sports ??
    session.category ??
    session.training_category ??
    session.session_category;
  if (!raw) return null;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (typeof raw === "object" && raw !== null) {
    const o = raw as Record<string, unknown>;
    const name = o.name ?? o.title ?? o.label;
    if (name) return String(name);
  }
  return null;
}

function formatTimelineTime(session: Record<string, unknown>): {
  primary: string;
  secondary: string;
} {
  const start = getSessionStart(session);
  const { timeLabel } = formatSessionWhen(session);
  if (!start) {
    return { primary: timeLabel || "—", secondary: "" };
  }
  const primary = start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  let secondary = "";
  if (isSessionInProgress(session)) {
    secondary = "Now";
  } else if (!isSessionToday(session)) {
    secondary = start.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } else {
    const minsUntil = Math.round((start.getTime() - Date.now()) / 60_000);
    if (minsUntil > 0 && minsUntil < 120) {
      secondary = `In ${minsUntil} min`;
    } else {
      secondary = "Today";
    }
  }
  return { primary, secondary };
}

export function TodayScheduleTimeline({
  sessions,
  onSessionPress,
  onSeeAll,
  onOpenSchedule,
}: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      }),
    []
  );

  if (!sessions.length) {
    return (
      <DashboardSection
        embedded
        title={t("trainerDashboard.todaySchedule")}
        subtitle={todayLabel}
      >
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="calendar-outline" size={28} color={c.brandNavy} />
          </View>
          <Text style={styles.emptyTitle}>
            {t("trainerDashboard.scheduleEmptyTitle", {
              defaultValue: "No lessons today",
            })}
          </Text>
          <Text style={styles.emptyBody}>
            {t("trainerDashboard.scheduleEmptyBody", {
              defaultValue:
                "When trainees book you, their sessions will show up here with quick join actions.",
            })}
          </Text>
          {onOpenSchedule ? (
            <Button
              label={t("trainerDashboard.openSchedule")}
              variant="secondary"
              size="sm"
              leftIcon="calendar-outline"
              fullWidth={false}
              onPress={onOpenSchedule}
            />
          ) : null}
          <Pressable onPress={onSeeAll} hitSlop={8} style={styles.emptyLink}>
            <Text style={styles.seeAllLink}>{t("trainerDashboard.seeAllSessions")}</Text>
            <Ionicons name="arrow-forward" size={14} color={c.brandNavy} />
          </Pressable>
        </View>
      </DashboardSection>
    );
  }

  return (
    <DashboardSection
      embedded
      title={t("trainerDashboard.todaySchedule")}
      subtitle={todayLabel}
      action={
        <Pressable
          onPress={onSeeAll}
          hitSlop={8}
          style={({ pressed }) => [styles.seeAllPill, pressed && { opacity: 0.88 }]}
          accessibilityRole="button"
          accessibilityLabel={t("trainerDashboard.seeAllSessions")}
        >
          <Text style={styles.seeAllPillText}>{t("trainerDashboard.seeAllSessions")}</Text>
          <Ionicons name="chevron-forward" size={14} color={c.brandNavy} />
        </Pressable>
      }
    >
      <View style={styles.card}>
        {sessions.map((session, index) => (
          <ScheduleTimelineItem
            key={String(session._id ?? index)}
            session={session}
            isLast={index === sessions.length - 1}
            onPress={() => onSessionPress(session)}
          />
        ))}
      </View>
    </DashboardSection>
  );
}

function ScheduleTimelineItem({
  session,
  isLast,
  onPress,
}: {
  session: Record<string, unknown>;
  isLast: boolean;
  onPress: () => void;
}) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();

  const other = session.trainee_info as Record<string, unknown> | undefined;
  const name = String(other?.fullname ?? other?.fullName ?? t("sessions.unknown", { defaultValue: "Student" }));
  const sport = sessionSportLabel(session);
  const { primary: timePrimary, secondary: timeSecondary } = formatTimelineTime(session);
  const { timeLabel } = formatSessionWhen(session);

  const live = isSessionInProgress(session);
  const pending = isPendingBooking(session);
  const instant = isInstantLesson(session);
  const status = normalizeSessionStatus(session.status as string);
  const acceptDeadlineMs = getInstantAcceptDeadlineMs(session);
  const joinDeadlineMs = getInstantJoinDeadlineMs(session);
  const joinEnabled = canEnterLesson(session);
  const isRejoin = joinEnabled && !canJoinSession(session);
  const lessonId = String(session._id ?? session.id ?? "");

  const statusLabel = pending
    ? t("trainerDashboard.scheduleNeedsConfirm", { defaultValue: "Needs confirmation" })
    : live
      ? t("trainerDashboard.scheduleLive", { defaultValue: "Live now" })
      : status === "confirmed"
        ? t("trainerDashboard.scheduleConfirmed", { defaultValue: "Confirmed" })
        : status;

  const statusTone = pending ? "warning" : live ? "success" : status === "confirmed" ? "info" : "neutral";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.item,
        live && styles.itemLive,
        !isLast && styles.itemBorder,
        pressed && { opacity: 0.94 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${timePrimary}, ${statusLabel}`}
    >
      <View style={styles.timeCol}>
        <Text style={[styles.timePrimary, live && styles.timePrimaryLive]}>{timePrimary}</Text>
        {timeSecondary ? (
          <Text style={[styles.timeSecondary, live && styles.timeSecondaryLive]}>
            {timeSecondary}
          </Text>
        ) : null}
      </View>

      <View style={styles.railCol}>
        <View style={[styles.railDot, live && styles.railDotLive]} />
        {!isLast ? <View style={[styles.railLine, live && styles.railLineLive]} /> : null}
      </View>

      <View style={styles.bodyCol}>
        <View style={styles.bodyTop}>
          <ProfileAvatar
            uri={other?.profile_picture as string | undefined}
            user={other}
            name={name}
            size={44}
          />
          <View style={styles.bodyCopy}>
            <Text style={styles.studentName} numberOfLines={1}>
              {name}
            </Text>
            {sport ? (
              <Text style={styles.sportMeta} numberOfLines={1}>
                {sport}
              </Text>
            ) : null}
            {timeLabel ? (
              <View style={styles.durationRow}>
                <Ionicons name="time-outline" size={12} color={c.textMuted} />
                <Text style={styles.durationText} numberOfLines={1}>
                  {timeLabel}
                </Text>
              </View>
            ) : null}
          </View>
          <Pill
            label={statusLabel}
            tone={statusTone}
            icon={live ? "radio-button-on" : instant ? "flash-outline" : undefined}
          />
        </View>

        {instant && acceptDeadlineMs && pending ? (
          <InstantLessonDeadlineChip
            deadlineMs={acceptDeadlineMs}
            label={t("sessions.respondWithin", { defaultValue: "Respond within" })}
          />
        ) : null}
        {instant && joinDeadlineMs && !pending ? (
          <InstantLessonDeadlineChip
            deadlineMs={joinDeadlineMs}
            label={t("sessions.traineeMustJoinWithin", { defaultValue: "Trainee must join within" })}
          />
        ) : null}

        {joinEnabled ? (
          <View
            style={styles.joinWrap}
            onStartShouldSetResponder={() => true}
          >
            <Button
              label={
                isRejoin
                  ? t("trainerDashboard.scheduleRejoin", { defaultValue: "Rejoin lesson" })
                  : t("trainerDashboard.scheduleJoin", { defaultValue: "Join lesson" })
              }
              leftIcon="videocam"
              size="sm"
              fullWidth
              onPress={() => {
                if (lessonId && navigationRef.isReady()) {
                  navigationRef.navigate("Meeting", { lessonId });
                }
              }}
            />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      card: {
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surfaceElevated,
        overflow: "hidden",
      },
      seeAllPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: radii.pill,
        backgroundColor: palette.brandSubtle,
      },
      seeAllPillText: {
        ...typography.caption,
        color: palette.brandNavy,
        fontWeight: "700",
      },
      seeAllLink: {
        ...typography.caption,
        color: palette.brandNavy,
        fontWeight: "700",
      },
      item: {
        flexDirection: "row",
        alignItems: "stretch",
        paddingVertical: space.md,
        paddingRight: space.md,
        paddingLeft: space.sm,
        backgroundColor: palette.surfaceElevated,
      },
      itemLive: {
        backgroundColor: `${palette.success}0c`,
      },
      itemBorder: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: palette.border,
      },
      timeCol: {
        width: 72,
        paddingLeft: space.sm,
        alignItems: "flex-end",
        paddingTop: 2,
      },
      timePrimary: {
        ...typography.subtitle,
        fontWeight: "700",
        color: palette.text,
        fontVariant: ["tabular-nums"],
      },
      timePrimaryLive: {
        color: palette.successText,
      },
      timeSecondary: {
        ...typography.caption,
        color: palette.textMuted,
        marginTop: 2,
        textAlign: "right",
      },
      timeSecondaryLive: {
        color: palette.successText,
        fontWeight: "600",
      },
      railCol: {
        width: 24,
        alignItems: "center",
        marginHorizontal: space.xs,
      },
      railDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginTop: 6,
        backgroundColor: palette.brandAccent,
        borderWidth: 2,
        borderColor: palette.surfaceElevated,
      },
      railDotLive: {
        backgroundColor: palette.success,
        borderColor: palette.successSubtle,
      },
      railLine: {
        flex: 1,
        width: 2,
        marginTop: 4,
        marginBottom: -space.md,
        borderRadius: 1,
        backgroundColor: palette.border,
      },
      railLineLive: {
        backgroundColor: palette.success,
        opacity: 0.35,
      },
      bodyCol: {
        flex: 1,
        minWidth: 0,
        gap: space.sm,
      },
      bodyTop: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: space.sm,
      },
      bodyCopy: {
        flex: 1,
        minWidth: 0,
        paddingTop: 2,
      },
      studentName: {
        ...typography.subtitle,
        fontWeight: "700",
        color: palette.text,
      },
      sportMeta: {
        ...typography.caption,
        color: palette.textSecondary,
        marginTop: 2,
      },
      durationRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginTop: 4,
      },
      durationText: {
        ...typography.caption,
        color: palette.textMuted,
        flex: 1,
      },
      joinWrap: {
        marginTop: space.xs,
      },
      emptyCard: {
        alignItems: "center",
        padding: space.lg,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surfaceElevated,
        gap: space.sm,
      },
      emptyIconWrap: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: palette.brandSubtle,
        marginBottom: space.xs,
      },
      emptyTitle: {
        ...typography.titleSm,
        color: palette.text,
        fontWeight: "700",
        textAlign: "center",
      },
      emptyBody: {
        ...typography.bodySm,
        color: palette.textMuted,
        textAlign: "center",
        lineHeight: 20,
        marginBottom: space.xs,
      },
      emptyLink: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginTop: space.xs,
      },
    })
  );
}
