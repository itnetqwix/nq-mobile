import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { CoachCarouselSkeleton, Skeleton } from "../../../../components/ui";
import { fetchRecentTrainers } from "../../../home/api/homeApi";
import { getTrainerName } from "../../../bookexpert/lib/trainerUtils";
import { trainerListItemKey } from "../../../../lib/lists/trainerListUtils";
import { queryKeys } from "../../../../lib/queryKeys";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { HomeUserAvatar } from "./HomeUserAvatar";

const TILE_WIDTH = 136;
const AVATAR_SIZE = 58;

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
        <Skeleton width={160} height={14} style={{ marginBottom: space.sm }} />
        <CoachCarouselSkeleton count={3} variant="pastBooked" showHeader={false} />
      </View>
    );
  }

  if (!trainers.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Ionicons name="time-outline" size={15} color={c.textSecondary} />
        <Text style={styles.title}>{t("traineeDiscover.pastBookedTitle")}</Text>
      </View>
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
              style={({ pressed }) => [styles.tile, pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] }]}
              onPress={() => onSelectTrainer(item)}
              accessibilityRole="button"
              accessibilityLabel={t("traineeDiscover.bookAgainA11y", { name })}
            >
              <HomeUserAvatar uri={item?.profile_picture as string} name={name} size={AVATAR_SIZE} />
              <Text style={styles.name} numberOfLines={2}>{name}</Text>
              <View style={styles.bookAgainRow}>
                <Ionicons name="refresh-outline" size={12} color={c.brandNavy} />
                <Text style={styles.bookAgainText}>{t("traineeDiscover.bookAgain")}</Text>
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
      wrap: {},
      headerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.xs,
        marginBottom: space.sm,
      },
      title: { ...typography.titleSm, color: palette.text, fontWeight: "700" },
      strip: { gap: space.sm, paddingVertical: space.xs },
      tile: {
        width: TILE_WIDTH,
        padding: space.sm,
        borderRadius: radii.lg,
        backgroundColor: palette.surfaceElevated,
        borderWidth: 1,
        borderColor: palette.border,
        alignItems: "center",
        gap: 4,
      },
      name: {
        ...typography.bodySm,
        color: palette.text,
        fontWeight: "700",
        textAlign: "center",
        marginTop: 2,
        minHeight: 34,
      },
      bookAgainRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginTop: 2,
        paddingHorizontal: space.xs,
        paddingVertical: 4,
        borderRadius: radii.pill,
        backgroundColor: palette.brandAccentSubtle,
      },
      bookAgainText: { ...typography.caption, color: palette.brandNavy, fontWeight: "700", fontSize: 11 },
    })
  );
}
