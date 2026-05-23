import React from "react";
import { ScrollView, Text, View } from "react-native";
import { HomeUserAvatar } from "../home/HomeUserAvatar";
import { DashboardSection } from "../shared/DashboardSection";
import { trainerListItemKey } from "../../../../lib/lists/trainerListUtils";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { useThemedStyles } from "../../../../theme";
import { createTrainerDashboardStyles } from "./trainerDashboardTheme";

type Props = {
  trainees: Record<string, unknown>[];
};

export function TrainerRecentTraineesSection({ trainees }: Props) {
  const { t } = useAppTranslation();
  const styles = useStyles();
  if (!trainees.length) return null;

  return (
    <DashboardSection embedded title={t("dashboardHome.recentTrainees")}>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalStrip}
      >
        {trainees.map((user, index) => {
          const name = String(
            user.fullname ?? user.fullName ?? user.name ?? t("dashboardHome.userDefault")
          );
          return (
            <View key={trainerListItemKey(user, index, "recent-trainee-")} style={styles.traineeTile}>
              <HomeUserAvatar
                uri={user.profile_picture as string | undefined}
                name={name}
                size={52}
              />
              <Text style={styles.traineeName} numberOfLines={2}>
                {name}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </DashboardSection>
  );
}

function useStyles() {
  return useThemedStyles((palette) => createTrainerDashboardStyles(palette));
}
