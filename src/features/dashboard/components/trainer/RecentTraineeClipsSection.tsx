import React, { useMemo } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "../../../../components/ui";
import { getClipThumbnailUrl } from "../../../../lib/clipMediaUrl";
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
    const flat: ClipTile[] = [];
    for (const g of groups) {
      const clips = Array.isArray(g.clips) ? g.clips : [];
      for (const c of clips) {
        const created = new Date(String(c.createdAt ?? c.created_at ?? 0)).getTime();
        // Resolve to a full URL via the shared clip-media helper so we get the
        // same S3 prod-bucket handling as the locker grid (the previous
        // `getS3ImageUrl(thumb)` path didn't prepend the bucket for raw keys
        // like `clips/<userId>/<file>.jpg`, so tiles rendered blank).
        const thumbUrl = getClipThumbnailUrl(c);
        flat.push({
          id: String(c._id ?? c.id ?? `${g._id}-${flat.length}`),
          thumbUrl,
          label: String(c.title ?? c.name ?? "Clip"),
          createdAt: Number.isFinite(created) ? created : 0,
        });
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
        {tiles.map((item) => {
          const uri = item.thumbUrl;
          return (
            <Pressable
              key={item.id}
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
