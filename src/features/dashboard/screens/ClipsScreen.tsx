import React, { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState, ImageWithSkeleton, Skeleton } from "../../../components/ui";
import { colors, radii, space, typography } from "../../../theme";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { useHorizontalGutter } from "../../../lib/layout/useHorizontalGutter";
import { getClipPlaybackUrl } from "../../../lib/clipMediaUrl";
import { useAuth } from "../../auth/context/AuthContext";
import { AccountType } from "../../../constants/accountType";
import { postMyClipsGrouped, postTraineeClipsGrouped } from "../../home/api/homeApi";
import { LockerViewerModal, type LockerViewerMode } from "../components/locker/LockerViewerModal";
import { ClipUploadModal } from "../components/locker/ClipUploadModal";

type ClipTab = "mine" | "trainees";

/**
 * Backend safety net: `traineeClips` (and occasionally `getClips`) can return
 * the same clip more than once inside a single group — typically when one clip
 * is attached to multiple bookings and the join query is unioned without a
 * `DISTINCT`. Without dedupe, React renders two children with the same
 * `clip._id` and emits "Encountered two children with the same key" + silently
 * drops the duplicate.
 *
 * We keep the first occurrence and drop subsequent ones. Items without an
 * `_id` get a synthetic key so they aren't collapsed against each other.
 */
function dedupeClipsById<T extends { _id?: any }>(list: T[]): T[] {
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
  const [open, setOpen] = useState(defaultOpen === true);
  return (
    <View style={styles.section}>
      <Pressable style={styles.sectionHead} onPress={() => setOpen(!open)}>
        <View style={styles.sectionHeadLeft}>
          <View style={styles.sectionIcon}>
            <Ionicons name="folder-outline" size={18} color={colors.brandNavy} />
          </View>
          <Text style={styles.sectionTitle} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{count}</Text>
          </View>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={20} color={colors.textMuted} />
      </Pressable>
      {open && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

export function ClipsScreen() {
  const insets = useSafeAreaInsets();
  const gutter = useHorizontalGutter("md");
  const scrollPad = useMemo(
    () => ({
      ...gutter,
      paddingTop: space.md,
      paddingBottom: space.xl * 2 + insets.bottom,
      gap: space.md,
    }),
    [gutter, insets.bottom]
  );
  const queryClient = useQueryClient();
  const { accountType } = useAuth();
  const isTrainer = accountType === AccountType.TRAINER;
  const [tab, setTab] = useState<ClipTab>("mine");
  const [uploadVisible, setUploadVisible] = useState(false);
  const [viewer, setViewer] = useState<{
    uri: string;
    title: string;
    mode: LockerViewerMode;
  } | null>(null);

  const myQ = useQuery({
    queryKey: ["locker", "myClips"],
    queryFn: () => postMyClipsGrouped({}),
    enabled: tab === "mine",
    staleTime: 30_000,
  });

  const traineeQ = useQuery({
    queryKey: ["locker", "traineeClips"],
    queryFn: () => postTraineeClipsGrouped(),
    enabled: tab === "trainees" && isTrainer,
    staleTime: 30_000,
  });

  const active = tab === "mine" ? myQ : traineeQ;
  const refreshing = active.isRefetching;
  const loading = active.isLoading;

  const onRefresh = useCallback(() => {
    void myQ.refetch();
    void traineeQ.refetch();
  }, [myQ, traineeQ]);

  const openClip = (clip: any) => {
    const uri = getClipPlaybackUrl(clip);
    if (!uri) return;
    setViewer({
      uri,
      title: clip?.title ?? clip?.file_name ?? "Clip",
      mode: "video",
    });
  };

  return (
    <View style={styles.root}>
      <View style={[styles.hero, gutter]}>
        <View style={styles.heroTop}>
          <View style={styles.heroTextBlock}>
            <Text style={styles.heroTitle}>Clips</Text>
            <Text style={styles.heroSub}>
              Your locker videos, grouped by category — same data as the web My clips tab.
            </Text>
          </View>
          {tab === "mine" && (
            <Pressable
              style={({ pressed }) => [styles.uploadFab, pressed && { opacity: 0.88 }]}
              onPress={() => setUploadVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Upload clip from device"
            >
              <Ionicons name="cloud-upload-outline" size={22} color={colors.brandTextOn} />
            </Pressable>
          )}
        </View>
      </View>

      {isTrainer && (
        <View
          style={[
            styles.segment,
            { marginLeft: space.md + insets.left, marginRight: space.md + insets.right },
          ]}
        >
          <Pressable
            style={[styles.segBtn, tab === "mine" && styles.segBtnOn]}
            onPress={() => setTab("mine")}
          >
            <Text style={[styles.segLabel, tab === "mine" && styles.segLabelOn]}>My clips</Text>
          </Pressable>
          <Pressable
            style={[styles.segBtn, tab === "trainees" && styles.segBtnOn]}
            onPress={() => setTab("trainees")}
          >
            <Text style={[styles.segLabel, tab === "trainees" && styles.segLabelOn]}>From trainees</Text>
          </Pressable>
        </View>
      )}

      {loading ? (
        <View style={scrollPad}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ marginBottom: space.md }}>
              <Skeleton width="100%" height={120} radius={radii.md} />
              <Skeleton width="60%" height={12} style={{ marginTop: 8 }} />
              <Skeleton width="40%" height={10} style={{ marginTop: 4 }} />
            </View>
          ))}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={scrollPad}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandNavy} />
          }
        >
          {tab === "mine" && (
            <>
              {(myQ.data ?? []).length === 0 ? (
                <EmptyState
                  icon="film-outline"
                  title="No clips yet"
                  description="Upload from the web locker or add clips after sessions — they will appear here by category."
                />
              ) : (
                (myQ.data ?? []).map((grp: any, i: number) => {
                  const clips = dedupeClipsById((grp.clips ?? []) as any[]);
                  return (
                  <CategorySection
                    key={`mine-grp-${i}-${String(grp._id ?? "uncat")}`}
                    title={String(grp._id ?? "Uncategorized")}
                    count={clips.length}
                    defaultOpen={i === 0}
                  >
                    {clips.map((clip: any, ci: number) => {
                      const thumb = getS3ImageUrl(clip.thumbnail ?? clip.thumbnail_url ?? clip.poster);
                      return (
                        <Pressable key={`mine-${i}-${String(clip._id ?? "noid")}-${ci}`} style={styles.clipCard} onPress={() => openClip(clip)}>
                          <View style={styles.thumbWrap}>
                            {thumb ? (
                              <ImageWithSkeleton
                                uri={thumb}
                                width={72}
                                height={72}
                                borderRadius={radii.sm}
                                resizeMode="cover"
                                accessibilityLabel={clip.title ?? clip.file_name ?? "Clip thumbnail"}
                              />
                            ) : (
                              <View style={styles.thumbPh}>
                                <Ionicons name="play-circle" size={36} color={colors.sidebarActive} />
                              </View>
                            )}
                          </View>
                          <View style={styles.clipMeta}>
                            <Text style={styles.clipTitle} numberOfLines={2}>
                              {clip.title ?? clip.file_name ?? "Clip"}
                            </Text>
                            <Text style={styles.clipDate}>
                              {clip.createdAt ? new Date(clip.createdAt).toLocaleDateString() : ""}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                        </Pressable>
                      );
                    })}
                  </CategorySection>
                  );
                })
              )}
            </>
          )}

          {tab === "trainees" && isTrainer && (
            <>
              {(traineeQ.data ?? []).length === 0 ? (
                <EmptyState
                  icon="people-outline"
                  title="No trainee clips"
                  description="When trainees attach clips to bookings, they show here by trainee."
                />
              ) : (
                (traineeQ.data ?? []).map((grp: any, i: number) => {
                  const trainee = grp._id;
                  const name = trainee?.fullname ?? trainee?.fullName ?? "Trainee";
                  /**
                   * `grp.clips` may be either a flat array of clip docs OR a
                   * list of join-table wrappers (each containing a `clips`
                   * field pointing at the real clip). Normalize, then dedupe
                   * by the resolved clip `_id` so the same clip attached to
                   * multiple bookings doesn't render twice.
                   */
                  const normalized = ((grp.clips ?? []) as any[]).map((wrap: any) =>
                    wrap?.clips ?? wrap
                  );
                  const clips = dedupeClipsById(normalized);
                  return (
                    <CategorySection
                      key={`tr-grp-${i}-${String(trainee?._id ?? "x")}`}
                      title={name}
                      count={clips.length}
                      defaultOpen={i === 0}
                    >
                      {clips.map((clip: any, idx: number) => {
                        return (
                          <Pressable
                            key={`tr-${i}-${String(clip?._id ?? "noid")}-${idx}`}
                            style={styles.clipCard}
                            onPress={() => openClip(clip)}
                          >
                            <View style={styles.thumbWrap}>
                              <View style={styles.thumbPh}>
                                <Ionicons name="play-circle" size={36} color={colors.sidebarActive} />
                              </View>
                            </View>
                            <View style={styles.clipMeta}>
                              <Text style={styles.clipTitle} numberOfLines={2}>
                                {clip?.title ?? clip?.file_name ?? "Clip"}
                              </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                          </Pressable>
                        );
                      })}
                    </CategorySection>
                  );
                })
              )}
            </>
          )}
        </ScrollView>
      )}

      <LockerViewerModal
        visible={!!viewer}
        onClose={() => setViewer(null)}
        uri={viewer?.uri ?? ""}
        title={viewer?.title}
        mode={viewer?.mode ?? "video"}
      />

      <ClipUploadModal
        visible={uploadVisible}
        onClose={() => setUploadVisible(false)}
        onUploaded={() => {
          void queryClient.invalidateQueries({ queryKey: ["locker", "myClips"] });
          void queryClient.invalidateQueries({ queryKey: ["instantLessonClips"] });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  hero: {
    paddingTop: space.md,
    paddingBottom: space.sm,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
  },
  heroTextBlock: { flex: 1, minWidth: 0 },
  uploadFab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brandNavy,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  heroTitle: { ...typography.titleLg, color: colors.brandNavy },
  heroSub: { ...typography.bodySm, color: colors.textMuted, marginTop: 6 },

  segment: {
    flexDirection: "row",
    marginTop: space.md,
    padding: 4,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    gap: 4,
  },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: radii.sm, alignItems: "center" },
  segBtnOn: { backgroundColor: colors.background, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  segLabel: { ...typography.label, color: colors.textMuted },
  segLabelOn: { color: colors.brandNavy },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  section: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.md,
    paddingVertical: 14,
    backgroundColor: colors.brandSubtle,
  },
  sectionHeadLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.sidebarActiveBg,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { flex: 1, ...typography.titleSm, color: colors.text },
  countPill: {
    backgroundColor: colors.brandNavy,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  countPillText: { color: colors.brandTextOn, fontSize: 12, fontWeight: "700" },
  sectionBody: { paddingHorizontal: space.sm, paddingBottom: space.sm },

  clipCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: 12,
    paddingHorizontal: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  thumbWrap: { width: 72, height: 72, borderRadius: radii.sm, overflow: "hidden", backgroundColor: colors.surface },
  thumbPh: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandSubtle },
  clipMeta: { flex: 1 },
  clipTitle: { ...typography.subtitle, color: colors.text },
  clipDate: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
});
