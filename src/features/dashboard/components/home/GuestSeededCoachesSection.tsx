import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CoachCarouselSkeleton, Skeleton } from "../../../../components/ui";
import { getTrainerName } from "../../../bookexpert/lib/trainerUtils";
import { trainerListItemKey } from "../../../../lib/lists/trainerListUtils";
import {
  getRecentTrainers,
  type RecentTrainerRow,
} from "../../lib/recentlyViewedTrainers";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { HomeUserAvatar } from "./HomeUserAvatar";

const TILE_WIDTH = 136;
const AVATAR_SIZE = 58;

type Props = {
  onSelectTrainer: (trainer: Record<string, unknown>) => void;
};

/**
 * Guest-only carousel — reads locally cached coach profiles the visitor opened
 * while browsing. Does not call the authenticated trainee API (that endpoint
 * is for signed-in users after guest-activity replay).
 */
export function GuestSeededCoachesSection({ onSelectTrainer }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();
  const [trainers, setTrainers] = useState<RecentTrainerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void getRecentTrainers(null).then((rows) => {
      if (!alive) return;
      setTrainers(rows);
      setIsLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (isLoading) {
    return (
      <View style={styles.wrap}>
        <Skeleton width={160} height={14} style={{ marginBottom: space.sm }} />
        <CoachCarouselSkeleton count={3} variant="guestSeeded" showHeader={false} />
      </View>
    );
  }

  if (!trainers.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Ionicons name="eye-outline" size={15} color={c.textSecondary} />
        <Text style={styles.title}>{t("traineeDiscover.guestSeededTitle")}</Text>
      </View>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {trainers.map((item, i) => {
          const name = item.name || getTrainerName(item);
          const trainerRow: Record<string, unknown> = {
            _id: item._id,
            fullname: name,
            profile_picture: item.profile_picture,
            category: item.category,
            hourly_rate: item.hourly_rate,
          };
          return (
            <Pressable
              key={trainerListItemKey(item, i, "seeded-")}
              style={({ pressed }) => [styles.tile, pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] }]}
              onPress={() => onSelectTrainer(trainerRow)}
              accessibilityRole="button"
              accessibilityLabel={t("traineeDiscover.guestSeededA11y", { name })}
            >
              <HomeUserAvatar uri={item.profile_picture} name={name} size={AVATAR_SIZE} />
              <Text style={styles.name} numberOfLines={2}>{name}</Text>
              <View style={styles.ctaRow}>
                <Ionicons name="sparkles-outline" size={11} color={c.brandNavy} />
                <Text style={styles.ctaText}>{t("traineeDiscover.guestSeededCta")}</Text>
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
      ctaRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginTop: 2,
        paddingHorizontal: space.xs,
        paddingVertical: 4,
        borderRadius: radii.pill,
        backgroundColor: palette.brandAccentSubtle,
      },
      ctaText: { ...typography.caption, color: palette.brandNavy, fontWeight: "700", fontSize: 11 },
    })
  );
}
