/**
 * ClipPickerModal — trainer sheet to pick up to 2 clips to broadcast.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { MediaLoadingOverlay } from "../../../components/media/MediaLoadingOverlay";
import { ImageWithSkeleton } from "../../../components/ui";
import {
  getClipPlaybackUrl,
  getClipThumbnailUrl,
  isLikelyPdf,
} from "../../../lib/clipMediaUrl";
import {
  flattenGroupedClips,
  fetchMyClipsGrouped,
  type ClipRow,
} from "../../instant-lesson/instantLessonClipsApi";
import {
  postLibraryClipsNested,
  postSharedClipsBySharer,
  type NestedCategoryGroup,
  type SharedClipsGroup,
} from "../../clips/api/clipsApi";

const MAX_CLIPS = 2;

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Called when trainer confirms selection (1–2 clips). */
  onDone: (clips: ClipRow[]) => void;
  traineeId?: string;
  /** Currently broadcast clip ids (for highlight). */
  selectedClipIds?: string[];
};

export function ClipPickerModal({
  visible,
  onClose,
  onDone,
  traineeId,
  selectedClipIds = [],
}: Props) {
  const [loading, setLoading] = useState(false);
  const [lockerClips, setLockerClips] = useState<ClipRow[]>([]);
  const [sharedClips, setSharedClips] = useState<ClipRow[]>([]);
  const [libraryClips, setLibraryClips] = useState<ClipRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"locker" | "shared" | "library">("locker");

  const dedupeClips = useCallback((rows: ClipRow[]): ClipRow[] => {
    const seen = new Set<string>();
    const out: ClipRow[] = [];
    for (const row of rows) {
      const id = String(row?._id ?? "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(row);
    }
    return out;
  }, []);

  const flattenNestedGroups = useCallback(
    (groups: NestedCategoryGroup[]): ClipRow[] => {
      const out: ClipRow[] = [];
      for (const group of groups ?? []) {
        for (const sub of group?.subcategories ?? []) {
          for (const clip of sub?.clips ?? []) {
            if (clip?._id) out.push(clip as ClipRow);
          }
        }
      }
      return dedupeClips(out);
    },
    [dedupeClips]
  );

  const flattenSharedGroups = useCallback(
    (groups: SharedClipsGroup[]): ClipRow[] => {
      const out: ClipRow[] = [];
      for (const group of groups ?? []) {
        for (const clip of group?.clips ?? []) {
          if (clip?._id) out.push(clip as ClipRow);
        }
      }
      return dedupeClips(out);
    },
    [dedupeClips]
  );

  useEffect(() => {
    if (!visible) return;
    setPicked(new Set(selectedClipIds.map(String)));
    setActiveTab("locker");
    let active = true;
    setLoading(true);
    setError(null);

    (async () => {
      const [mineResult, sharedResult, libraryResult] = await Promise.allSettled([
        fetchMyClipsGrouped(),
        postSharedClipsBySharer(),
        postLibraryClipsNested(),
      ]);
      if (!active) return;

      if (mineResult.status === "fulfilled") {
        setLockerClips(dedupeClips(flattenGroupedClips(mineResult.value)));
      } else {
        setLockerClips([]);
      }
      if (sharedResult.status === "fulfilled") {
        setSharedClips(flattenSharedGroups(sharedResult.value));
      } else {
        setSharedClips([]);
      }
      if (libraryResult.status === "fulfilled") {
        setLibraryClips(flattenNestedGroups(libraryResult.value));
      } else {
        setLibraryClips([]);
      }

      if (
        mineResult.status === "rejected" &&
        sharedResult.status === "rejected" &&
        libraryResult.status === "rejected"
      ) {
        setError("Failed to load clips");
      }
      if (active) setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [visible, dedupeClips, flattenNestedGroups, flattenSharedGroups]);

  const allClips = useMemo(
    () => dedupeClips([...lockerClips, ...sharedClips, ...libraryClips]),
    [lockerClips, sharedClips, libraryClips, dedupeClips]
  );

  const toggleClip = useCallback((clip: ClipRow) => {
    const id = String(clip._id);
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      if (next.size >= MAX_CLIPS) return prev;
      next.add(id);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    onDone([]);
    onClose();
  }, [onClose, onDone]);

  const confirm = useCallback(() => {
    const selected = allClips.filter((c) => picked.has(String(c._id))).slice(0, MAX_CLIPS);
    if (selected.length === 0) return;
    const playable = selected.filter((c) => {
      const name = String(c.title ?? c.name ?? (c as { file_name?: string }).file_name ?? "");
      return getClipPlaybackUrl(c) && !isLikelyPdf(name);
    });
    if (playable.length === 0) {
      setError("Selected items cannot play in a live lesson (PDFs open after the call).");
      return;
    }
    onDone(playable);
    onClose();
  }, [allClips, onClose, onDone, picked]);

  const tabCounts = useMemo(
    () => ({
      locker: lockerClips.length,
      shared: sharedClips.length,
      library: libraryClips.length,
    }),
    [lockerClips.length, sharedClips.length, libraryClips.length]
  );

  const activeClips = useMemo(() => {
    if (activeTab === "shared") return sharedClips;
    if (activeTab === "library") return libraryClips;
    return lockerClips;
  }, [activeTab, lockerClips, sharedClips, libraryClips]);

  const selectionLabel = `${picked.size}/${MAX_CLIPS} selected`;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Select clips</Text>
            <Text style={styles.subtitle}>{selectionLabel}</Text>
          </View>
          <Pressable onPress={confirm} hitSlop={12} disabled={picked.size === 0}>
            <Text style={[styles.done, picked.size === 0 && styles.doneMuted]}>Done</Text>
          </Pressable>
        </View>

        {selectedClipIds.length > 0 ? (
          <Pressable style={styles.clearRow} onPress={clearAll}>
            <Text style={styles.clearText}>Clear clips and return to live video</Text>
          </Pressable>
        ) : null}

        {loading ? (
          <View style={styles.center}>
            <MediaLoadingOverlay message="Loading clips" />
          </View>
        ) : allClips.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.muted}>{error ?? "No clips available yet."}</Text>
          </View>
        ) : (
          <View style={styles.body}>
            <View style={styles.tabsRow}>
              <Pressable
                style={[styles.tabBtn, activeTab === "locker" && styles.tabBtnActive]}
                onPress={() => setActiveTab("locker")}
              >
                <Text style={[styles.tabLabel, activeTab === "locker" && styles.tabLabelActive]}>
                  Locker ({tabCounts.locker})
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tabBtn, activeTab === "shared" && styles.tabBtnActive]}
                onPress={() => setActiveTab("shared")}
              >
                <Text style={[styles.tabLabel, activeTab === "shared" && styles.tabLabelActive]}>
                  Shared ({tabCounts.shared})
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tabBtn, activeTab === "library" && styles.tabBtnActive]}
                onPress={() => setActiveTab("library")}
              >
                <Text style={[styles.tabLabel, activeTab === "library" && styles.tabLabelActive]}>
                  NetQwix ({tabCounts.library})
                </Text>
              </Pressable>
            </View>

            {activeClips.length === 0 ? (
              <View style={styles.center}>
                <Text style={styles.muted}>No clips in this tab yet.</Text>
              </View>
            ) : (
              <FlatList
                data={activeClips}
                keyExtractor={(item, index) => `${activeTab}-${String(item._id)}-${index}`}
                contentContainerStyle={{ padding: 16 }}
                numColumns={2}
                columnWrapperStyle={styles.gridRow}
                renderItem={({ item: clip }) => {
                  const id = String(clip._id);
                  const selected = picked.has(id);
                  const atMax = picked.size >= MAX_CLIPS && !selected;
                  const thumb = getClipThumbnailUrl(clip);
                  const clipName = String(
                    clip.title ?? clip.name ?? (clip as { file_name?: string }).file_name ?? ""
                  );
                  const isPdf = isLikelyPdf(clipName);
                  const canPlay = !isPdf && !!getClipPlaybackUrl(clip);
                  return (
                    <Pressable
                      style={[
                        styles.clipCard,
                        selected && styles.clipCardActive,
                        (atMax || isPdf) && styles.clipCardDisabled,
                      ]}
                      onPress={() => toggleClip(clip)}
                      disabled={atMax || isPdf}
                    >
                      <View style={styles.thumbWrap}>
                        {thumb ? (
                          <ImageWithSkeleton
                            uri={thumb}
                            width={160}
                            height={100}
                            borderRadius={8}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={[styles.thumb, styles.thumbFallback]}>
                            <Ionicons name="film-outline" size={28} color="#888" />
                          </View>
                        )}
                        <View style={styles.checkWrap}>
                          <Ionicons
                            name={selected ? "checkbox" : "square-outline"}
                            size={22}
                            color={selected ? "#fff" : "rgba(255,255,255,0.9)"}
                          />
                        </View>
                      </View>
                      <Text style={styles.clipTitle} numberOfLines={2}>
                        {clip.title || clip.name || "Untitled clip"}
                      </Text>
                      {clip.category ? <Text style={styles.clipMeta}>{clip.category}</Text> : null}
                      {isPdf ? (
                        <Text style={styles.clipWarning}>PDF — open after lesson</Text>
                      ) : !canPlay ? (
                        <Text style={styles.clipWarning}>Cannot play in call</Text>
                      ) : null}
                    </Pressable>
                  );
                }}
              />
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8f8fb" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  close: { color: "#111", fontSize: 15, fontWeight: "600", width: 60 },
  done: { color: "#111", fontSize: 15, fontWeight: "700", width: 60, textAlign: "right" },
  doneMuted: { color: "#aaa" },
  doneDisabled: { opacity: 0.5 },
  title: { fontSize: 16, fontWeight: "700", color: "#111" },
  subtitle: { fontSize: 12, color: "#666", marginTop: 2 },
  clearRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  clearText: { fontSize: 14, fontWeight: "600", color: "#b91c1c", textAlign: "center" },
  body: { flex: 1 },
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  tabBtnActive: {
    borderColor: "#111",
    backgroundColor: "#111",
  },
  tabLabel: {
    color: "#333",
    fontSize: 12,
    fontWeight: "700",
  },
  tabLabelActive: {
    color: "#fff",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  muted: { color: "#666", fontSize: 14 },
  gridRow: { justifyContent: "space-between", marginBottom: 12 },
  clipCard: {
    width: "47%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  clipCardActive: {
    borderColor: "#111",
  },
  clipCardDisabled: {
    opacity: 0.45,
  },
  thumbWrap: {
    position: "relative",
    borderRadius: 8,
    overflow: "hidden",
  },
  thumb: {
    height: 100,
    borderRadius: 8,
    width: "100%",
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbFallback: {},
  checkWrap: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 4,
    padding: 2,
  },
  clipTitle: { marginTop: 6, fontSize: 13, fontWeight: "600", color: "#111" },
  clipMeta: { marginTop: 2, fontSize: 11, color: "#666" },
  clipWarning: { marginTop: 4, fontSize: 11, color: "#d32f2f" },
});
