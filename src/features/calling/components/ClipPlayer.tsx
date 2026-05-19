/**
 * ClipPlayer — large-screen video player for the active lesson clip. Mirrors
 * `nq-frontend-main/app/components/portrait-calling/clip-mode.jsx` clip pane.
 *
 *   • Uses `expo-av` Video which has native HW decoding for mp4/h264 on iOS &
 *     Android (no extra deps).
 *   • Playback is driven via props (`isPlaying`, `seekTargetMs`) and callbacks.
 *   • Trainees on web side this same lifecycle works because the socket
 *     payloads are identical.
 */

import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { ResizeMode, Video, type AVPlaybackStatus } from "expo-av";

export type ClipPlayerHandle = {
  play: () => Promise<void> | void;
  pause: () => Promise<void> | void;
  seekTo: (seconds: number) => Promise<void> | void;
};

type Props = {
  uri: string;
  isPlaying: boolean;
  /** Optional remote seek hint; applied imperatively when it changes. */
  seekTargetMs?: number | null;
  /** Local control should suppress synced seeks for a moment (e.g. trainer). */
  isControlling?: boolean;
  onProgressSeconds?: (seconds: number) => void;
  onDurationSeconds?: (seconds: number) => void;
  onEnded?: () => void;
};

export function ClipPlayer({
  uri,
  isPlaying,
  seekTargetMs,
  onProgressSeconds,
  onDurationSeconds,
  onEnded,
}: Props) {
  const videoRef = useRef<Video>(null);

  useEffect(() => {
    const player = videoRef.current;
    if (!player) return;
    if (isPlaying) player.playAsync().catch(() => undefined);
    else player.pauseAsync().catch(() => undefined);
  }, [isPlaying]);

  useEffect(() => {
    if (seekTargetMs == null) return;
    videoRef.current
      ?.setPositionAsync(Math.max(0, seekTargetMs))
      .catch(() => undefined);
  }, [seekTargetMs]);

  return (
    <View style={styles.wrap}>
      <Video
        ref={videoRef}
        source={{ uri }}
        style={styles.player}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={isPlaying}
        isLooping={false}
        useNativeControls={false}
        onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
          if (!status.isLoaded) return;
          if (status.didJustFinish) onEnded?.();
          if (typeof status.durationMillis === "number" && status.durationMillis > 0) {
            onDurationSeconds?.(status.durationMillis / 1000);
          }
          if (onProgressSeconds && typeof status.positionMillis === "number") {
            onProgressSeconds(status.positionMillis / 1000);
          }
        }}
        onError={(e) => {
          // eslint-disable-next-line no-console
          console.warn("[ClipPlayer] error", e);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: "#000",
    borderRadius: 16,
    overflow: "hidden",
  },
  player: {
    flex: 1,
  },
});
