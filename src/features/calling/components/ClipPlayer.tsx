/**
 * ClipPlayer — large-screen video player for the active lesson clip. Mirrors
 * `nq-frontend-main/app/components/portrait-calling/clip-mode.jsx` clip pane.
 *
 *   • Uses `expo-av` Video which has native HW decoding for mp4/h264 on iOS &
 *     Android (no extra deps).
 *   • The trainer drives playback via socket events handled by `useClipSync`;
 *     this player applies them via the ref imperative API.
 *   • Trainees on web side this same lifecycle works because the socket
 *     payloads are identical.
 */

import React, { useEffect, useImperativeHandle, useRef } from "react";
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
  onProgressSeconds?: (progress: number) => void;
  onEnded?: () => void;
};

export const ClipPlayer = React.forwardRef<ClipPlayerHandle, Props>(
  function ClipPlayer(
    { uri, isPlaying, seekTargetMs, onProgressSeconds, onEnded },
    ref
  ) {
    const videoRef = useRef<Video>(null);

    useImperativeHandle(
      ref,
      () => ({
        play: () => {
          videoRef.current?.playAsync().catch(() => undefined);
        },
        pause: () => {
          videoRef.current?.pauseAsync().catch(() => undefined);
        },
        seekTo: (seconds: number) => {
          videoRef.current
            ?.setPositionAsync(Math.max(0, seconds * 1000))
            .catch(() => undefined);
        },
      }),
      []
    );

    useEffect(() => {
      const ref = videoRef.current;
      if (!ref) return;
      if (isPlaying) ref.playAsync().catch(() => undefined);
      else ref.pauseAsync().catch(() => undefined);
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
);

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
