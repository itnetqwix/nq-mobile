import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Pill } from "../../../../components/ui";
import { AccountType } from "../../../../constants/accountType";
import {
  canEnterLesson,
  canJoinSession,
  formatSessionWhen,
  getInstantAcceptDeadlineMs,
  getInstantJoinDeadlineMs,
  getJoinDisabledReason,
  isInstantLesson,
  isPendingBooking,
  normalizeSessionStatus,
} from "../../../../lib/sessions/sessionUtils";
import { InstantLessonDeadlineChip } from "../../../instant-lesson/components/InstantLessonDeadlineChip";
import { InstantLessonSessionActions } from "../../../instant-lesson/components/InstantLessonSessionActions";
import { navigationRef } from "../../../../navigation/navigationRef";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { HomeUserAvatar } from "./HomeUserAvatar";

type Props = {
  session: Record<string, unknown>;
  accountType: string | null;
  onPress?: () => void;
  /** Hide bottom border on last item in a list */
  isLast?: boolean;
  /** Trainer dashboard schedule — roomier layout with full-width join CTA */
  scheduleVariant?: boolean;
};

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

export function SessionPreviewRow({
  session,
  accountType,
  onPress,
  isLast,
  scheduleVariant = false,
}: Props) {
  const c = useThemeColors();
  const styles = useThemedStyles((palette) =>
    StyleSheet.create({
      row: {
        flexDirection: scheduleVariant ? "column" : "row",
        alignItems: scheduleVariant ? "stretch" : "center",
        paddingHorizontal: space.md,
        paddingVertical: scheduleVariant ? space.md : space.sm + 2,
        gap: scheduleVariant ? space.sm : space.md,
        borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: palette.border,
      },
      topRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
      },
      info: { flex: 1, minWidth: 0 },
      name: {
        ...typography.subtitle,
        color: palette.text,
        fontWeight: "700",
        fontSize: scheduleVariant ? 16 : undefined,
      },
      meta: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
      metaRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 6,
        marginTop: 4,
      },
      actions: {
        marginTop: scheduleVariant ? space.xs : 0,
        gap: 6,
      },
      chevron: {
        alignSelf: "center",
      },
    })
  );

  const isTrainer = accountType === AccountType.TRAINER;
  const other = (isTrainer ? session.trainee_info : session.trainer_info) as
    | Record<string, unknown>
    | undefined;
  const name = String(other?.fullname ?? other?.fullName ?? "Unknown");
  const { dateLabel, timeLabel } = formatSessionWhen(session);
  const pending = isPendingBooking(session);
  const status = normalizeSessionStatus(session.status as string);
  const instant = isInstantLesson(session);
  const acceptDeadlineMs = getInstantAcceptDeadlineMs(session);
  const joinDeadlineMs = getInstantJoinDeadlineMs(session);
  const joinEnabled = canEnterLesson(session);
  const isRejoin = joinEnabled && !canJoinSession(session);
  const lessonId = String(session._id ?? session.id ?? "");

  const joinBlock = !pending ? (
    <View style={styles.actions}>
      <Button
        label={isRejoin ? "Rejoin session" : "Join session"}
        leftIcon="videocam-outline"
        size="sm"
        fullWidth={scheduleVariant}
        onPress={() => {
          if (lessonId && navigationRef.isReady()) {
            navigationRef.navigate("Meeting", { lessonId });
          }
        }}
        disabled={!joinEnabled}
      />
      {!joinEnabled ? (
        <Text style={{ ...typography.caption, color: c.textMuted }}>
          {getJoinDisabledReason(session) || "Join opens later"}
        </Text>
      ) : null}
    </View>
  ) : null;

  const content = (
    <>
      <View style={scheduleVariant ? styles.topRow : undefined}>
        <HomeUserAvatar
          uri={other?.profile_picture as string | undefined}
          name={name}
          size={scheduleVariant ? 56 : 52}
        />
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.metaRow}>
            {!!dateLabel && <Text style={styles.meta}>{dateLabel}</Text>}
            {!!timeLabel && <Text style={styles.meta}>{timeLabel}</Text>}
          </View>
          <Pill
            label={pending ? "Needs confirmation" : status}
            tone={pending ? "warning" : getStatusTone(status)}
            style={{ marginTop: 6, alignSelf: "flex-start" }}
          />
          {instant && acceptDeadlineMs && pending ? (
            <InstantLessonDeadlineChip
              deadlineMs={acceptDeadlineMs}
              label={isTrainer ? "Respond within" : "Coach has"}
            />
          ) : null}
          {instant && joinDeadlineMs && !pending ? (
            <InstantLessonDeadlineChip
              deadlineMs={joinDeadlineMs}
              label="Join within"
            />
          ) : null}
          {isTrainer && pending && instant ? (
            <View style={{ marginTop: space.sm }}>
              <InstantLessonSessionActions session={session} />
            </View>
          ) : null}
          {!scheduleVariant ? joinBlock : null}
        </View>
        {onPress && !scheduleVariant ? (
          <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
        ) : null}
      </View>
      {scheduleVariant ? joinBlock : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.88 }]}
        onPress={onPress}
        accessibilityRole="button"
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.row}>{content}</View>;
}
