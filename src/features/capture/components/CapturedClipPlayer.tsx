import { Ionicons } from "@expo/vector-icons";
import { AVPlaybackStatus, ResizeMode, Video } from "expo-av";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, radii, space, typography } from "../../../theme";
import type { CapturedClip } from "../screens/CaptureScreen";

type Props = {
  clip: CapturedClip | null;
  onDelete: () => void;
  onShare: () => void;
};

function formatTime(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function CapturedClipPlayer({ clip, onDelete, onShare }: Props) {
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  useEffect(() => {
    setIsPlaying(false);
    setPositionMs(0);
    setDurationMs(0);
    void videoRef.current?.stopAsync();
  }, [clip?.id]);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      setIsLoading(!!status.isBuffering);
      return;
    }
    setIsLoading(false);
    setIsPlaying(status.isPlaying);
    setPositionMs(status.positionMillis);
    setDurationMs(status.durationMillis ?? 0);
    if (status.didJustFinish) {
      void videoRef.current?.setPositionAsync(0);
      setIsPlaying(false);
    }
  }, []);

  const togglePlay = useCallback(async () => {
    if (!clip || !videoRef.current) return;
    const status = await videoRef.current.getStatusAsync();
    if (!status.isLoaded) return;
    if (status.isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
  }, [clip]);

  if (!clip) {
    return (
      <View style={styles.emptyPlayer}>
        <Ionicons name="film-outline" size={40} color="#6b7280" />
        <Text style={styles.emptyText}>Select a clip to preview</Text>
      </View>
    );
  }

  const progress = durationMs > 0 ? positionMs / durationMs : 0;

  return (
    <View style={styles.shell}>
      <View style={styles.videoWrap}>
        <Video
          ref={videoRef}
          source={{ uri: clip.uri }}
          style={styles.video}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={false}
          isLooping={false}
          useNativeControls={false}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
        />

        <Pressable style={styles.tapOverlay} onPress={togglePlay}>
          {isLoading ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : !isPlaying ? (
            <View style={styles.playBtn}>
              <Ionicons name="play" size={32} color="#fff" style={{ marginLeft: 4 }} />
            </View>
          ) : null}
        </Pressable>

        {isPlaying && (
          <Pressable style={styles.pauseHit} onPress={togglePlay}>
            <View style={styles.pauseBtn}>
              <Ionicons name="pause" size={22} color="#fff" />
            </View>
          </Pressable>
        )}
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.min(100, progress * 100)}%` }]} />
      </View>
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatTime(positionMs)}</Text>
        <Text style={styles.timeText}>
          {durationMs > 0 ? formatTime(durationMs) : clip.durationSecs ? formatTime(clip.durationSecs * 1000) : "0:00"}
        </Text>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.meta}>
          <Text style={styles.metaDate}>
            {new Date(clip.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
        <View style={styles.toolbar}>
          <Pressable style={styles.toolBtn} onPress={onShare} accessibilityLabel="Share clip">
            <Ionicons name="share-social-outline" size={20} color={colors.brandNavy} />
            <Text style={styles.toolLabel}>Share</Text>
          </Pressable>
          <Pressable
            style={[styles.toolBtn, styles.toolBtnDanger]}
            onPress={onDelete}
            accessibilityLabel="Delete clip"
          >
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
            <Text style={[styles.toolLabel, styles.toolLabelDanger]}>Delete</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: "#0f172a",
    borderRadius: radii.lg,
    overflow: "hidden",
    marginHorizontal: space.md,
    marginBottom: space.md,
  },
  emptyPlayer: {
    aspectRatio: 16 / 9,
    marginHorizontal: space.md,
    marginBottom: space.md,
    borderRadius: radii.lg,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  emptyText: { ...typography.bodySm, color: "#6b7280" },
  videoWrap: {
    aspectRatio: 16 / 9,
    backgroundColor: "#000",
    position: "relative",
  },
  video: { width: "100%", height: "100%" },
  tapOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
  },
  pauseHit: {
    position: "absolute",
    right: space.sm,
    bottom: space.sm,
  },
  pauseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  progressTrack: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginHorizontal: space.md,
    marginTop: space.sm,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.brandAccent,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: space.md,
    paddingTop: 4,
  },
  timeText: { fontSize: 11, color: "rgba(255,255,255,0.7)", fontVariant: ["tabular-nums"] },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    gap: space.sm,
  },
  meta: { flex: 1 },
  metaDate: { fontSize: 13, fontWeight: "600", color: "#e2e8f0" },
  toolbar: { flexDirection: "row", alignItems: "center", gap: 8 },
  toolBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: "#fff",
  },
  toolBtnDanger: { backgroundColor: "#fef2f2" },
  toolLabel: { fontSize: 12, fontWeight: "700", color: colors.brandNavy },
  toolLabelDanger: { color: "#ef4444" },
});
