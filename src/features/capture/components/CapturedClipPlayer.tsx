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
import { NetQwixVideoControls } from "../../../components/media/NetQwixVideoControls";
import { colors, radii, space, typography } from "../../../theme";
import type { CapturedClip } from "../screens/CaptureScreen";

type Props = {
  clip: CapturedClip | null;
  onDelete: () => void;
  onShare: () => void;
};

export function CapturedClipPlayer({ clip, onDelete, onShare }: Props) {
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [positionSec, setPositionSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);

  useEffect(() => {
    setIsPlaying(false);
    setPositionSec(0);
    setDurationSec(0);
    void videoRef.current?.stopAsync();
  }, [clip?.id]);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      setIsLoading(!!status.isBuffering);
      return;
    }
    setIsLoading(false);
    setIsPlaying(status.isPlaying);
    setPositionSec(status.positionMillis / 1000);
    if (typeof status.durationMillis === "number" && status.durationMillis > 0) {
      setDurationSec(status.durationMillis / 1000);
    }
    if (status.didJustFinish) {
      void videoRef.current?.setPositionAsync(0);
      setIsPlaying(false);
      setPositionSec(0);
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

  const seekTo = useCallback((seconds: number) => {
    videoRef.current
      ?.setPositionAsync(Math.max(0, seconds * 1000))
      .catch(() => undefined);
    setPositionSec(seconds);
  }, []);

  if (!clip) {
    return (
      <View style={styles.emptyPlayer}>
        <View style={styles.emptyIconWrap}>
          <Ionicons name="film-outline" size={36} color={colors.brandNavy} />
        </View>
        <Text style={styles.emptyTitle}>No clip selected</Text>
        <Text style={styles.emptyText}>Tap a clip below to preview it here</Text>
      </View>
    );
  }

  const displayDuration =
    durationSec > 0 ? durationSec : clip.durationSecs ?? 0;

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

        {(isLoading || !isPlaying) && (
          <Pressable style={styles.centerTap} onPress={togglePlay}>
            {isLoading ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : (
              <View style={styles.centerPlay}>
                <Ionicons
                  name="play"
                  size={34}
                  color="#fff"
                  style={styles.centerPlayIcon}
                />
              </View>
            )}
          </Pressable>
        )}
      </View>

      <NetQwixVideoControls
        variant="dock"
        size="large"
        isPlaying={isPlaying}
        progressSeconds={positionSec}
        durationSeconds={displayDuration}
        isBuffering={isLoading}
        onTogglePlay={() => void togglePlay()}
        onSeek={seekTo}
      />

      <View style={styles.metaRow}>
        <View style={styles.meta}>
          <Text style={styles.metaLabel}>Captured</Text>
          <Text style={styles.metaDate}>
            {new Date(clip.createdAt).toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
        <View style={styles.toolbar}>
          <Pressable
            style={({ pressed }) => [styles.toolBtn, pressed && styles.toolBtnPressed]}
            onPress={onShare}
            accessibilityLabel="Share clip"
          >
            <Ionicons name="share-social-outline" size={20} color={colors.brandNavy} />
            <Text style={styles.toolLabel}>Share</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.toolBtn,
              styles.toolBtnDanger,
              pressed && styles.toolBtnPressed,
            ]}
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
    marginBottom: space.sm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  emptyPlayer: {
    aspectRatio: 16 / 9,
    marginHorizontal: space.md,
    marginBottom: space.md,
    borderRadius: radii.lg,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: space.lg,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { ...typography.bodyMd, fontWeight: "700", color: "#0f172a" },
  emptyText: { ...typography.bodySm, color: "#64748b", textAlign: "center" },
  videoWrap: {
    aspectRatio: 16 / 9,
    backgroundColor: "#000",
    position: "relative",
  },
  video: { width: "100%", height: "100%" },
  centerTap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  centerPlay: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(0,0,128,0.75)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
  },
  centerPlayIcon: { marginLeft: 4 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    gap: space.sm,
    backgroundColor: "#1e293b",
  },
  meta: { flex: 1 },
  metaLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  metaDate: { fontSize: 14, fontWeight: "600", color: "#f1f5f9" },
  toolbar: { flexDirection: "row", alignItems: "center", gap: 8 },
  toolBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radii.pill,
    backgroundColor: "#fff",
  },
  toolBtnDanger: { backgroundColor: "#fef2f2" },
  toolBtnPressed: { opacity: 0.88 },
  toolLabel: { fontSize: 13, fontWeight: "700", color: colors.brandNavy },
  toolLabelDanger: { color: "#ef4444" },
});
