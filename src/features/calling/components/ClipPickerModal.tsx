/**
 * ClipPickerModal — trainer sheet to pick up to 2 clips to broadcast.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { apiClient } from "../../../api/client";
import { ImageWithSkeleton } from "../../../components/ui";
import { API_ROUTES } from "../../../config/apiRoutes";
import { getClipPlaybackUrl, getClipThumbnailUrl } from "../../../lib/clipMediaUrl";
import {
  flattenGroupedClips,
  fetchMyClipsGrouped,
  type ClipRow,
} from "../../instant-lesson/instantLessonClipsApi";

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
  const [trainerClips, setTrainerClips] = useState<ClipRow[]>([]);
  const [traineeClips, setTraineeClips] = useState<ClipRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) return;
    setPicked(new Set(selectedClipIds.map(String)));
    let active = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const groups = await fetchMyClipsGrouped();
        if (active) setTrainerClips(flattenGroupedClips(groups));
      } catch (err: any) {
        if (active) setError(err?.message ?? "Failed to load trainer clips");
      }

      if (traineeId) {
        try {
          const res = await apiClient.post(API_ROUTES.common.traineeClips, {
            id: traineeId,
          });
          const raw = res.data?.data ?? res.data?.result ?? res.data ?? [];
          const flat: ClipRow[] = Array.isArray(raw)
            ? raw.flatMap((g: any) => (Array.isArray(g?.clips) ? g.clips : []))
            : [];
          if (active) setTraineeClips(flat);
        } catch (err: any) {
          if (active && !error) {
            setError(err?.message ?? "Failed to load trainee clips");
          }
        }
      }
      if (active) setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [visible, traineeId]);

  const allClips = useMemo(
    () => [...trainerClips, ...traineeClips],
    [trainerClips, traineeClips]
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

  const confirm = useCallback(() => {
    const selected = allClips.filter((c) => picked.has(String(c._id))).slice(0, MAX_CLIPS);
    if (selected.length === 0) return;
    const playable = selected.filter((c) => getClipPlaybackUrl(c));
    if (playable.length === 0) {
      setError("Selected clips cannot be played.");
      return;
    }
    onDone(playable);
    onClose();
  }, [allClips, onClose, onDone, picked]);

  const data = useMemo(() => {
    const out: Array<{ key: string; title: string; clips: ClipRow[] }> = [];
    if (trainerClips.length) out.push({ key: "mine", title: "My clips", clips: trainerClips });
    if (traineeClips.length)
      out.push({ key: "trainee", title: "Trainee clips", clips: traineeClips });
    return out;
  }, [trainerClips, traineeClips]);

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
          <Pressable
            onPress={confirm}
            hitSlop={12}
            disabled={picked.size === 0}
            style={picked.size === 0 ? styles.doneDisabled : undefined}
          >
            <Text style={[styles.done, picked.size === 0 && styles.doneMuted]}>Done</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#111" />
            <Text style={styles.muted}>Loading clips…</Text>
          </View>
        ) : data.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.muted}>{error ?? "No clips available yet."}</Text>
          </View>
        ) : (
          <FlatList
            data={data}
            keyExtractor={(item) => item.key}
            contentContainerStyle={{ padding: 16, gap: 18 }}
            renderItem={({ item }) => (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{item.title}</Text>
                <View style={styles.grid}>
                  {item.clips.map((clip) => {
                    const id = String(clip._id);
                    const selected = picked.has(id);
                    const atMax = picked.size >= MAX_CLIPS && !selected;
                    const thumb = getClipThumbnailUrl(clip);
                    return (
                      <Pressable
                        key={id}
                        style={[
                          styles.clipCard,
                          selected && styles.clipCardActive,
                          atMax && styles.clipCardDisabled,
                        ]}
                        onPress={() => toggleClip(clip)}
                        disabled={atMax}
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
                        {clip.category ? (
                          <Text style={styles.clipMeta}>{clip.category}</Text>
                        ) : null}
                        {!getClipPlaybackUrl(clip) ? (
                          <Text style={styles.clipWarning}>Cannot play this clip</Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          />
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  muted: { color: "#666", fontSize: 14 },
  section: {},
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#444", marginBottom: 8 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
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
