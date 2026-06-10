import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { CoachCarouselSkeleton, Skeleton } from "../../../../components/ui";
import { fetchRecentTrainers } from "../../../home/api/homeApi";
import { getTrainerName } from "../../../bookexpert/lib/trainerUtils";
import { trainerListItemKey } from "../../../../lib/lists/trainerListUtils";
import { queryKeys } from "../../../../lib/queryKeys";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { HomeUserAvatar } from "./HomeUserAvatar";

type Props = {
  onSelectTrainer: (trainer: Record<string, unknown>) => void;
};

export function PastBookedTrainersSection({ onSelectTrainer }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();

  const { data: trainers = [], isLoading } = useQuery({
    queryKey: queryKeys.presence.recentTrainers,
    queryFn: fetchRecentTrainers,
    staleTime: 120_000,
  });

  if (isLoading) {
    return (
      <View style={styles.wrap}>
        <Skeleton width={140} height={16} style={{ marginBottom: space.sm }} />
        <CoachCarouselSkeleton count={3} variant="pastBooked" showHeader={false} />
      </View>
    );
  }

  if (!trainers.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("traineeDiscover.pastBookedTitle")}</Text>
      <Text style={styles.sub}>{t("traineeDiscover.pastBookedSub")}</Text>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {trainers.map((item, i) => {
          const name = getTrainerName(item);
          return (
            <Pressable
              key={trainerListItemKey(item, i, "past-")}
              style={({ pressed }) => [styles.tile, pressed && { opacity: 0.9 }]}
              onPress={() => onSelectTrainer(item)}
              accessibilityRole="button"
              accessibilityLabel={t("traineeDiscover.bookAgainA11y", { name })}
            >
              <HomeUserAvatar uri={item?.profile_picture as string} name={name} size={56} />
              <Text style={styles.name} numberOfLines={2}>
                {name}
              </Text>
              <View style={styles.bookAgainRow}>
                <Ionicons name="refresh-outline" size={14} color={c.brandNavy} />
                <Text style={styles.bookAgain}>{t("traineeDiscover.bookAgain")}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      wrap: { marginBottom: space.md },
      title: { ...typography.titleSm, color: palette.text, fontWeight: "700" },
      sub: { ...typography.caption, color: palette.textMuted, marginTop: 4, marginBottom: space.sm },
      strip: { gap: space.sm, paddingVertical: 4 },
      tile: {
        width: 120,
        alignItems: "center",
        padding: space.sm,
        borderRadius: radii.md,
        backgroundColor: palette.surfaceElevated,
        borderWidth: 1,
        borderColor: palette.border,
      },
      name: {
        ...typography.caption,
        color: palette.text,
        fontWeight: "600",
        textAlign: "center",
        marginTop: 6,
        minHeight: 32,
      },
      bookAgainRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
      bookAgain: { ...typography.caption, color: palette.brandNavy, fontWeight: "700" },
    })
  );
}
