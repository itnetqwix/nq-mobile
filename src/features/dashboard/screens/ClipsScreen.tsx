import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState, ImageWithSkeleton } from "../../../components/ui";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { getClipPlaybackUrl, getClipThumbnailUrl } from "../../../lib/clipMediaUrl";
import { postMyClipsGrouped, postSharedClipsGrouped } from "../../home/api/homeApi";
import { LockerListShell } from "../components/locker/LockerListShell";
import { LockerViewerModal, type LockerViewerMode } from "../components/locker/LockerViewerModal";
import { ClipUploadModal } from "../components/locker/ClipUploadModal";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { queryKeys } from "../../../lib/queryKeys";

type ClipTab = "mine" | "shared";

function dedupeClipsById<T extends { _id?: unknown }>(list: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (let i = 0; i < list.length; i++) {
    const raw = list[i];
    const id = raw?._id != null ? String(raw._id) : `__noid:${i}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(raw);
  }
  return out;
}

function formatCategoryLabel(raw: unknown, uncategorizedLabel: string): string {
  if (raw == null || raw === "") return uncategorizedLabel;
  if (typeof raw === "string") return raw;
  if (typeof raw === "object" && raw !== null) {
    const o = raw as Record<string, unknown>;
    if (typeof o.name === "string") return o.name;
    if (typeof o.title === "string") return o.title;
  }
  return String(raw);
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

export function ClipsScreen() {
  const { t } = useAppTranslation();
  const queryClient = useQueryClient();
  const c = useThemeColors();
  const [tab, setTab] = useState<ClipTab>("mine");
  const [uploadVisible, setUploadVisible] = useState(false);
  const [viewer, setViewer] = useState<{
    uri: string;
    title: string;
    mode: LockerViewerMode;
    sharedBy?: string;
  } | null>(null);

  const styles = useThemedStyles((palette) =>
    StyleSheet.create({
      toolbarRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
      },
      segment: {
        flex: 1,
        flexDirection: "row",
        padding: 4,
        borderRadius: radii.md,
        backgroundColor: palette.surfaceMuted,
        gap: 4,
      },
      segBtn: { flex: 1, paddingVertical: 8, borderRadius: radii.sm, alignItems: "center" },
      segBtnOn: { backgroundColor: palette.surfaceElevated },
      segLabel: { ...typography.label, color: palette.textMuted },
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

  const active = tab === "mine" ? myQ : sharedQ;

  const onRefresh = useCallback(() => {
    void myQ.refetch();
    void sharedQ.refetch();
  }, [myQ, sharedQ]);

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
            <Text style={[styles.segLabel, tab === "mine" && styles.segLabelOn]}>{t("locker.myClips")}</Text>
          </Pressable>
          <Pressable
            style={[styles.segBtn, tab === "shared" && styles.segBtnOn]}
            onPress={() => setTab("shared")}
          >
            <Text style={[styles.segLabel, tab === "shared" && styles.segLabelOn]}>{t("locker.sharedClips")}</Text>
          </Pressable>
        </View>
        {tab === "mine" ? (
          <Pressable
            style={({ pressed }) => [styles.uploadFab, pressed && { opacity: 0.88 }]}
            onPress={() => setUploadVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={t("locker.uploadClip")}
          >
            <Ionicons name="cloud-upload-outline" size={20} color={c.brandTextOn} />
          </Pressable>
        ) : null}
      </View>
    ),
    [tab, styles, c, t]
  );

  const renderClipRow = (clip: Record<string, unknown>, key: string, showSharer?: boolean) => {
    const thumb = getClipThumbnailUrl(clip);
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
          {showSharer ? (
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
          {clip.createdAt || clip.shared_at ? (
            <Text style={styles.clipDate}>
              {new Date(String(clip.shared_at ?? clip.createdAt)).toLocaleDateString()}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
      </Pressable>
    );
  };

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
            {(myQ.data ?? []).length === 0 ? (
              <EmptyState
                icon="film-outline"
                title={t("locker.noClips")}
                description={t("locker.noClipsDescription")}
                actionLabel={t("locker.uploadClip")}
                onAction={() => setUploadVisible(true)}
              />
            ) : (
              (myQ.data ?? []).map((grp: { _id?: unknown; clips?: unknown[] }, i: number) => {
                const clips = dedupeClipsById((grp.clips ?? []) as { _id?: unknown }[]);
                return (
                  <CategorySection
                    key={`mine-grp-${i}-${String(grp._id ?? "uncat")}`}
                    title={formatCategoryLabel(grp._id, t("locker.uncategorized"))}
                    count={clips.length}
                    defaultOpen={i === 0}
                  >
                    {clips.map((clip, ci) =>
                      renderClipRow(clip as Record<string, unknown>, `mine-${i}-${String(clip._id ?? ci)}`)
                    )}
                  </CategorySection>
                );
              })
            )}
          </>
        )}

        {tab === "shared" && (
          <>
            {(sharedQ.data ?? []).length === 0 ? (
              <EmptyState
                icon="share-social-outline"
                title={t("locker.noShared")}
                description={t("locker.noSharedDescription")}
              />
            ) : (
              (sharedQ.data ?? []).map((grp: { _id?: unknown; clips?: unknown[] }, i: number) => {
                const clips = dedupeClipsById((grp.clips ?? []) as { _id?: unknown }[]);
                return (
                  <CategorySection
                    key={`shared-grp-${i}-${String(grp._id ?? "uncat")}`}
                    title={formatCategoryLabel(grp._id, t("locker.uncategorized"))}
                    count={clips.length}
                    defaultOpen={i === 0}
                  >
                    {clips.map((clip, ci) =>
                      renderClipRow(
                        clip as Record<string, unknown>,
                        `shared-${i}-${String(clip._id ?? ci)}`,
                        true
                      )
                    )}
                  </CategorySection>
                );
              })
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
    </>
  );
}
