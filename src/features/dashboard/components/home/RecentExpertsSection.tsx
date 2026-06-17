import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { CoachCarouselSkeleton } from "../../../../components/ui";
import { getTrainerId, getTrainerName } from "../../../bookexpert/lib/trainerUtils";
import { fetchRecentTrainers } from "../../../home/api/homeApi";
import { trainerListItemKey } from "../../../../lib/lists/trainerListUtils";
import { queryKeys } from "../../../../lib/queryKeys";
import { space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { useAuth } from "../../../auth/context/AuthContext";
import { getRecentTrainers, type RecentTrainerRow } from "../../lib/recentlyViewedTrainers";
import { useTrainerOnlineLookup } from "../../hooks/useTrainerOnlineLookup";
import { DashboardPersonTile } from "../shared/DashboardPersonTile";

type ExpertRow = {
  id: string;
  name: string;
  profile_picture?: string;
  is_online?: boolean;
  source: Record<string, unknown>;
};

type Props = {
  onSelectTrainer: (trainer: Record<string, unknown>) => void;
};

function mergeExperts(
  booked: Record<string, unknown>[],
  viewed: RecentTrainerRow[]
): ExpertRow[] {
  const seen = new Set<string>();
  const rows: ExpertRow[] = [];

  for (const item of booked) {
    const id = getTrainerId(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    rows.push({
      id,
      name: getTrainerName(item),
      profile_picture: item.profile_picture as string | undefined,
      is_online: item.is_online as boolean | undefined,
      source: item,
    });
  }

  for (const item of viewed) {
    if (!item._id || seen.has(item._id)) continue;
    seen.add(item._id);
    rows.push({
      id: item._id,
      name: item.name,
      profile_picture: item.profile_picture,
      source: item as unknown as Record<string, unknown>,
    });
  }

  return rows.slice(0, 12);
}

export function RecentExpertsSection({ onSelectTrainer }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();
  const { user } = useAuth();
  const userId = user?._id != null ? String(user._id) : null;
  const [viewed, setViewed] = useState<RecentTrainerRow[]>([]);

  const { data: booked = [], isLoading } = useQuery({
    queryKey: queryKeys.presence.recentTrainers,
    queryFn: fetchRecentTrainers,
    staleTime: 120_000,
  });

  const { isTrainerOnline } = useTrainerOnlineLookup();

  const loadViewed = useCallback(async () => {
    setViewed(await getRecentTrainers(userId));
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void loadViewed();
    }, [loadViewed])
  );

  const experts = useMemo(() => {
    const merged = mergeExperts(booked, viewed);
    return merged.map((row) => ({
      ...row,
      is_online: row.is_online || isTrainerOnline(row.id),
    }));
  }, [booked, viewed, isTrainerOnline]);

  if (isLoading) {
    return (
      <View style={styles.wrap}>
        <CoachCarouselSkeleton count={3} variant="pastBooked" showHeader />
      </View>
    );
  }

  if (!experts.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Ionicons name="time-outline" size={15} color={c.textSecondary} />
        <Text style={styles.title}>
          {t("traineeDiscover.recentExperts", { defaultValue: "Recent Experts" })}
        </Text>
      </View>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {experts.map((item, i) => (
          <DashboardPersonTile
            key={trainerListItemKey(item.source, i, "recent-expert-")}
            name={item.name}
            avatar={item.profile_picture}
            onPress={() => onSelectTrainer(item.source)}
            useHomeAvatar
            onlineStatus={item.is_online ? "online" : undefined}
            showLiveIllumination
          />
        ))}
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
    })
  );
}
