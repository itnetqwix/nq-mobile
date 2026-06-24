import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { ClipSectionSkeleton, EmptyState, ImageWithSkeleton } from "../../../components/ui";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { getClipPlaybackUrl, getClipThumbnailUrl } from "../../../lib/clipMediaUrl";
import {
  postLibraryClipsGrouped,
  postMyClipsGrouped,
  postSharedClipsGrouped,
} from "../../home/api/homeApi";
import {
  deleteLockerClip,
  type LockerClip,
  type NestedCategoryGroup,
  type SharedClipsGroup,
} from "../../clips/api/clipsApi";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { lockerMutated } from "../../../store/actions/cacheInvalidation";
import { useAppDispatch } from "../../../store/hooks";
import { LockerListShell } from "../components/locker/LockerListShell";
import { LockerViewerModal, type LockerViewerMode, type LockerViewerPlaylistItem } from "../components/locker/LockerViewerModal";
import { ClipUploadModal } from "../components/locker/ClipUploadModal";
import { LibrarySubmissionSheet } from "../../clips/components/LibrarySubmissionSheet";
import { ClipShareFriendsModal } from "../../clips/components/ClipShareFriendsModal";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { queryKeys } from "../../../lib/queryKeys";
import { dedupeClipsById } from "../../../lib/lists/clipListUtils";
import { ClipShareInboxBanner } from "../../clips/components/ClipShareInboxBanner";
import { shareClipExternally } from "../../clips/lib/shareClipExternally";
import { SharedClipInfoSheet } from "../../clips/components/SharedClipInfoSheet";
import { useAuth } from "../../auth/context/AuthContext";
import { AccountType } from "../../../constants/accountType";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { HomeStackParamList } from "../../../navigation/types";
import { openShellSurface } from "../../../navigation/openShellSurface";

type ClipTab = "mine" | "library";

function isSharedClip(clip: Record<string, unknown>): boolean {
  return !!(clip.shared_from_user_id ?? (clip as any).sharedFromUserId);
}

function flattenNestedGroups(groups: NestedCategoryGroup[]): LockerClip[] {
  return groups.flatMap((group) =>
    group.subcategories.flatMap((sub) => dedupeClipsById(sub.clips))
  );
}

function clipToPlaylistItem(
  clip: Record<string, unknown>,
  t: (key: string, opts?: Record<string, unknown>) => string
): LockerViewerPlaylistItem | null {
  const uri = getClipPlaybackUrl(clip);
  if (!uri) return null;
  const sharer = clip.sharer as Record<string, unknown> | undefined;
  const sharerName = sharer?.fullname ?? sharer?.fullName ?? clip.shared_by_name ?? null;
  const clipId = String(clip._id ?? "");
  const isSharedCopy = isSharedClip(clip);
  return {
    uri,
    title: String(clip?.title ?? clip?.file_name ?? t("locker.clipDefault")),
    mode: "video",
    sharedBy: sharerName ? String(sharerName) : undefined,
    clipId: clipId || undefined,
    canRemove: isSharedCopy && !!clipId,
  };
}

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
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();
  const c = useThemeColors();
  const { accountType } = useAuth();
  const isTrainer = accountType === AccountType.TRAINER;
  const [removingClipId, setRemovingClipId] = useState<string | null>(null);
  const [tab, setTab] = useState<ClipTab>("mine");
  const [uploadVisible, setUploadVisible] = useState(false);
  const [shareMode, setShareMode] = useState(false);
  const [selectedClipIds, setSelectedClipIds] = useState<Record<string, boolean>>({});
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [friendShareClipIds, setFriendShareClipIds] = useState<string[]>([]);
  const [librarySheetClip, setLibrarySheetClip] = useState<LockerClip | null>(null);
  const [sharedInfoClip, setSharedInfoClip] = useState<LockerClip | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewer, setViewer] = useState<{
    uri: string;
    title: string;
    mode: LockerViewerMode;
    sharedBy?: string;
    clipId?: string;
    canRemove?: boolean;
  } | null>(null);

  const styles = useThemedStyles((palette) =>
    StyleSheet.create({
      toolbarRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
      segmentScroll: { flex: 1, maxHeight: 44 },
      segment: {
        flexDirection: "row",
        padding: 4,
        borderRadius: radii.md,
        backgroundColor: palette.surfaceMuted,
        gap: 4,
      },
      segBtn: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: radii.sm,
        alignItems: "center",
        minWidth: 88,
      },
      segBtnOn: { backgroundColor: palette.surfaceElevated },
      segLabel: { ...typography.label, color: palette.textMuted, fontSize: 12 },
      segLabelOn: { color: palette.brandNavy, fontWeight: "700" },
      uploadFab: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: palette.brandNavy,
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
      selectMark: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: palette.border,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 4,
      },
      selectMarkOn: { borderColor: palette.brandNavy, backgroundColor: palette.brandSubtle },
      shareBar: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        marginBottom: space.sm,
      },
      shareBarText: { flex: 1, ...typography.caption, color: palette.textMuted },
      shareBtn: {
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: radii.md,
        backgroundColor: palette.brandNavy,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
      },
      deleteBtn: {
        backgroundColor: "#dc2626",
      },
      shareBtnText: { color: palette.brandTextOn, fontWeight: "700", fontSize: 13 },
      shareModeBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: palette.surfaceElevated,
        borderWidth: 1,
        borderColor: palette.border,
        alignItems: "center",
        justifyContent: "center",
      },
      sectionHeading: {
        ...typography.titleSm,
        color: palette.text,
        fontWeight: "700",
        marginTop: space.sm,
        marginBottom: space.xs,
        paddingHorizontal: space.xs,
      },
      rowActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
      },
    })
  );

  const selectedIds = useMemo(
    () => Object.keys(selectedClipIds).filter((id) => selectedClipIds[id]),
    [selectedClipIds]
  );

  const toggleClipSelect = useCallback((id: string) => {
    setSelectedClipIds((s) => ({ ...s, [id]: !s[id] }));
  }, []);

  const exitShareMode = useCallback(() => {
    setShareMode(false);
    setSelectedClipIds({});
  }, []);

  useEffect(() => {
    if (tab !== "mine") exitShareMode();
  }, [tab, exitShareMode]);

  const myQ = useQuery({
    queryKey: queryKeys.locker.myClips,
    queryFn: () => postMyClipsGrouped({}),
    enabled: tab === "mine",
    staleTime: 30_000,
  });

  const sharedQ = useQuery({
    queryKey: queryKeys.locker.sharedClips,
    queryFn: () => postSharedClipsGrouped(),
    enabled: tab === "mine",
    staleTime: 30_000,
  });

  const libraryQ = useQuery({
    queryKey: queryKeys.locker.libraryClips,
    queryFn: () => postLibraryClipsGrouped(),
    enabled: tab === "library",
    staleTime: 30_000,
  });

  const active =
    tab === "library"
      ? libraryQ
      : {
          ...myQ,
          isLoading: myQ.isLoading || sharedQ.isLoading,
          isError: myQ.isError || sharedQ.isError,
          error: myQ.error ?? sharedQ.error,
          isRefetching: myQ.isRefetching || sharedQ.isRefetching,
          refetch: () => Promise.all([myQ.refetch(), sharedQ.refetch()]),
        };

  const onRefresh = useCallback(() => {
    void myQ.refetch();
    void sharedQ.refetch();
    void libraryQ.refetch();
  }, [myQ, sharedQ, libraryQ]);

  const confirmRemoveSharedClip = useCallback(
    (clip: LockerClip) => {
      const clipId = String(clip._id ?? "");
      if (!clipId || removingClipId) return;
      Alert.alert(t("locker.removeSharedClipTitle"), t("locker.removeSharedClipBody"), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("locker.removeSharedClip"),
          style: "destructive",
          onPress: () => {
            setRemovingClipId(clipId);
            void (async () => {
              try {
                await deleteLockerClip(clipId);
                dispatch(lockerMutated());
                void queryClient.invalidateQueries({ queryKey: queryKeys.locker.sharedClips });
                if (viewer) setViewer(null);
                Alert.alert(t("common.ok"), t("locker.removeSharedClipDone"));
              } catch (e) {
                Alert.alert(
                  t("common.error"),
                  getApiErrorMessage(e, t("locker.removeSharedClipFailed"))
                );
              } finally {
                setRemovingClipId(null);
              }
            })();
          },
        },
      ]);
    },
    [t, removingClipId, dispatch, queryClient, viewer]
  );

  const openClip = (clip: Record<string, unknown>) => {
    const uri = getClipPlaybackUrl(clip);
    if (!uri) {
      Alert.alert(
        t("locker.clipUnavailableTitle", { defaultValue: "Video unavailable" }),
        t("locker.clipUnavailableBody", {
          defaultValue: "This clip is still processing or the file is missing. Pull to refresh and try again.",
        })
      );
      return;
    }
    const sharer = clip.sharer as Record<string, unknown> | undefined;
    const sharerName =
      sharer?.fullname ?? sharer?.fullName ?? clip.shared_by_name ?? null;
    const clipId = String(clip._id ?? "");
    const isSharedCopy = isSharedClip(clip);
    const idx = tabPlaylist.findIndex((row) => String(row._id ?? "") === clipId);
    setViewerIndex(idx >= 0 ? idx : 0);
    setViewer({
      uri,
      title: String(clip?.title ?? clip?.file_name ?? t("locker.clipDefault")),
      mode: "video",
      sharedBy: sharerName ? String(sharerName) : undefined,
      clipId: clipId || undefined,
      canRemove: isSharedCopy && !!clipId,
    });
  };

  const toolbar = useMemo(
    () => (
      <View style={styles.toolbarRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.segmentScroll}
          contentContainerStyle={styles.segment}
        >
          <Pressable
            style={[styles.segBtn, tab === "mine" && styles.segBtnOn]}
            onPress={() => setTab("mine")}
          >
            <Text style={[styles.segLabel, tab === "mine" && styles.segLabelOn]}>
              {t("locker.myClips")}
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
        </ScrollView>
        {tab === "mine" ? (
          <>
            {isTrainer ? (
              <Pressable
                style={({ pressed }) => [styles.shareModeBtn, pressed && { opacity: 0.88 }]}
                onPress={() =>
                  openShellSurface(navigation, { surfaceId: "clipSubmissions" })
                }
                accessibilityRole="button"
                accessibilityLabel={t("locker.librarySubmissionsA11y", {
                  defaultValue: "My library submissions",
                })}
              >
                <Ionicons name="document-text-outline" size={20} color={c.brandNavy} />
              </Pressable>
            ) : null}
            <Pressable
              style={({ pressed }) => [styles.shareModeBtn, pressed && { opacity: 0.88 }]}
              onPress={() => {
                if (shareMode) exitShareMode();
                else setShareMode(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={shareMode ? t("locker.shareModeDone") : t("locker.shareMode")}
            >
              <Ionicons
                name={shareMode ? "close" : "share-social-outline"}
                size={20}
                color={c.brandNavy}
              />
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
    [tab, styles, c, t, shareMode, exitShareMode, isTrainer, navigation]
  );

  const renderClipRow = (
    clip: LockerClip,
    key: string,
    opts?: { showLibraryActions?: boolean; showRemoveAction?: boolean }
  ) => {
    const isSharedCopy = isSharedClip(clip as Record<string, unknown>);
    const thumb = getClipThumbnailUrl(clip);
    const sub = clip.librarySubmission;
    const statusText = sub?.status ? libraryStatusChip(sub.status, t) : null;
    const canRequestLibrary =
      opts?.showLibraryActions &&
      isTrainer &&
      !isSharedCopy &&
      (!sub || sub.status === "rejected") &&
      sub?.status !== "accepted";
    const showSharedInfo = tab === "mine" && isSharedCopy;

    const clipId = String(clip._id ?? "");
    const canSelectInShareMode = shareMode && tab === "mine" && !!clipId && !isSharedCopy;
    const isSelected = canSelectInShareMode && !!selectedClipIds[clipId];

    return (
      <Pressable
        key={key}
        style={styles.clipCard}
        onPress={() => {
          if (canSelectInShareMode) {
            toggleClipSelect(clipId);
            return;
          }
          openClip(clip);
        }}
        onLongPress={
          tab === "mine" && clipId && !isSharedCopy
            ? () => {
                if (!shareMode) setShareMode(true);
                toggleClipSelect(clipId);
              }
            : undefined
        }
      >
        {canSelectInShareMode ? (
          <View style={[styles.selectMark, isSelected && styles.selectMarkOn]}>
            {isSelected ? (
              <Ionicons name="checkmark" size={14} color={c.brandNavy} />
            ) : null}
          </View>
        ) : null}
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
          {statusText ? (
            <View style={styles.libChip}>
              <Text style={styles.libChipText}>{statusText}</Text>
            </View>
          ) : null}
          {!isSharedCopy && clip.createdAt ? (
            <Text style={styles.clipDate}>
              {new Date(String(clip.createdAt)).toLocaleDateString()}
            </Text>
          ) : null}
        </View>
        <View style={styles.rowActions}>
          {showSharedInfo ? (
            <Pressable
              style={styles.libAction}
              onPress={(e) => {
                e.stopPropagation?.();
                setSharedInfoClip(clip);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("locker.sharedClipInfoA11y", {
                defaultValue: "Shared clip info",
              })}
            >
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={c.brandNavy}
              />
            </Pressable>
          ) : null}
          {opts?.showRemoveAction && clipId ? (
            <Pressable
              style={styles.libAction}
              onPress={(e) => {
                e.stopPropagation?.();
                confirmRemoveSharedClip(clip);
              }}
              hitSlop={8}
              disabled={removingClipId === clipId}
              accessibilityRole="button"
              accessibilityLabel={t("locker.removeSharedClip")}
            >
              {removingClipId === clipId ? (
                <ActivityIndicator size="small" color={c.brandNavy} />
              ) : (
                <Ionicons name="trash-outline" size={20} color={c.danger} />
              )}
            </Pressable>
          ) : canRequestLibrary ? (
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
          ) : !showSharedInfo ? (
            <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
          ) : null}
        </View>
      </Pressable>
    );
  };

  const myGroups = (myQ.data ?? []) as NestedCategoryGroup[];
  const sharedGroups = (sharedQ.data ?? []) as SharedClipsGroup[];
  const libraryGroups = (libraryQ.data ?? []) as NestedCategoryGroup[];

  const sharedClipsFlat = useMemo(() => {
    const all = sharedGroups.flatMap((grp) => dedupeClipsById(grp.clips));
    return dedupeClipsById(all);
  }, [sharedGroups]);

  const tabPlaylist = useMemo(() => {
    if (tab === "mine") {
      return [...sharedClipsFlat, ...flattenNestedGroups(myGroups)];
    }
    if (tab === "library") return flattenNestedGroups(libraryGroups);
    return [];
  }, [tab, myGroups, libraryGroups, sharedClipsFlat]);

  const viewerPlaylist = useMemo(
    () =>
      tabPlaylist
        .map((clip) => clipToPlaylistItem(clip as Record<string, unknown>, t))
        .filter((item): item is LockerViewerPlaylistItem => item != null),
    [tabPlaylist, t]
  );

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
        applyTopSafeArea={false}
        renderSkeletonRow={() => <ClipSectionSkeleton rows={3} />}
      >
        {tab === "mine" && shareMode ? (
          <View style={styles.shareBar}>
            <Text style={styles.shareBarText}>
              {selectedIds.length > 0
                ? `${selectedIds.length} selected`
                : t("locker.shareModeHint")}
            </Text>
            <Pressable
              style={[styles.shareBtn, selectedIds.length === 0 && { opacity: 0.45 }]}
              disabled={selectedIds.length === 0}
              onPress={() => setShareModalVisible(true)}
            >
              <Ionicons name="share-social-outline" size={14} color="#fff" />
              <Text style={styles.shareBtnText}>
                {t("locker.shareMode")}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.shareBtn, styles.deleteBtn, selectedIds.length === 0 && { opacity: 0.45 }]}
              disabled={selectedIds.length === 0}
              onPress={() => {
                Alert.alert(
                  "Delete Clips",
                  `Delete ${selectedIds.length} clip${selectedIds.length === 1 ? "" : "s"}? This cannot be undone.`,
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: async () => {
                        for (const id of selectedIds) {
                          try {
                            await deleteLockerClip(id);
                          } catch { /* skip failed deletions */ }
                        }
                        void queryClient.invalidateQueries({ queryKey: queryKeys.locker.myClips });
                        exitShareMode();
                      },
                    },
                  ]
                );
              }}
            >
              <Ionicons name="trash-outline" size={14} color="#fff" />
              <Text style={styles.shareBtnText}>Delete</Text>
            </Pressable>
          </View>
        ) : null}

        {tab === "mine" && (
          <>
            <ClipShareInboxBanner
              onAccepted={() => {
                void sharedQ.refetch();
              }}
            />

            {sharedClipsFlat.length > 0 ? (
              <CategorySection
                title={t("locker.sharedWithYou")}
                count={sharedClipsFlat.length}
                defaultOpen
              >
                {sharedClipsFlat.map((clip, i) =>
                  renderClipRow(clip, `shared-flat-${String(clip._id ?? i)}`, {
                    showRemoveAction: true,
                  })
                )}
              </CategorySection>
            ) : null}

            {myGroups.length > 0 ? (
              <>
                {sharedClipsFlat.length > 0 ? (
                  <Text style={styles.sectionHeading}>{t("locker.myUploadsSection")}</Text>
                ) : null}
                <NestedTaxonomySections
                  groups={myGroups}
                  uncategorizedLabel={t("locker.uncategorized")}
                  renderClipRow={(clip, key) =>
                    renderClipRow(clip, key, { showLibraryActions: isTrainer })
                  }
                />
              </>
            ) : sharedClipsFlat.length === 0 ? (
              <EmptyState
                icon="film-outline"
                title={t("locker.noClips")}
                description={t("locker.noClipsDescription")}
                actionLabel={t("locker.uploadClip")}
                onAction={() => setUploadVisible(true)}
              />
            ) : null}
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
        clipId={viewer?.clipId}
        playlist={viewerPlaylist}
        initialIndex={viewerIndex}
        onIndexChange={setViewerIndex}
        onShareFriends={
          viewer?.clipId && !viewer.canRemove
            ? () => {
                const clipId = viewer.clipId!;
                setViewer(null);
                setFriendShareClipIds([clipId]);
                setShareModalVisible(true);
              }
            : undefined
        }
        shareFriendsAccessibilityLabel={t("locker.shareToFriends", {
          defaultValue: "Share with NetQwix friends",
        })}
        onShareExternal={
          viewer
            ? () => {
                Alert.alert(
                  t("locker.shareExternalTitle", { defaultValue: "Share link" }),
                  t("locker.shareExternalBody", {
                    defaultValue: "Share this clip outside NetQwix?",
                  }),
                  [
                    { text: t("common.cancel"), style: "cancel" },
                    {
                      text: t("locker.shareTabLink", { defaultValue: "Share link" }),
                      onPress: () => {
                        void shareClipExternally({
                          title: viewer.title,
                          clipId: viewer.clipId,
                          playbackUrl: viewer.uri,
                          t,
                        });
                      },
                    },
                  ]
                );
              }
            : undefined
        }
        shareAccessibilityLabel={t("locker.shareExternal")}
        onDeleteClip={
          viewer?.clipId && tab === "mine" && !viewer.canRemove
            ? async () => {
                const cId = viewer.clipId!;
                try {
                  await deleteLockerClip(cId);
                  void queryClient.invalidateQueries({ queryKey: queryKeys.locker.myClips });
                  setViewer(null);
                  Alert.alert(
                    t("locker.deletedTitle", { defaultValue: "Deleted" }),
                    t("locker.deletedBody", { defaultValue: "Clip removed from your locker." })
                  );
                } catch {
                  Alert.alert(
                    t("common.error"),
                    t("locker.deleteFailed", { defaultValue: "Could not delete the clip." })
                  );
                }
              }
            : undefined
        }
        deleteAccessibilityLabel="Delete clip"
        onRemoveFromLocker={
          viewer?.canRemove && viewer.clipId
            ? () => confirmRemoveSharedClip({ _id: viewer.clipId } as LockerClip)
            : undefined
        }
        removeBusy={!!viewer?.clipId && removingClipId === viewer.clipId}
        removeAccessibilityLabel={t("locker.removeSharedClip")}
      />

      <ClipUploadModal
        visible={uploadVisible}
        onClose={() => setUploadVisible(false)}
        onUploaded={() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.locker.myClips });
          void queryClient.invalidateQueries({ queryKey: queryKeys.instant.lessonClipsAll });
        }}
      />

      <ClipShareFriendsModal
        visible={shareModalVisible}
        clipIds={friendShareClipIds.length > 0 ? friendShareClipIds : selectedIds}
        onClose={() => {
          setShareModalVisible(false);
          setFriendShareClipIds([]);
        }}
        onSent={() => {
          exitShareMode();
          setFriendShareClipIds([]);
          void queryClient.invalidateQueries({ queryKey: queryKeys.locker.sharedClips });
        }}
      />

      <LibrarySubmissionSheet
        visible={!!librarySheetClip}
        clip={librarySheetClip}
        onClose={() => setLibrarySheetClip(null)}
        onSubmitted={() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.locker.myClips });
        }}
      />

      <SharedClipInfoSheet
        visible={!!sharedInfoClip}
        clip={sharedInfoClip}
        onClose={() => setSharedInfoClip(null)}
      />
    </>
  );
}
