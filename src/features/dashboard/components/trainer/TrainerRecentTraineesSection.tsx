import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { CoachCarouselSkeleton } from "../../../../components/ui";
import { trainerListItemKey } from "../../../../lib/lists/trainerListUtils";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { DashboardPersonTile } from "../shared/DashboardPersonTile";

type Props = {
  trainees: Record<string, unknown>[];
  loading?: boolean;
  selectedTraineeId?: string | null;
  onSelectTrainee?: (trainee: Record<string, unknown> | null) => void;
};

export function TrainerRecentTraineesSection({
  trainees,
  loading = false,
  selectedTraineeId = null,
  onSelectTrainee,
}: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();

  if (loading) {
    return (
      <View style={styles.wrap}>
        <CoachCarouselSkeleton count={3} variant="pastBooked" showHeader />
      </View>
    );
  }

  if (!trainees.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Ionicons name="time-outline" size={15} color={c.textSecondary} />
        <Text style={styles.title}>
          {t("dashboardHome.recentTrainees", { defaultValue: "Recent Enthusiasts" })}
        </Text>
      </View>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {trainees.map((user, index) => {
          const traineeId = String(user._id ?? "");
          const name = String(
            user.fullname ??
              user.fullName ??
              user.name ??
              t("dashboardHome.userDefault", { defaultValue: "Student" })
          );
          const selected = !!traineeId && selectedTraineeId === traineeId;
          return (
            <DashboardPersonTile
              key={trainerListItemKey(user, index, "recent-trainee-")}
              name={name}
              avatar={user.profile_picture as string | undefined}
              onPress={
                onSelectTrainee
                  ? () => onSelectTrainee(selected ? null : user)
                  : () => {}
              }
              useHomeAvatar
              style={selected ? styles.tileSelected : undefined}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      wrap: {
        marginBottom: 0,
      },
      headerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.xs,
        marginBottom: space.md,
      },
      title: { ...typography.titleSm, color: palette.text, fontWeight: "700" },
      strip: { gap: space.md, paddingVertical: space.sm, paddingRight: space.sm },
      tileSelected: {
        borderColor: palette.brandNavy,
        borderWidth: 2,
        backgroundColor: palette.brandSubtle,
      },
    })
  );
}
