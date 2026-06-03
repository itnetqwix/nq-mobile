/**
 * Dedicated off-screen RTCView for live lesson screenshots.
 * Isolated from Skia/overlays so view-shot is more reliable than the main stage.
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { RTCView, type MediaStream } from "react-native-webrtc";

const HOST_WIDTH = 720;
const HOST_HEIGHT = 480;

type Props = {
  stream: MediaStream | null;
  captureRef: React.RefObject<View | null>;
};

export function LiveVideoCaptureHost({ stream, captureRef }: Props) {
  const streamId = (stream as { toURL?: () => string } | null)?.toURL?.() ?? null;
  const videoTracks = stream?.getVideoTracks?.()?.length ?? 0;
  const rtcKey = streamId ? `${streamId}-v${videoTracks}` : "idle";

  return (
    <View
      ref={captureRef}
      collapsable={false}
      style={styles.host}
      pointerEvents="none"
    >
      {streamId ? (
        <RTCView
          key={rtcKey}
          streamURL={streamId}
          objectFit="cover"
          style={styles.rtc}
        />
      ) : (
        <View style={styles.placeholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: -6000,
    top: 0,
    width: HOST_WIDTH,
    height: HOST_HEIGHT,
    backgroundColor: "#0a0a12",
    overflow: "hidden",
  },
  rtc: {
    width: HOST_WIDTH,
    height: HOST_HEIGHT,
  },
  placeholder: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
});
