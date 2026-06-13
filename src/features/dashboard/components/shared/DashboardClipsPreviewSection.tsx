import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { ClipTileSkeleton, ImageWithSkeleton } from "../../../../components/ui";
import { getClipThumbnailUrl } from "../../../../lib/clipMediaUrl";
import { flattenNestedClipsForPicker } from "../../../../lib/lists/clipListUtils";
import { queryKeys } from "../../../../lib/queryKeys";
import { postMyClipsGrouped } from "../../../home/api/homeApi";
import type { NestedCategoryGroup } from "../../../clips/api/clipsApi";
import { radii, space, typography, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { DashboardSection } from "./DashboardSection";

const PREVIEW_COUNT = 9;
const COLS = 3;

type Props = {
  onViewMore: () => void;
};

export function DashboardClipsPreviewSection({ onViewMore }: Props) {
  const { t } = useAppTranslation();
  const styles = useStyles();
  const { width: screenWidth } = useWindowDimensions();
  const cellWidth = Math.floor((screenWidth - space.md * 2 - space.sm * 2) / COLS);
  const thumbHeight = Math.round(cellWidth * 0.62);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.locker.myClips,
    queryFn: () => postMyClipsGrouped(),
    staleTime: 120_000,
  });

  const clips = useMemo(() => {
    const groups = (data ?? []) as NestedCategoryGroup[];
    return flattenNestedClipsForPicker(groups).slice(0, PREVIEW_COUNT);
  }, [data]);

  const totalCount = useMemo(() => {
    const groups = (data ?? []) as NestedCategoryGroup[];
    return flattenNestedClipsForPicker(groups).length;
  }, [data]);

  if (isLoading) {
    return (
      <DashboardSection
        embedded
        title={t("dashboardHome.myClips", { defaultValue: "My clips" })}
        testID="home-clips-preview"
      >
        <View style={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={styles.cell}>
              <ClipTileSkeleton />
            </View>
          ))}
        </View>
      </DashboardSection>
    );
  }

  if (clips.length === 0) {
    return (
      <DashboardSection
        embedded
        title={t("dashboardHome.myClips", { defaultValue: "My clips" })}
        testID="home-clips-preview"
      >
        <Pressable style={styles.empty} onPress={onViewMore}>
          <Ionicons name="film-outline" size={28} color={styles.emptyIcon.color} />
          <Text style={styles.emptyText}>
            {t("dashboardHome.clipsEmpty", { defaultValue: "Upload clips to your locker" })}
          </Text>
          <Text style={styles.emptyCta}>
            {t("dashboardHome.openClips", { defaultValue: "Open clips" })}
          </Text>
        </Pressable>
      </DashboardSection>
    );
  }

  const showViewMore = totalCount > PREVIEW_COUNT;

  return (
    <DashboardSection
      embedded
      title={t("dashboardHome.myClips", { defaultValue: "My clips" })}
      action={
        <Pressable onPress={onViewMore} hitSlop={8}>
          <Text style={styles.link}>
            {showViewMore
              ? t("dashboardHome.viewMoreClips", { defaultValue: "View more" })
              : t("dashboardHome.openClips", { defaultValue: "Open clips" })}
          </Text>
        </Pressable>
      }
      testID="home-clips-preview"
    >
      <View style={styles.grid}>
        {clips.map((clip, index) => {
          const thumb = getClipThumbnailUrl(clip);
          const title = String(clip.title ?? clip.name ?? clip.file_name ?? t("locker.clipDefault"));
          return (
            <Pressable
              key={`${clip._id}-${index}`}
              style={({ pressed }) => [styles.cell, { width: cellWidth }, pressed && { opacity: 0.88 }]}
              onPress={onViewMore}
              accessibilityRole="button"
              accessibilityLabel={title}
            >
              {thumb ? (
                <ImageWithSkeleton
                  uri={thumb}
                  width={cellWidth}
                  height={thumbHeight}
                  borderRadius={radii.md}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.thumbFallback, { width: cellWidth, height: thumbHeight }]}>
                  <Ionicons name="play-circle-outline" size={26} color={styles.playIcon.color} />
                </View>
              )}
              <Text style={styles.caption} numberOfLines={2}>
                {title}
              </Text>
            </Pressable>
          );
        })}
        {clips.length < PREVIEW_COUNT &&
          Array.from({ length: PREVIEW_COUNT - clips.length }).map((_, i) => (
            <View key={`pad-${i}`} style={{ width: cellWidth }} />
          ))}
      </View>
      {showViewMore ? (
        <Pressable
          style={({ pressed }) => [styles.viewMoreBtn, pressed && { opacity: 0.85 }]}
          onPress={onViewMore}
        >
          <Text style={styles.viewMoreText}>
            {t("dashboardHome.viewAllClips", {
              defaultValue: `View all ${totalCount} clips`,
              count: totalCount,
            })}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={styles.viewMoreText.color} />
        </Pressable>
      ) : null}
    </DashboardSection>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: space.sm,
      },
      cell: {},
      thumbFallback: {
        borderRadius: radii.md,
        backgroundColor: palette.surfaceMuted,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: palette.border,
      },
      playIcon: { color: palette.brandAccent },
      caption: {
        ...typography.caption,
        color: palette.text,
        marginTop: 4,
        fontWeight: "600",
        lineHeight: 15,
      },
      link: { ...typography.caption, color: palette.brandNavy, fontWeight: "700" },
      empty: {
        alignItems: "center",
        paddingVertical: space.lg,
        gap: space.xs,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surfaceElevated,
      },
      emptyIcon: { color: palette.textMuted },
      emptyText: { ...typography.bodySm, color: palette.textMuted, textAlign: "center" },
      emptyCta: { ...typography.label, color: palette.brandNavy, fontWeight: "700" },
      viewMoreBtn: {
        marginTop: space.sm,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        paddingVertical: space.sm,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surfaceElevated,
      },
      viewMoreText: { ...typography.label, color: palette.brandNavy, fontWeight: "700" },
    })
  );
}
