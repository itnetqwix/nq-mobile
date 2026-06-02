import React, { useMemo } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "../../../../components/ui";
import { getS3ImageUrl } from "../../../../lib/imageUtils";
import { postTraineeClipsGrouped } from "../../../home/api/homeApi";
import { queryKeys } from "../../../../lib/queryKeys";
import { DashboardSection } from "../shared/DashboardSection";
import { radii, space, typography, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";

type ClipTile = {
  id: string;
  thumb?: string;
  label: string;
  createdAt: number;
};

type Props = {
  onOpenClips: () => void;
};

/** API groups clips by trainee; each row is a booking with nested `clips` (see web locker). */
function clipFromTraineeRow(row: unknown): Omit<ClipTile, "createdAt"> & { createdAt: number } | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const clip =
    r.clips && typeof r.clips === "object" && !Array.isArray(r.clips)
      ? (r.clips as Record<string, unknown>)
      : r;
  const id = String(clip._id ?? clip.id ?? r._id ?? "");
  if (!id) return null;
  const created = new Date(
    String(clip.createdAt ?? clip.created_at ?? r.createdAt ?? r.created_at ?? 0)
  ).getTime();
  const thumb = (clip.thumbnail ?? clip.thumb ?? clip.poster ?? clip.url) as string | undefined;
  const trainee = r.clip_user as Record<string, unknown> | undefined;
  const traineeName =
    trainee && typeof trainee === "object"
      ? String(trainee.fullname ?? trainee.fullName ?? "").trim()
      : "";
  const label = String(
    clip.title ?? clip.name ?? (traineeName ? `${traineeName}'s clip` : "Clip")
  );
  return {
    id,
    thumb,
    label,
    createdAt: Number.isFinite(created) ? created : 0,
  };
}

export function RecentTraineeClipsSection({ onOpenClips }: Props) {
  const { t } = useAppTranslation();
  const styles = useStyles();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.trainerRole.recentTraineeClips,
    queryFn: postTraineeClipsGrouped,
    staleTime: 120_000,
  });

  const tiles = useMemo(() => {
    const groups = Array.isArray(data) ? data : [];
    const flat: ClipTile[] = [];
    const seen = new Set<string>();
    for (const g of groups) {
      const rows = Array.isArray(g.clips) ? g.clips : [];
      for (const row of rows) {
        const tile = clipFromTraineeRow(row);
        if (!tile || seen.has(tile.id)) continue;
        seen.add(tile.id);
        flat.push(tile);
      }
    }
    return flat.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
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
          const uri = getS3ImageUrl(item.thumb);
          return (
            <Pressable
              key={`${item.id}-${index}`}
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
