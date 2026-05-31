import React, { useMemo } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "../../../../components/ui";
import { getClipThumbnailUrl } from "../../../../lib/clipMediaUrl";
import { listItemKey, rowId } from "../../../../lib/lists/trainerListUtils";
import { postTraineeClipsGrouped } from "../../../home/api/homeApi";
import { DashboardSection } from "../shared/DashboardSection";
import { radii, space, typography, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";

type ClipTile = {
  id: string;
  /** Already-resolved absolute URL (S3 bucket prefix applied for stored keys). */
  thumbUrl: string;
  label: string;
  createdAt: number;
};

type Props = {
  onOpenClips: () => void;
};

export function RecentTraineeClipsSection({ onOpenClips }: Props) {
  const { t } = useAppTranslation();
  const styles = useStyles();
  const { data, isLoading } = useQuery({
    queryKey: ["trainer", "recentTraineeClips"],
    queryFn: postTraineeClipsGrouped,
    staleTime: 120_000,
  });

  const tiles = useMemo(() => {
    const groups = Array.isArray(data) ? data : [];
    const byClipId = new Map<string, ClipTile>();

    for (const g of groups) {
      const rows = Array.isArray(g.clips) ? g.clips : [];
      for (const row of rows) {
        // API rows are bookings with a nested `clips` document (web parity).
        const clip = (row?.clips ?? row) as Record<string, unknown>;
        const clipId = rowId(clip);
        if (!clipId) continue;

        const created = new Date(
          String(
            clip.createdAt ??
              clip.created_at ??
              row?.createdAt ??
              row?.created_at ??
              0
          )
        ).getTime();
        const createdAt = Number.isFinite(created) ? created : 0;
        const thumbUrl = getClipThumbnailUrl(clip);
        const label = String(clip.title ?? clip.name ?? "Clip");

        const existing = byClipId.get(clipId);
        if (existing && existing.createdAt >= createdAt) continue;

        byClipId.set(clipId, { id: clipId, thumbUrl, label, createdAt });
      }
    }

    return Array.from(byClipId.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);
  }, [data]);

  if (isLoading) {
    return (
      <DashboardSection embedded title={t("trainerDashboard.recentClips")}>
        <Skeleton width={120} height={80} radius={radii.md} />
      </DashboardSection>
    );
  }

  if (!tiles.length) return null;

  return (
    <DashboardSection
      embedded
      title={t("trainerDashboard.recentClips")}
      action={
        <Pressable onPress={onOpenClips} hitSlop={8}>
          <Text style={styles.link}>{t("trainerDashboard.seeClips")}</Text>
        </Pressable>
      }
    >
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space.sm }}
      >
        {tiles.map((item, index) => {
          const uri = item.thumbUrl;
          return (
            <Pressable
              key={listItemKey({ _id: item.id }, index, "recent-clip-")}
              style={({ pressed }) => [styles.tile, pressed && { opacity: 0.9 }]}
              onPress={onOpenClips}
            >
              {uri ? (
                <Image source={{ uri }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbFallback]}>
                  <Text style={styles.thumbLetter}>{item.label[0] ?? "?"}</Text>
                </View>
              )}
              <Text style={styles.caption} numberOfLines={1}>
                {item.label}
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
      link: { ...typography.caption, color: palette.brandNavy, fontWeight: "700" },
      tile: { width: 112 },
      thumb: { width: 112, height: 72, borderRadius: radii.md, backgroundColor: palette.border },
      thumbFallback: { alignItems: "center", justifyContent: "center" },
      thumbLetter: { fontSize: 24, fontWeight: "700", color: palette.textMuted },
      caption: { ...typography.caption, color: palette.text, marginTop: 4 },
    })
  );
}
