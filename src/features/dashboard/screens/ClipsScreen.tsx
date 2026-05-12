import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, space } from "../../../theme/tokens";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { getClipPlaybackUrl } from "../../../lib/clipMediaUrl";
import { useAuth } from "../../auth/context/AuthContext";
import { AccountType } from "../../../constants/accountType";
import { postMyClipsGrouped, postTraineeClipsGrouped } from "../../home/api/homeApi";
import { LockerViewerModal, type LockerViewerMode } from "../components/locker/LockerViewerModal";
import { ClipUploadModal } from "../components/locker/ClipUploadModal";

type ClipTab = "mine" | "trainees";

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
      <View style={styles.hero}>
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
              <Ionicons name="cloud-upload-outline" size={22} color="#fff" />
            </Pressable>
          )}
        </View>
      </View>

      {isTrainer && (
        <View style={styles.segment}>
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
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brandNavy} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandNavy} />
          }
        >
          {tab === "mine" && (
            <>
              {(myQ.data ?? []).length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="film-outline" size={52} color="#d1d5db" />
                  <Text style={styles.emptyTitle}>No clips yet</Text>
                  <Text style={styles.emptyBody}>
                    Upload from the web locker or add clips after sessions — they will appear here by category.
                  </Text>
                </View>
              ) : (
                (myQ.data ?? []).map((grp: any, i: number) => (
                  <CategorySection
                    key={String(grp._id ?? i)}
                    title={String(grp._id ?? "Uncategorized")}
                    count={(grp.clips ?? []).length}
                    defaultOpen={i === 0}
                  >
                    {(grp.clips ?? []).map((clip: any) => {
                      const thumb = getS3ImageUrl(clip.thumbnail ?? clip.thumbnail_url ?? clip.poster);
                      return (
                        <Pressable key={String(clip._id)} style={styles.clipCard} onPress={() => openClip(clip)}>
                          <View style={styles.thumbWrap}>
                            {thumb ? (
                              <Image source={{ uri: thumb }} style={styles.thumb} />
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
                ))
              )}
            </>
          )}

          {tab === "trainees" && isTrainer && (
            <>
              {(traineeQ.data ?? []).length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="people-outline" size={52} color="#d1d5db" />
                  <Text style={styles.emptyTitle}>No trainee clips</Text>
                  <Text style={styles.emptyBody}>
                    When trainees attach clips to bookings, they show here by trainee (web Enthusiasts tab).
                  </Text>
                </View>
              ) : (
                (traineeQ.data ?? []).map((grp: any, i: number) => {
                  const trainee = grp._id;
                  const name = trainee?.fullname ?? trainee?.fullName ?? "Trainee";
                  return (
                    <CategorySection key={String(trainee?._id ?? i)} title={name} count={(grp.clips ?? []).length} defaultOpen={i === 0}>
                      {(grp.clips ?? []).map((wrap: any, idx: number) => {
                        const clip = wrap?.clips ?? wrap;
                        return (
                          <Pressable
                            key={String(clip?._id ?? idx)}
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
    paddingHorizontal: space.md,
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
  heroTitle: { fontSize: 22, fontWeight: "800", color: colors.brandNavy, letterSpacing: -0.3 },
  heroSub: { fontSize: 13, color: colors.textMuted, marginTop: 6, lineHeight: 18 },

  segment: {
    flexDirection: "row",
    marginHorizontal: space.md,
    marginTop: space.md,
    padding: 4,
    borderRadius: radii.md,
    backgroundColor: "#e8ecf4",
    gap: 4,
  },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: radii.sm, alignItems: "center" },
  segBtnOn: { backgroundColor: colors.background, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  segLabel: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  segLabelOn: { color: colors.brandNavy },

  scroll: { padding: space.md, paddingBottom: space.xl * 2, gap: space.md },
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
    backgroundColor: "#fafbff",
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
  sectionTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.text },
  countPill: {
    backgroundColor: colors.brandNavy,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  countPillText: { color: "#fff", fontSize: 12, fontWeight: "700" },
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
  thumb: { width: "100%", height: "100%" },
  thumbPh: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#eef2ff" },
  clipMeta: { flex: 1 },
  clipTitle: { fontSize: 15, fontWeight: "600", color: colors.text, lineHeight: 20 },
  clipDate: { fontSize: 12, color: colors.textMuted, marginTop: 4 },

  empty: { alignItems: "center", paddingVertical: space.xl * 2, paddingHorizontal: space.lg, gap: space.sm },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  emptyBody: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 21 },
});
