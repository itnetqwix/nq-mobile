import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { ResizeMode, Video, type AVPlaybackStatus } from "expo-av";
type Props = {
  uri: string;
  mode: "image" | "video";
  width: number;
  height: number;
  /** When false, video pauses (e.g. off-screen gallery page). */
  isActive?: boolean;
  useNativeVideoControls?: boolean;
  onReady?: () => void;
  onError?: () => void;
};

/**
 * Native image / video surface — avoids WebView for S3 clips (faster, better controls).
 */
export function NativeMediaSurface({
  uri,
  mode,
  width,
  height,
  isActive = true,
  useNativeVideoControls = true,
  onReady,
  onError,
}: Props) {
  const videoRef = useRef<Video>(null);
  const [buffering, setBuffering] = useState(mode === "video");

  useEffect(() => {
    const v = videoRef.current;
    if (!v || mode !== "video") return;
    if (isActive) void v.playAsync().catch(() => undefined);
    else void v.pauseAsync().catch(() => undefined);
  }, [isActive, mode, uri]);

  const onPlaybackStatus = useCallback(
    (status: AVPlaybackStatus) => {
      if (!status.isLoaded) {
        if (status.error) onError?.();
        return;
      }
      if (status.isBuffering) setBuffering(true);
      else {
        setBuffering(false);
        onReady?.();
      }
    },
    [onError, onReady]
  );

  if (!uri?.trim()) {
    onError?.();
    return <View style={[styles.box, { width, height }]} />;
  }

  if (mode === "video") {
    return (
      <View style={[styles.box, { width, height }]}>
        <Video
          ref={videoRef}
          source={{ uri }}
          style={{ width, height }}
          resizeMode={ResizeMode.CONTAIN}
          useNativeControls={useNativeVideoControls}
          shouldPlay={isActive}
          isLooping={false}
          onPlaybackStatusUpdate={onPlaybackStatus}
          onError={() => onError?.()}
        />
        {buffering && isActive ? (
          <View style={styles.buffering} pointerEvents="none">
            <ActivityIndicator size="large" color="#fff" />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.box, { width, height }]}>
      <Image
        source={{ uri }}
        style={{ width, height }}
        contentFit="contain"
        transition={200}
        onLoad={() => onReady?.()}
        onError={() => onError?.()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  buffering: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
});
