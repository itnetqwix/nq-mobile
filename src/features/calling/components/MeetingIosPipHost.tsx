import React, { useMemo } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { RTCView, type MediaStream } from "react-native-webrtc";

type Props = {
  /** Remote (or preferred) WebRTC stream shown in system PiP when app backgrounds. */
  stream: MediaStream | null;
  enabled: boolean;
};

/**
 * Dedicated RTCView for iOS system PiP (react-native-webrtc `iosPIP`).
 * Kept minimal/off-screen; WebRTC feeds AVSampleBuffer for PiP on background.
 */
export function MeetingIosPipHost({ stream, enabled }: Props) {
  const streamURL = useMemo(() => {
    if (!stream) return null;
    const url = (stream as MediaStream & { toURL?: () => string }).toURL?.();
    return url ?? null;
  }, [stream]);

  if (Platform.OS !== "ios" || !enabled || !streamURL) {
    return null;
  }

  return (
    <View style={styles.host} pointerEvents="none" collapsable={false}>
      <RTCView
        streamURL={streamURL}
        objectFit="cover"
        style={styles.video}
        iosPIP={{
          enabled: true,
          startAutomatically: true,
          stopAutomatically: true,
          preferredSize: { width: 720, height: 1280 },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    width: 2,
    height: 2,
    opacity: 0.02,
    left: 0,
    bottom: 0,
    overflow: "hidden",
  },
  video: {
    width: 2,
    height: 2,
  },
});
