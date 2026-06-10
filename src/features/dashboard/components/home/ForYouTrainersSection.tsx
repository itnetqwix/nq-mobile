import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CoachCarouselSkeleton } from "../../../../components/ui";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { queryKeys } from "../../../../lib/queryKeys";
import { trainerListItemKey } from "../../../../lib/lists/trainerListUtils";
import { radii, space, typography, useThemedStyles, useThemeColors } from "../../../../theme";
import {
  getTrainerAvgRating,
  getTrainerHourlyRate,
  getTrainerName,
} from "../../../bookexpert/lib/trainerUtils";
import {
  fetchPersonalizedFeed,
  type PersonalizedFeedRow,
  type PersonalizedReason,
} from "../../../home/api/homeApi";
import { HomeUserAvatar } from "./HomeUserAvatar";

const TILE_WIDTH = 136;
const AVATAR_SIZE = 58;

type Props = {
  recentTrainerIds: string[];
  onSelectTrainer: (trainer: Record<string, unknown>) => void;
  enabled?: boolean;
};

export function ForYouTrainersSection({
  recentTrainerIds,
  onSelectTrainer,
  enabled = true,
}: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();

  const cappedRecentIds = useMemo(
    () => recentTrainerIds.slice(0, 8),
    [recentTrainerIds]
  );

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.presence.personalizedFeed(cappedRecentIds),
    queryFn: () =>
      fetchPersonalizedFeed({ limit: 12, recentTrainerIds: cappedRecentIds }),
    enabled,
    staleTime: 120_000,
  });

  const reasoningById = useMemo(() => {
    const map = new Map<string, PersonalizedFeedRow>();
    for (const row of data?.reasoning ?? []) {
      map.set(String(row.trainer_id), row);
    }
    return map;
  }, [data?.reasoning]);

  if (isLoading) {
    return <CoachCarouselSkeleton count={3} variant="forYou" showHeader />;
  }

  const trainers = data?.for_you ?? [];
  if (!trainers.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Ionicons name="sparkles" size={15} color={c.brandAccent} />
        <Text style={styles.title}>{t("traineeDiscover.forYouTitle")}</Text>
      </View>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {trainers.map((trainer: any, i: number) => {
          const id = String(trainer?._id ?? "");
          const meta = reasoningById.get(id);
          const name = getTrainerName(trainer) || "Coach";
          const rate = getTrainerHourlyRate(trainer);
          const rating = getTrainerAvgRating(trainer);
          const reason = formatReason(t, meta);
          const isOnline = Boolean(trainer.is_online);
          return (
            <Pressable
              key={trainerListItemKey(trainer, i, "foryou-")}
              style={({ pressed }) => [styles.tile, pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] }]}
              onPress={() => onSelectTrainer(trainer)}
              accessibilityRole="button"
              accessibilityLabel={t("traineeDiscover.forYouTileA11y", { name })}
            >
              <View style={styles.avatarWrap}>
                <HomeUserAvatar uri={trainer?.profile_picture as string} name={name} size={AVATAR_SIZE} />
                {isOnline ? (
                  <View style={[styles.onlineDot, { backgroundColor: c.success, borderColor: c.surfaceElevated }]} />
                ) : null}
              </View>
              <Text style={styles.name} numberOfLines={2}>{name}</Text>
              {rating != null ? (
                <View style={styles.metaRow}>
                  <Ionicons name="star" size={11} color={c.warning} />
                  <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
                  {rate != null ? (
                    <Text style={styles.rateText}>· ${rate.toFixed(0)}/hr</Text>
                  ) : null}
                </View>
              ) : rate != null ? (
                <Text style={styles.rateText}>${rate.toFixed(0)}/hr</Text>
              ) : null}
              {reason ? (
                <View style={[styles.reasonChip, { borderColor: c.brandAccentBorder, backgroundColor: c.brandAccentSubtle }]}>
                  <Ionicons name={reasonIcon(meta?.primary_reason)} size={10} color={c.brandAccent} />
                  <Text style={[styles.reasonText, { color: c.brandAccent }]} numberOfLines={2}>{reason}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function reasonIcon(primary: PersonalizedReason | undefined): keyof typeof Ionicons.glyphMap {
  switch (primary) {
    case "past_session_repeat": return "refresh-outline";
    case "past_session_same_category": return "albums-outline";
    case "guest_favorite": return "heart";
    case "guest_view":
    case "recently_viewed": return "eye-outline";
    case "online_now": return "radio";
    default: return "sparkles-outline";
  }
}

function formatReason(
  t: (key: string, opts?: Record<string, unknown>) => string,
  meta: PersonalizedFeedRow | undefined
): string {
  if (!meta) return "";
  const primary = meta.primary_reason ?? meta.reasons[0];
  switch (primary) {
    case "past_session_repeat":
      return meta.repeat_count > 1
        ? t("traineeDiscover.forYouReason.repeatN", { n: meta.repeat_count })
        : t("traineeDiscover.forYouReason.repeat1");
    case "past_session_same_category": return t("traineeDiscover.forYouReason.sameCategory");
    case "guest_favorite": return t("traineeDiscover.forYouReason.guestFavorite");
    case "guest_view": return t("traineeDiscover.forYouReason.guestView");
    case "recently_viewed": return t("traineeDiscover.forYouReason.recentlyViewed");
    case "online_now": return t("traineeDiscover.forYouReason.onlineNow");
    default: return t("traineeDiscover.forYouReason.matchYourTaste");
  }
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      wrap: { marginBottom: space.md },
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
      onlineDot: {
        position: "absolute",
        right: -1,
        bottom: -1,
        width: 13,
        height: 13,
        borderRadius: 7,
        borderWidth: 2,
      },
      name: {
        ...typography.bodySm,
        color: palette.text,
        fontWeight: "700",
        textAlign: "center",
        marginTop: 2,
        minHeight: 34,
      },
      metaRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        justifyContent: "center",
      },
      ratingText: { ...typography.caption, color: palette.text, fontWeight: "700" },
      rateText: { ...typography.caption, color: palette.textMuted, fontWeight: "600", textAlign: "center" },
      reasonChip: {
        marginTop: 4,
        borderWidth: 1,
        borderRadius: radii.pill,
        paddingHorizontal: 8,
        paddingVertical: 4,
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        alignSelf: "stretch",
      },
      reasonText: { fontSize: 10, fontWeight: "700", flex: 1, lineHeight: 13 },
    })
  );
}
