import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { DashboardSection } from "../shared/DashboardSection";
import { SessionPreviewRow } from "../home/SessionPreviewRow";
import { AccountType } from "../../../../constants/accountType";
import { radii, space, typography, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";

type Props = {
  sessions: Record<string, unknown>[];
  onSessionPress: (session: Record<string, unknown>) => void;
  onSeeAll: () => void;
  onOpenSchedule?: () => void;
  scheduleHint?: string;
};

export function TodayScheduleTimeline({
  sessions,
  onSessionPress,
  onSeeAll,
  onOpenSchedule,
  scheduleHint,
}: Props) {
  const { t } = useAppTranslation();
  const styles = useStyles();

  const scheduleAction =
    onOpenSchedule != null ? (
      <Pressable onPress={onOpenSchedule} hitSlop={8}>
        <Text style={styles.link}>{t("trainerDashboard.openSchedule")}</Text>
      </Pressable>
    ) : null;

  if (!sessions.length) {
    if (!onOpenSchedule) return null;
    return (
      <DashboardSection embedded title={t("trainerDashboard.todaySchedule")} action={scheduleAction}>
        {scheduleHint ? (
          <Pressable onPress={onOpenSchedule} style={styles.scheduleHintRow}>
            <Text style={styles.scheduleHint} numberOfLines={2}>
              {scheduleHint}
            </Text>
          </Pressable>
        ) : null}
      </DashboardSection>
    );
  }

  return (
    <DashboardSection
      embedded
      title={t("trainerDashboard.todaySchedule")}
      action={
        scheduleAction ?? (
          <Pressable onPress={onSeeAll} hitSlop={8}>
            <Text style={styles.link}>{t("trainerDashboard.seeAllSessions")}</Text>
          </Pressable>
        )
      }
    >
      <View style={styles.list}>
        {sessions.map((session, i) => (
          <SessionPreviewRow
            key={String(session._id ?? i)}
            session={session}
            accountType={AccountType.TRAINER}
            onPress={() => onSessionPress(session)}
            isLast={i === sessions.length - 1}
            scheduleVariant
          />
        ))}
      </View>
    </DashboardSection>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      list: {
        borderRadius: radii.lg,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surfaceElevated,
        gap: 0,
      },
      link: { ...typography.caption, color: palette.brandNavy, fontWeight: "700" },
      scheduleHintRow: {
        paddingVertical: space.sm,
        paddingHorizontal: space.md,
      },
      scheduleHint: {
        ...typography.caption,
        color: palette.textSecondary,
      },
    })
  );
}
