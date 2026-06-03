import React from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { CoachCarouselSkeleton } from "../../../../components/ui";
import { getTrainerName } from "../../../bookexpert/lib/trainerUtils";
import { trainerListItemKey } from "../../../../lib/lists/trainerListUtils";
import { useFavoriteTrainers } from "../../hooks/useFavoriteTrainers";
import { radii, space, typography, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { DashboardSection } from "../shared/DashboardSection";
import { HomeUserAvatar } from "../home/HomeUserAvatar";

type Props = {
  onSelectTrainer: (trainer: Record<string, unknown>) => void;
};

export function FavoriteCoachesSection({ onSelectTrainer }: Props) {
  const { t } = useAppTranslation();
  const styles = useStyles();
  const { favorites, isLoading } = useFavoriteTrainers(true);

  if (isLoading) {
    return (
      <DashboardSection title={t("traineeDiscover.favoriteCoaches")}>
        <CoachCarouselSkeleton count={3} variant="favorite" showHeader={false} />
      </DashboardSection>
    );
  }

  if (!favorites.length) return null;

  return (
    <DashboardSection title={t("traineeDiscover.favoriteCoaches")}>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {favorites.map((item, i) => {
          const name = getTrainerName(item);
          return (
            <Pressable
              key={trainerListItemKey(item, i, "fav-")}
              style={({ pressed }) => [styles.tile, pressed && { opacity: 0.9 }]}
              onPress={() => onSelectTrainer(item)}
            >
              <HomeUserAvatar uri={item.profile_picture as string} name={name} size={52} />
              <Text style={styles.name} numberOfLines={2}>
                {name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </DashboardSection>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      strip: { gap: space.sm },
      tile: {
        width: 96,
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
      },
    })
  );
}
