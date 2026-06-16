import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { CoachCarouselSkeleton } from "../../../../components/ui";
import { getTrainerName } from "../../../bookexpert/lib/trainerUtils";
import { trainerListItemKey } from "../../../../lib/lists/trainerListUtils";
import { useFavoriteTrainers } from "../../hooks/useFavoriteTrainers";
import { space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { DashboardPersonTile } from "../shared/DashboardPersonTile";

type Props = {
  onSelectTrainer: (trainer: Record<string, unknown>) => void;
};

export function FavoriteCoachesSection({ onSelectTrainer }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();
  const { favorites, isLoading } = useFavoriteTrainers(true);

  if (isLoading) {
    return (
      <View style={styles.wrap}>
        <CoachCarouselSkeleton count={3} variant="favorite" showHeader />
      </View>
    );
  }

  if (!favorites.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Ionicons name="heart" size={15} color="#E57373" />
        <Text style={styles.title}>{t("traineeDiscover.favoriteCoaches")}</Text>
      </View>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {favorites.map((item, i) => {
          const name = getTrainerName(item);
          const online = item.is_online === true;
          return (
            <DashboardPersonTile
              key={trainerListItemKey(item, i, "fav-")}
              name={name}
              avatar={item.profile_picture as string | undefined}
              onPress={() => onSelectTrainer(item)}
              useHomeAvatar
              onlineStatus={online ? "online" : undefined}
              badge={
                <View style={[styles.heartBadge, { backgroundColor: c.surfaceElevated }]}>
                  <Ionicons name="heart" size={8} color="#E57373" />
                </View>
              }
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
      wrap: { marginBottom: space.sm },
      headerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.xs,
        marginBottom: space.md,
      },
      title: { ...typography.titleSm, color: palette.text, fontWeight: "700" },
      strip: { gap: space.md, paddingVertical: space.sm, paddingRight: space.sm },
      heartBadge: {
        position: "absolute",
        right: -2,
        bottom: -2,
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: "#E57373",
        alignItems: "center",
        justifyContent: "center",
      },
    })
  );
}
