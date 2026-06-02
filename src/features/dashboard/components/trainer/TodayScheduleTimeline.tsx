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
};

export function TodayScheduleTimeline({ sessions, onSessionPress, onSeeAll }: Props) {
  const { t } = useAppTranslation();
  const styles = useStyles();
  if (!sessions.length) return null;

  return (
    <DashboardSection
      embedded
      title={t("trainerDashboard.todaySchedule")}
      action={
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={styles.link}>{t("trainerDashboard.seeAllSessions")}</Text>
        </Pressable>
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
      },
      link: { ...typography.caption, color: palette.brandNavy, fontWeight: "700" },
    })
  );
}
