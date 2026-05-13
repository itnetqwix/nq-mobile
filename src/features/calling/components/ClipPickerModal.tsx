/**
 * ClipPickerModal — trainer-only sheet to pick a clip to broadcast.
 *
 * Web reference: `nq-frontend-main/app/components/portrait-calling/clip-mode.jsx`
 * uses two endpoints depending on role:
 *   • `/common/get-clips`            → trainer's own locker clips
 *   • `/common/trainee-clips`        → clips the trainee has uploaded that
 *                                      the trainer should be able to review
 *
 * Mobile reuses the existing `fetchMyClipsGrouped` helper for trainer clips
 * and `apiClient` directly for trainee clips so the call signatures stay 1:1
 * with the web.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { getClipPlaybackUrl } from "../../../lib/clipMediaUrl";
import {
  flattenGroupedClips,
  fetchMyClipsGrouped,
  type ClipRow,
} from "../../instant-lesson/instantLessonClipsApi";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (clip: ClipRow) => void;
  /** Pass the trainee id to also include their uploaded clips. */
  traineeId?: string;
  /** Pre-selected (so the modal can re-highlight) clip id. */
  activeClipId?: string | null;
};

export function ClipPickerModal({
  visible,
  onClose,
  onSelect,
  traineeId,
  activeClipId,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [trainerClips, setTrainerClips] = useState<ClipRow[]>([]);
  const [traineeClips, setTraineeClips] = useState<ClipRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
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
          const raw =
            res.data?.data ?? res.data?.result ?? res.data ?? [];
          const flat: ClipRow[] = Array.isArray(raw)
            ? raw.flatMap((g: any) =>
                Array.isArray(g?.clips) ? g.clips : []
              )
            : [];
          if (active) setTraineeClips(flat);
        } catch (err: any) {
          if (active && !error) setError(err?.message ?? "Failed to load trainee clips");
        }
      }
      if (active) setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [visible, traineeId, error]);

  const data = useMemo(() => {
    const out: Array<{ key: string; title: string; clips: ClipRow[] }> = [];
    if (trainerClips.length) out.push({ key: "mine", title: "My clips", clips: trainerClips });
    if (traineeClips.length)
      out.push({ key: "trainee", title: "Trainee clips", clips: traineeClips });
    return out;
  }, [trainerClips, traineeClips]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
          <Text style={styles.title}>Select a clip</Text>
          <View style={{ width: 60 }} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#000080" />
            <Text style={styles.muted}>Loading clips…</Text>
          </View>
        ) : data.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.muted}>
              {error ?? "No clips available yet."}
            </Text>
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
                  {item.clips.map((clip) => (
                    <Pressable
                      key={clip._id}
                      style={[
                        styles.clipCard,
                        activeClipId === clip._id && styles.clipCardActive,
                      ]}
                      onPress={() => {
                        onSelect(clip);
                        onClose();
                      }}
                    >
                      {clip.thumbnail ? (
                        <Image
                          source={{ uri: clip.thumbnail }}
                          style={styles.thumb}
                        />
                      ) : (
                        <View style={[styles.thumb, styles.thumbFallback]}>
                          <Text style={{ color: "#fff" }}>VIDEO</Text>
                        </View>
                      )}
                      <Text style={styles.clipTitle} numberOfLines={2}>
                        {clip.title || clip.name || "Untitled clip"}
                      </Text>
                      {clip.category ? (
                        <Text style={styles.clipMeta}>{clip.category}</Text>
                      ) : null}
                      {/* Forces the playback URL resolution to fail fast at
                          render time so we don't broadcast a clip that can't
                          actually play on the trainee's device. */}
                      {!getClipPlaybackUrl(clip) ? (
                        <Text style={styles.clipWarning}>
                          Unable to resolve playback URL
                        </Text>
                      ) : null}
                    </Pressable>
                  ))}
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
  close: { color: "#000080", fontSize: 15, fontWeight: "600" },
  title: { fontSize: 16, fontWeight: "700", color: "#111" },
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
    borderColor: "#000080",
  },
  thumb: {
    height: 100,
    borderRadius: 8,
    width: "100%",
    backgroundColor: "#222",
  },
  thumbFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  clipTitle: { marginTop: 6, fontSize: 13, fontWeight: "600", color: "#111" },
  clipMeta: { marginTop: 2, fontSize: 11, color: "#666" },
  clipWarning: { marginTop: 4, fontSize: 11, color: "#d32f2f" },
});
