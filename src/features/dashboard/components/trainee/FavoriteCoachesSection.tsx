import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CoachCarouselSkeleton } from "../../../../components/ui";
import { getTrainerName } from "../../../bookexpert/lib/trainerUtils";
import { trainerListItemKey } from "../../../../lib/lists/trainerListUtils";
import { useFavoriteTrainers } from "../../hooks/useFavoriteTrainers";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { HomeUserAvatar } from "../home/HomeUserAvatar";

const TILE_WIDTH = 136;
const AVATAR_SIZE = 58;

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
          return (
            <Pressable
              key={trainerListItemKey(item, i, "fav-")}
              style={({ pressed }) => [styles.tile, pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] }]}
              onPress={() => onSelectTrainer(item)}
              accessibilityRole="button"
            >
              <View style={styles.avatarWrap}>
                <HomeUserAvatar uri={item.profile_picture as string} name={name} size={AVATAR_SIZE} />
                <View style={[styles.heartBadge, { backgroundColor: c.surfaceElevated }]}>
                  <Ionicons name="heart" size={8} color="#E57373" />
                </View>
              </View>
              <Text style={styles.name} numberOfLines={2}>{name}</Text>
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
      avatarWrap: { position: "relative" },
      heartBadge: {
        position: "absolute",
        right: -2,
        bottom: -2,
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 1.5,
        borderColor: "#E57373",
        alignItems: "center",
        justifyContent: "center",
      },
      name: {
        ...typography.bodySm,
        color: palette.text,
        fontWeight: "700",
        textAlign: "center",
        marginTop: 2,
        minHeight: 34,
      },
    })
  );
}
