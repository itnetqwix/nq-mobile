import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { radii, space } from "../../../theme/tokens";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { useAuth } from "../../auth/context/AuthContext";
import { AccountType } from "../../../constants/accountType";
import {
  postGetAllSavedSessions,
  postMyClipsGrouped,
  postReportsGetAll,
  postTraineeClipsGrouped,
} from "../../home/api/homeApi";

const NAVY = "#000080";

type TopTab = "my_clips" | "library" | "enthusiasts";
type LibrarySub = "saved" | "plans";

function CategoryBlock({
  category,
  clips,
  defaultOpen,
}: {
  category: string;
  clips: any[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  return (
    <View style={styles.catBlock}>
      <Pressable style={styles.catHeader} onPress={() => setOpen(!open)}>
        <Text style={styles.catTitle} numberOfLines={1}>
          {category || "Uncategorized"}
        </Text>
        <View style={styles.catBadge}>
          <Text style={styles.catBadgeText}>{clips.length}</Text>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color="#6b7280" />
      </Pressable>
      {open && (
        <View style={styles.catBody}>
          {clips.map((clip) => (
            <View key={String(clip._id)} style={styles.clipRow}>
              <View style={styles.clipThumbBox}>
                {getS3ImageUrl(clip.thumbnail ?? clip.thumbnail_url ?? clip.poster) ? (
                  <Image
                    source={{
                      uri: getS3ImageUrl(clip.thumbnail ?? clip.thumbnail_url ?? clip.poster),
                    }}
                    style={styles.clipThumb}
                  />
                ) : (
                  <Ionicons name="videocam-outline" size={22} color={NAVY} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.clipName} numberOfLines={2}>
                  {clip.title ?? clip.file_name ?? "Clip"}
                </Text>
                <Text style={styles.clipMeta} numberOfLines={1}>
                  {clip.createdAt
                    ? new Date(clip.createdAt).toLocaleDateString()
                    : ""}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function TraineeGroupBlock({
  trainee,
  clips,
}: {
  trainee: any;
  clips: any[];
}) {
  const [open, setOpen] = useState(true);
  const name = trainee?.fullname ?? trainee?.fullName ?? "Trainee";
  return (
    <View style={styles.catBlock}>
      <Pressable style={styles.catHeader} onPress={() => setOpen(!open)}>
        <Text style={styles.catTitle} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.catBadge}>
          <Text style={styles.catBadgeText}>{clips.length}</Text>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color="#6b7280" />
      </Pressable>
      {open && (
        <View style={styles.catBody}>
          {clips.map((wrap: any, idx: number) => {
            const clip = wrap?.clips ?? wrap;
            return (
              <View key={String(clip?._id ?? idx)} style={styles.clipRow}>
                <View style={styles.clipThumbBox}>
                  <Ionicons name="videocam-outline" size={22} color={NAVY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.clipName} numberOfLines={2}>
                    {clip?.title ?? clip?.file_name ?? "Clip"}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export function UploadsScreen() {
  const { accountType } = useAuth();
  const isTrainer = accountType === AccountType.TRAINER;
  const [topTab, setTopTab] = useState<TopTab>("my_clips");
  const [libSub, setLibSub] = useState<LibrarySub>("plans");

  const myClipsQ = useQuery({
    queryKey: ["locker", "myClips"],
    queryFn: () => postMyClipsGrouped({}),
    enabled: topTab === "my_clips",
    staleTime: 30_000,
  });

  const traineeQ = useQuery({
    queryKey: ["locker", "traineeClips"],
    queryFn: () => postTraineeClipsGrouped(),
    enabled: topTab === "enthusiasts" && isTrainer,
    staleTime: 30_000,
  });

  const savedQ = useQuery({
    queryKey: ["locker", "savedSessions"],
    queryFn: postGetAllSavedSessions,
    enabled: topTab === "library" && libSub === "saved",
    staleTime: 30_000,
  });

  const reportsQ = useQuery({
    queryKey: ["locker", "reports"],
    queryFn: () => postReportsGetAll({}),
    enabled: topTab === "library" && libSub === "plans",
    staleTime: 30_000,
  });

  const refreshing =
    myClipsQ.isRefetching ||
    traineeQ.isRefetching ||
    savedQ.isRefetching ||
    reportsQ.isRefetching;

  const onRefresh = useCallback(() => {
    void myClipsQ.refetch();
    void traineeQ.refetch();
    void savedQ.refetch();
    void reportsQ.refetch();
  }, [myClipsQ, traineeQ, savedQ, reportsQ]);

  const loading =
    (topTab === "my_clips" && myClipsQ.isLoading) ||
    (topTab === "enthusiasts" && traineeQ.isLoading) ||
    (topTab === "library" && libSub === "saved" && savedQ.isLoading) ||
    (topTab === "library" && libSub === "plans" && reportsQ.isLoading);

  const reportSections = useMemo(() => {
    const rows = reportsQ.data ?? [];
    return rows.map((grp: any) => ({
      title: grp?._id
        ? `${grp._id.month}/${grp._id.day}/${grp._id.year}`
        : "Reports",
      data: grp?.report ?? [],
    }));
  }, [reportsQ.data]);

  return (
    <View style={styles.root}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.topTabs}
      >
        <Pressable
          style={[styles.topTab, topTab === "my_clips" && styles.topTabOn]}
          onPress={() => setTopTab("my_clips")}
        >
          <Text style={[styles.topTabText, topTab === "my_clips" && styles.topTabTextOn]}>
            My clips
          </Text>
        </Pressable>
        <Pressable
          style={[styles.topTab, topTab === "library" && styles.topTabOn]}
          onPress={() => setTopTab("library")}
        >
          <Text style={[styles.topTabText, topTab === "library" && styles.topTabTextOn]}>
            Saved & game plans
          </Text>
        </Pressable>
        {isTrainer && (
          <Pressable
            style={[styles.topTab, topTab === "enthusiasts" && styles.topTabOn]}
            onPress={() => setTopTab("enthusiasts")}
          >
            <Text style={[styles.topTabText, topTab === "enthusiasts" && styles.topTabTextOn]}>
              Enthusiasts
            </Text>
          </Pressable>
        )}
      </ScrollView>

      {topTab === "library" && (
        <View style={styles.subTabs}>
          <Pressable
            style={[styles.subTab, libSub === "plans" && styles.subTabOn]}
            onPress={() => setLibSub("plans")}
          >
            <Text style={[styles.subTabText, libSub === "plans" && styles.subTabTextOn]}>
              Game plans
            </Text>
          </Pressable>
          <Pressable
            style={[styles.subTab, libSub === "saved" && styles.subTabOn]}
            onPress={() => setLibSub("saved")}
          >
            <Text style={[styles.subTabText, libSub === "saved" && styles.subTabTextOn]}>
              Saved lessons
            </Text>
          </Pressable>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={NAVY} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={NAVY} />
          }
        >
          {topTab === "my_clips" && (
            <>
              {(myClipsQ.data ?? []).length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="cloud-upload-outline" size={48} color="#d1d5db" />
                  <Text style={styles.emptyTitle}>No clips yet</Text>
                  <Text style={styles.emptyBody}>
                    Uploads are grouped by category, same as the website locker (`POST
                    /common/get-clips`).
                  </Text>
                </View>
              ) : (
                (myClipsQ.data ?? []).map((grp: any, i: number) => (
                  <CategoryBlock
                    key={String(grp._id ?? i)}
                    category={String(grp._id ?? "Uncategorized")}
                    clips={grp.clips ?? []}
                    defaultOpen={i === 0}
                  />
                ))
              )}
            </>
          )}

          {topTab === "enthusiasts" && isTrainer && (
            <>
              {(traineeQ.data ?? []).length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="people-outline" size={48} color="#d1d5db" />
                  <Text style={styles.emptyTitle}>No trainee clips</Text>
                  <Text style={styles.emptyBody}>
                    Clips trainees attached to bookings appear here (`POST /common/trainee-clips`).
                  </Text>
                </View>
              ) : (
                (traineeQ.data ?? []).map((grp: any, i: number) => (
                  <TraineeGroupBlock
                    key={String(grp?._id?._id ?? grp?._id?.fullname ?? i)}
                    trainee={grp._id}
                    clips={grp.clips ?? []}
                  />
                ))
              )}
            </>
          )}

          {topTab === "library" && libSub === "saved" && (
            <>
              {(savedQ.data ?? []).length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="bookmark-outline" size={48} color="#d1d5db" />
                  <Text style={styles.emptyTitle}>No saved lessons</Text>
                  <Text style={styles.emptyBody}>
                    Recordings saved to your locker from the website show here (`POST
                    /common/get-all-saved-sessions`).
                  </Text>
                </View>
              ) : (
                (savedQ.data ?? []).map((s: any) => (
                  <View key={String(s._id)} style={styles.savedCard}>
                    <Text style={styles.savedTitle}>{s.title ?? s.file_name ?? "Saved session"}</Text>
                    {!!s.description && (
                      <Text style={styles.savedDesc} numberOfLines={3}>
                        {s.description}
                      </Text>
                    )}
                    <Text style={styles.savedMeta}>
                      {s.trainee_name || s.trainer_name
                        ? `${s.trainee_name ?? ""} ${s.trainer_name ?? ""}`.trim()
                        : ""}
                      {s.createdAt ? ` · ${new Date(s.createdAt).toLocaleDateString()}` : ""}
                    </Text>
                  </View>
                ))
              )}
            </>
          )}

          {topTab === "library" && libSub === "plans" && (
            <>
              {reportSections.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="document-text-outline" size={48} color="#d1d5db" />
                  <Text style={styles.emptyTitle}>No game plans yet</Text>
                  <Text style={styles.emptyBody}>
                    Session reports and game plan PDFs from `POST /report/get-all` (grouped by
                    date).
                  </Text>
                </View>
              ) : (
                reportSections.map((section, si) => (
                  <View key={`${section.title}-${si}`}>
                    <Text style={styles.sectionHdr}>{section.title}</Text>
                    {section.data.map((item: any, index: number) => {
                      const img = item?.reportData?.[0]?.imageUrl;
                      const title = item?.reportData?.[0]?.title ?? "Game plan";
                      const uri = getS3ImageUrl(img);
                      const pdfName = item?.session?.report;
                      return (
                        <Pressable
                          key={String(item?._id ?? index)}
                          style={styles.planCard}
                          onPress={() => {
                            const url = uri || (pdfName ? getS3ImageUrl(pdfName) : "");
                            if (url) void Linking.openURL(url);
                          }}
                        >
                          {uri ? (
                            <Image source={{ uri }} style={styles.planImg} resizeMode="cover" />
                          ) : (
                            <View style={[styles.planImg, styles.planPh]}>
                              <Ionicons name="document-outline" size={32} color={NAVY} />
                            </View>
                          )}
                          <Text style={styles.planTitle} numberOfLines={2}>
                            {title}
                          </Text>
                          <Text style={styles.planHint}>Tap to open</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f6f7fb" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  topTabs: {
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    gap: 8,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  topTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
  },
  topTabOn: { backgroundColor: NAVY },
  topTabText: { fontSize: 13, fontWeight: "600", color: "#4b5563" },
  topTabTextOn: { color: "#fff" },

  subTabs: {
    flexDirection: "row",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    gap: space.sm,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  subTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radii.sm,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
  },
  subTabOn: { backgroundColor: "#dbeafe" },
  subTabText: { fontSize: 13, fontWeight: "600", color: "#4b5563" },
  subTabTextOn: { color: NAVY },

  body: { padding: space.md, paddingBottom: space.xl * 2, gap: space.md },

  catBlock: {
    backgroundColor: "#fff",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },
  catHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: "#fafafa",
  },
  catTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: "#111827" },
  catBadge: {
    backgroundColor: NAVY,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  catBadgeText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  catBody: { paddingHorizontal: space.sm, paddingBottom: space.sm },
  clipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f3f4f6",
  },
  clipThumbBox: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    backgroundColor: "#f0f4ff",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  clipThumb: { width: 48, height: 48 },
  clipName: { fontSize: 14, fontWeight: "600", color: "#111827" },
  clipMeta: { fontSize: 12, color: "#9ca3af", marginTop: 2 },

  savedCard: {
    backgroundColor: "#fff",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: space.md,
    gap: 4,
  },
  savedTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  savedDesc: { fontSize: 13, color: "#6b7280", lineHeight: 18 },
  savedMeta: { fontSize: 12, color: "#9ca3af" },

  sectionHdr: {
    fontSize: 13,
    fontWeight: "700",
    color: NAVY,
    marginTop: space.md,
    marginBottom: 6,
  },
  planCard: {
    backgroundColor: "#fff",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: space.sm,
    marginBottom: space.sm,
  },
  planImg: {
    width: "100%",
    height: 140,
    borderRadius: radii.sm,
    backgroundColor: "#f3f4f6",
  },
  planPh: { alignItems: "center", justifyContent: "center" },
  planTitle: { fontSize: 14, fontWeight: "600", color: "#111827", marginTop: 6 },
  planHint: { fontSize: 11, color: "#9ca3af", marginTop: 2 },

  empty: { alignItems: "center", paddingVertical: space.xl * 2, gap: space.sm, paddingHorizontal: space.lg },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#374151" },
  emptyBody: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20 },
});
