import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Pill } from "../../../../components/ui";
import { AccountType } from "../../../../constants/accountType";
import {
  getInstantAcceptDeadlineMs,
  getInstantJoinDeadlineMs,
  isInstantLesson,
  isPendingBooking,
  normalizeSessionStatus,
} from "../../../../lib/sessions/sessionUtils";
import { InstantLessonDeadlineChip } from "../../../instant-lesson/components/InstantLessonDeadlineChip";
import { space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { HomeUserAvatar } from "./HomeUserAvatar";

type Props = {
  session: Record<string, unknown>;
  accountType: string | null;
  onPress?: () => void;
  /** Hide bottom border on last item in a list */
  isLast?: boolean;
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

export function SessionPreviewRow({ session, accountType, onPress, isLast }: Props) {
  const c = useThemeColors();
  const styles = useThemedStyles((palette) =>
    StyleSheet.create({
      row: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: space.md,
        paddingVertical: space.sm + 2,
        gap: space.md,
        borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: palette.border,
      },
      info: { flex: 1, minWidth: 0 },
      name: { ...typography.subtitle, color: palette.text, fontWeight: "600" },
      meta: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
    })
  );

  const isTrainer = accountType === AccountType.TRAINER;
  const other = (isTrainer ? session.trainee_info : session.trainer_info) as
    | Record<string, unknown>
    | undefined;
  const name = String(other?.fullname ?? other?.fullName ?? "Unknown");
  const date = session.booked_date ? String(session.booked_date).slice(0, 10) : "";
  const time =
    session.session_start_time && session.session_end_time
      ? `${session.session_start_time} – ${session.session_end_time}`
      : session.start_time && session.end_time
        ? `${session.start_time} – ${session.end_time}`
        : "";
  const pending = isPendingBooking(session);
  const status = normalizeSessionStatus(session.status as string);
  const instant = isInstantLesson(session);
  const acceptDeadlineMs = getInstantAcceptDeadlineMs(session);
  const joinDeadlineMs = getInstantJoinDeadlineMs(session);

  const content = (
    <>
      <HomeUserAvatar
        uri={other?.profile_picture as string | undefined}
        name={name}
        size={52}
      />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {!!date && <Text style={styles.meta}>{date}</Text>}
        {!!time && <Text style={styles.meta}>{time}</Text>}
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
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
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
