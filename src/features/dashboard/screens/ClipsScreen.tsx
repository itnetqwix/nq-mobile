import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { EmptyState, ImageWithSkeleton } from "../../../components/ui";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { getClipPlaybackUrl, getClipThumbnailUrl } from "../../../lib/clipMediaUrl";
import {
  postLibraryClipsGrouped,
  postMyClipsGrouped,
  postSharedClipsGrouped,
} from "../../home/api/homeApi";
import type {
  LockerClip,
  NestedCategoryGroup,
  SharedClipsGroup,
} from "../../clips/api/clipsApi";
import { LockerListShell } from "../components/locker/LockerListShell";
import { LockerViewerModal, type LockerViewerMode } from "../components/locker/LockerViewerModal";
import { ClipUploadModal } from "../components/locker/ClipUploadModal";
import { LibrarySubmissionSheet } from "../../clips/components/LibrarySubmissionSheet";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { queryKeys } from "../../../lib/queryKeys";
import { dedupeClipsById } from "../../../lib/lists/clipListUtils";

type ClipTab = "mine" | "shared" | "library";

function CategorySection({
  title,
  count,
  children,
  defaultOpen,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const c = useThemeColors();
  const [open, setOpen] = useState(defaultOpen === true);
  const styles = useThemedStyles((palette) =>
    StyleSheet.create({
      section: {
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: palette.border,
        overflow: "hidden",
        marginBottom: space.sm,
      },
      sectionHead: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: space.md,
        paddingVertical: 12,
        backgroundColor: palette.surfaceMuted,
      },
      sectionHeadLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
      sectionIcon: {
        width: 32,
        height: 32,
        borderRadius: radii.sm,
        backgroundColor: palette.brandSubtle,
        alignItems: "center",
        justifyContent: "center",
      },
      sectionTitle: { flex: 1, ...typography.titleSm, color: palette.text },
      countPill: {
        backgroundColor: palette.brandNavy,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: radii.pill,
      },
      countPillText: { color: palette.brandTextOn, fontSize: 11, fontWeight: "700" },
      sectionBody: { paddingHorizontal: space.sm, paddingBottom: space.sm },
      nestedSection: {
        marginTop: space.xs,
        marginLeft: space.sm,
        borderLeftWidth: 2,
        borderLeftColor: palette.border,
        paddingLeft: space.sm,
      },
      nestedTitle: { ...typography.caption, color: palette.textMuted, marginVertical: 6, fontWeight: "600" },
    })
  );

  return (
    <View style={styles.section}>
      <Pressable style={styles.sectionHead} onPress={() => setOpen(!open)}>
        <View style={styles.sectionHeadLeft}>
          <View style={styles.sectionIcon}>
            <Ionicons name="folder-outline" size={16} color={c.iconPrimary} />
          </View>
          <Text style={styles.sectionTitle} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{count}</Text>
          </View>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={20} color={c.textMuted} />
      </Pressable>
      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

function NestedTaxonomySections({
  groups,
  renderClipRow,
  uncategorizedLabel,
}: {
  groups: NestedCategoryGroup[];
  renderClipRow: (clip: LockerClip, key: string) => React.ReactNode;
  uncategorizedLabel: string;
}) {
  const styles = useThemedStyles((palette) =>
    StyleSheet.create({
      nestedSection: {
        marginTop: space.xs,
        marginLeft: space.sm,
        borderLeftWidth: 2,
        borderLeftColor: palette.border,
        paddingLeft: space.sm,
      },
      nestedTitle: { ...typography.caption, color: palette.textMuted, marginVertical: 6, fontWeight: "600" },
    })
  );

  if (groups.length === 0) return null;

  return (
    <>
      {groups.map((cat, ci) => {
        const catTitle = cat.categoryName || uncategorizedLabel;
        const totalClips = cat.subcategories.reduce((n, s) => n + s.clips.length, 0);
        return (
          <CategorySection
            key={`cat-${cat.categoryId ?? ci}`}
            title={catTitle}
            count={totalClips}
            defaultOpen={ci === 0}
          >
            {cat.subcategories.map((sub, si) => {
              const clips = dedupeClipsById(sub.clips);
              if (clips.length === 0) return null;
              return (
                <View key={`sub-${sub.subcategoryId ?? si}`} style={styles.nestedSection}>
                  <Text style={styles.nestedTitle}>{sub.subcategoryName}</Text>
                  {clips.map((clip, clipIdx) =>
                    renderClipRow(clip, `clip-${ci}-${si}-${String(clip._id ?? clipIdx)}`)
                  )}
                </View>
              );
            })}
          </CategorySection>
        );
      })}
    </>
  );
}

function libraryStatusChip(status: string, t: (k: string) => string): string | null {
  switch (status) {
    case "submitted":
      return t("locker.libraryStatusSubmitted");
    case "under_review":
      return t("locker.libraryStatusUnderReview");
    case "accepted":
      return t("locker.libraryStatusAccepted");
    case "rejected":
      return t("locker.libraryStatusRejected");
    default:
      return null;
  }
}

export function ClipsScreen() {
  const { t } = useAppTranslation();
  const queryClient = useQueryClient();
  const navigation = useNavigation<any>();
  const c = useThemeColors();
  const [tab, setTab] = useState<ClipTab>("mine");
  const [uploadVisible, setUploadVisible] = useState(false);
  const [librarySheetClip, setLibrarySheetClip] = useState<LockerClip | null>(null);
  const [viewer, setViewer] = useState<{
    uri: string;
    title: string;
    mode: LockerViewerMode;
    sharedBy?: string;
  } | null>(null);

  const styles = useThemedStyles((palette) =>
    StyleSheet.create({
      toolbarRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
      segment: {
        flex: 1,
        flexDirection: "row",
        padding: 4,
        borderRadius: radii.md,
        backgroundColor: palette.surfaceMuted,
        gap: 2,
      },
      segBtn: { flex: 1, paddingVertical: 8, borderRadius: radii.sm, alignItems: "center" },
      segBtnOn: { backgroundColor: palette.surfaceElevated },
      segLabel: { ...typography.label, color: palette.textMuted, fontSize: 11 },
      segLabelOn: { color: palette.brandNavy, fontWeight: "700" },
      uploadFab: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: palette.brandNavy,
        alignItems: "center",
        justifyContent: "center",
      },
      submissionsBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: palette.surfaceElevated,
        borderWidth: 1,
        borderColor: palette.borderSubtle,
        alignItems: "center",
        justifyContent: "center",
      },
      clipCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        paddingVertical: 10,
        paddingHorizontal: space.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: palette.border,
      },
      thumbWrap: {
        width: 64,
        height: 64,
        borderRadius: radii.sm,
        overflow: "hidden",
        backgroundColor: palette.surfaceMuted,
      },
      thumbPh: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: palette.brandSubtle,
      },
      clipMeta: { flex: 1, minWidth: 0 },
      clipTitle: { ...typography.bodyMd, fontWeight: "600", color: palette.text },
      clipDate: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
      libChip: {
        alignSelf: "flex-start",
        marginTop: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: radii.pill,
        backgroundColor: palette.brandSubtle,
      },
      libChipText: { fontSize: 10, fontWeight: "700", color: palette.brandNavy },
      libAction: { padding: 4 },
    })
  );

  const myQ = useQuery({
    queryKey: queryKeys.locker.myClips,
    queryFn: () => postMyClipsGrouped({}),
    enabled: tab === "mine",
    staleTime: 30_000,
  });

  const sharedQ = useQuery({
    queryKey: queryKeys.locker.sharedClips,
    queryFn: () => postSharedClipsGrouped(),
    enabled: tab === "shared",
    staleTime: 30_000,
  });

  const libraryQ = useQuery({
    queryKey: queryKeys.locker.libraryClips,
    queryFn: () => postLibraryClipsGrouped(),
    enabled: tab === "library",
    staleTime: 30_000,
  });

  const active = tab === "mine" ? myQ : tab === "shared" ? sharedQ : libraryQ;

  const onRefresh = useCallback(() => {
    void myQ.refetch();
    void sharedQ.refetch();
    void libraryQ.refetch();
  }, [myQ, sharedQ, libraryQ]);

  const openClip = (clip: Record<string, unknown>) => {
    const uri = getClipPlaybackUrl(clip);
    if (!uri) return;
    const sharer = clip.sharer as Record<string, unknown> | undefined;
    const sharerName =
      sharer?.fullname ?? sharer?.fullName ?? clip.shared_by_name ?? null;
    setViewer({
      uri,
      title: String(clip?.title ?? clip?.file_name ?? t("locker.clipDefault")),
      mode: "video",
      sharedBy: sharerName ? String(sharerName) : undefined,
    });
  };

  const toolbar = useMemo(
    () => (
      <View style={styles.toolbarRow}>
        <View style={styles.segment}>
          <Pressable
            style={[styles.segBtn, tab === "mine" && styles.segBtnOn]}
            onPress={() => setTab("mine")}
          >
            <Text style={[styles.segLabel, tab === "mine" && styles.segLabelOn]}>
              {t("locker.myClips")}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.segBtn, tab === "shared" && styles.segBtnOn]}
            onPress={() => setTab("shared")}
          >
            <Text style={[styles.segLabel, tab === "shared" && styles.segLabelOn]}>
              {t("locker.sharedClips")}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.segBtn, tab === "library" && styles.segBtnOn]}
            onPress={() => setTab("library")}
          >
            <Text style={[styles.segLabel, tab === "library" && styles.segLabelOn]}>
              {t("locker.netqwixLibrary")}
            </Text>
          </Pressable>
        </View>
        {tab === "mine" ? (
          <>
            <Pressable
              style={({ pressed }) => [styles.submissionsBtn, pressed && { opacity: 0.88 }]}
              onPress={() => {
                try {
                  navigation.navigate("ShellSurface", {
                    surfaceId: "clipSubmissions",
                  });
                } catch {
                  /* older navigators - best-effort */
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={t("locker.openSubmissions", {
                defaultValue: "View my library submissions",
              })}
            >
              <Ionicons name="library-outline" size={20} color={c.brandNavy} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.uploadFab, pressed && { opacity: 0.88 }]}
              onPress={() => setUploadVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={t("locker.uploadClip")}
            >
              <Ionicons name="cloud-upload-outline" size={20} color={c.brandTextOn} />
            </Pressable>
          </>
        ) : null}
      </View>
    ),
    [tab, styles, c, t, navigation]
  );

  const renderClipRow = (
    clip: LockerClip,
    key: string,
    opts?: { showSharer?: boolean; showLibraryActions?: boolean }
  ) => {
    const thumb = getClipThumbnailUrl(clip);
    const sub = clip.librarySubmission;
    const statusText = sub?.status ? libraryStatusChip(sub.status, t) : null;
    const canRequestLibrary =
      opts?.showLibraryActions &&
      (!sub || sub.status === "rejected") &&
      sub?.status !== "accepted";

    return (
      <Pressable key={key} style={styles.clipCard} onPress={() => openClip(clip)}>
        <View style={styles.thumbWrap}>
          {thumb ? (
            <ImageWithSkeleton
              uri={thumb}
              width={64}
              height={64}
              borderRadius={radii.sm}
              resizeMode="cover"
              accessibilityLabel={String(clip.title ?? clip.file_name ?? t("locker.clipDefault"))}
            />
          ) : (
            <View style={styles.thumbPh}>
              <Ionicons name="play-circle" size={28} color={c.brandAccent} />
            </View>
          )}
        </View>
        <View style={styles.clipMeta}>
          <Text style={styles.clipTitle} numberOfLines={2}>
            {String(clip.title ?? clip.file_name ?? t("locker.clipDefault"))}
          </Text>
          {opts?.showSharer ? (
            <Text style={styles.clipDate} numberOfLines={1}>
              {t("locker.sharedBy", {
                name: String(
                  (clip.sharer as any)?.fullname ??
                    (clip.sharer as any)?.fullName ??
                    t("locker.friendDefault")
                ),
              })}
            </Text>
          ) : null}
          {statusText ? (
            <View style={styles.libChip}>
              <Text style={styles.libChipText}>{statusText}</Text>
            </View>
          ) : null}
          {clip.createdAt || clip.shared_at ? (
            <Text style={styles.clipDate}>
              {new Date(String(clip.shared_at ?? clip.createdAt)).toLocaleDateString()}
            </Text>
          ) : null}
        </View>
        {canRequestLibrary ? (
          <Pressable
            style={styles.libAction}
            onPress={(e) => {
              e.stopPropagation?.();
              setLibrarySheetClip(clip);
            }}
            hitSlop={8}
          >
            <Ionicons name="library-outline" size={20} color={c.brandNavy} />
          </Pressable>
        ) : (
          <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
        )}
      </Pressable>
    );
  };

  const myGroups = (myQ.data ?? []) as NestedCategoryGroup[];
  const sharedGroups = (sharedQ.data ?? []) as SharedClipsGroup[];
  const libraryGroups = (libraryQ.data ?? []) as NestedCategoryGroup[];

  return (
    <>
      <LockerListShell
        loading={active.isLoading}
        isError={active.isError}
        error={active.error}
        onRetry={() => void active.refetch()}
        refreshing={active.isRefetching}
        onRefresh={onRefresh}
        toolbar={toolbar}
      >
        {tab === "mine" && (
          <>
            {myGroups.length === 0 ? (
              <EmptyState
                icon="film-outline"
                title={t("locker.noClips")}
                description={t("locker.noClipsDescription")}
                actionLabel={t("locker.uploadClip")}
                onAction={() => setUploadVisible(true)}
              />
            ) : (
              <NestedTaxonomySections
                groups={myGroups}
                uncategorizedLabel={t("locker.uncategorized")}
                renderClipRow={(clip, key) =>
                  renderClipRow(clip, key, { showLibraryActions: true })
                }
              />
            )}
          </>
        )}

        {tab === "shared" && (
          <>
            {sharedGroups.length === 0 ? (
              <EmptyState
                icon="share-social-outline"
                title={t("locker.noShared")}
                description={t("locker.noSharedDescription")}
              />
            ) : (
              sharedGroups.map((grp, i) => {
                const clips = dedupeClipsById(grp.clips);
                return (
                  <CategorySection
                    key={`shared-${grp.sharerId ?? i}`}
                    title={grp.sharerName || t("locker.friendDefault")}
                    count={clips.length}
                    defaultOpen={i === 0}
                  >
                    {clips.map((clip, ci) =>
                      renderClipRow(clip, `shared-${i}-${String(clip._id ?? ci)}`, {
                        showSharer: false,
                      })
                    )}
                  </CategorySection>
                );
              })
            )}
          </>
        )}

        {tab === "library" && (
          <>
            {libraryGroups.length === 0 ? (
              <EmptyState
                icon="library-outline"
                title={t("locker.noLibraryClips")}
                description={t("locker.noLibraryClipsDescription")}
              />
            ) : (
              <NestedTaxonomySections
                groups={libraryGroups}
                uncategorizedLabel={t("locker.uncategorized")}
                renderClipRow={(clip, key) => renderClipRow(clip, key)}
              />
            )}
          </>
        )}
      </LockerListShell>

      <LockerViewerModal
        visible={!!viewer}
        onClose={() => setViewer(null)}
        uri={viewer?.uri ?? ""}
        title={viewer?.title}
        mode={viewer?.mode ?? "video"}
        sharedBy={viewer?.sharedBy}
      />

      <ClipUploadModal
        visible={uploadVisible}
        onClose={() => setUploadVisible(false)}
        onUploaded={() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.locker.myClips });
          void queryClient.invalidateQueries({ queryKey: queryKeys.instant.lessonClipsAll });
        }}
      />

      <LibrarySubmissionSheet
        visible={!!librarySheetClip}
        clip={librarySheetClip}
        onClose={() => setLibrarySheetClip(null)}
        onSubmitted={() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.locker.myClips });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.clips.mySubmissions,
          });
        }}
      />
    </>
  );
}
