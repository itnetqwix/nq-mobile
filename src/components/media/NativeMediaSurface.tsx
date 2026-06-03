import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { ResizeMode, Video, type AVPlaybackStatus } from "expo-av";
import { Skeleton } from "../ui/Skeleton";
import { MediaLoadingOverlay } from "./MediaLoadingOverlay";
import { NetQwixVideoControls } from "./NetQwixVideoControls";

export type NativeMediaSurfaceProps = {
  uri: string;
  mode: "image" | "video";
  width: number;
  height: number;
  /** When false, video pauses (e.g. off-screen gallery page). */
  isActive?: boolean;
  /**
   * `internal` — this component shows the branded loader.
   * `parent` — parent shows loader via `onLoadingChange` (no duplicate overlay).
   * `none` — no loading chrome.
   */
  loadingMode?: "internal" | "parent" | "none";
  onLoadingChange?: (loading: boolean) => void;
  /** OS stock controls (avoid in fullscreen viewers). */
  useNativeVideoControls?: boolean;
  /** NetQwix play bar when native controls are off. */
  showCustomControls?: boolean;
  onReady?: () => void;
  onError?: () => void;
  loadingOverlayVariant?: "branded" | "minimal";
};

/**
 * Unified image/video surface — branded loading, optional custom controls,
 * single loading signal for parents (fixes double-spinner viewers).
 */
export function NativeMediaSurface({
  uri,
  mode,
  width,
  height,
  isActive = true,
  loadingMode = "internal",
  onLoadingChange,
  useNativeVideoControls = false,
  showCustomControls = true,
  onReady,
  onError,
  loadingOverlayVariant = "branded",
}: NativeMediaSurfaceProps) {
  const videoRef = useRef<Video>(null);
  const readyOnce = useRef(false);
  const [imageLoading, setImageLoading] = useState(mode === "image");
  const [videoInitialLoading, setVideoInitialLoading] = useState(mode === "video");
  const [isBuffering, setIsBuffering] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [progressSeconds, setProgressSeconds] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);

  const showInternalOverlay =
    loadingMode === "internal" && mode === "video" && videoInitialLoading;

  const publishLoading = useCallback(
    (loading: boolean) => {
      onLoadingChange?.(loading);
    },
    [onLoadingChange]
  );

  useEffect(() => {
    readyOnce.current = false;
    setImageLoading(mode === "image");
    setVideoInitialLoading(mode === "video");
    setIsBuffering(false);
    setUserPaused(false);
    setProgressSeconds(0);
    setDurationSeconds(0);
  }, [uri, mode]);

  useEffect(() => {
    const loading =
      mode === "image" ? imageLoading : videoInitialLoading;
    if (loadingMode === "parent") publishLoading(loading);
  }, [
    imageLoading,
    videoInitialLoading,
    loadingMode,
    mode,
    publishLoading,
  ]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || mode !== "video") return;
    const shouldPlay = isActive && !userPaused;
    if (shouldPlay) void v.playAsync().catch(() => undefined);
    else void v.pauseAsync().catch(() => undefined);
  }, [isActive, mode, userPaused]);

  const finishInitialLoad = useCallback(() => {
    if (readyOnce.current) return;
    readyOnce.current = true;
    if (mode === "image") setImageLoading(false);
    else setVideoInitialLoading(false);
    onReady?.();
  }, [mode, onReady]);

  const onPlaybackStatus = useCallback(
    (status: AVPlaybackStatus) => {
      if (!status.isLoaded) {
        if (status.error) onError?.();
        return;
      }
      setIsBuffering(!!status.isBuffering);
      if (typeof status.durationMillis === "number" && status.durationMillis > 0) {
        setDurationSeconds(status.durationMillis / 1000);
      }
      if (typeof status.positionMillis === "number") {
        setProgressSeconds(status.positionMillis / 1000);
      }
      if (!readyOnce.current && status.durationMillis != null) {
        finishInitialLoad();
      } else if (!readyOnce.current && !status.isBuffering) {
        finishInitialLoad();
      }
    },
    [finishInitialLoad, onError]
  );

  const togglePlay = useCallback(() => {
    setUserPaused((p) => !p);
  }, []);

  const seekTo = useCallback((seconds: number) => {
    videoRef.current
      ?.setPositionAsync(Math.max(0, seconds * 1000))
      .catch(() => undefined);
    setProgressSeconds(seconds);
  }, []);

  if (!uri?.trim()) {
    onError?.();
    return <View style={[styles.box, { width, height }]} />;
  }

  if (mode === "video") {
    const customControls =
      showCustomControls && !useNativeVideoControls && !videoInitialLoading;

    return (
      <View style={[styles.box, { width, height }]}>
        <Pressable
          style={styles.fill}
          onPress={customControls ? togglePlay : undefined}
          accessibilityRole={customControls ? "button" : undefined}
          accessibilityLabel={customControls ? "Toggle playback" : undefined}
        >
          <Video
            ref={videoRef}
            source={{ uri }}
            style={styles.fill}
            resizeMode={ResizeMode.CONTAIN}
            useNativeControls={useNativeVideoControls}
            shouldPlay={isActive && !userPaused}
            isLooping={false}
            onPlaybackStatusUpdate={onPlaybackStatus}
            onError={() => onError?.()}
          />
        </Pressable>
        {customControls ? (
          <NetQwixVideoControls
            isPlaying={isActive && !userPaused}
            progressSeconds={progressSeconds}
            durationSeconds={durationSeconds}
            isBuffering={isBuffering && !videoInitialLoading}
            onTogglePlay={togglePlay}
            onSeek={seekTo}
          />
        ) : null}
        {showInternalOverlay ? (
          <MediaLoadingOverlay
            message="Loading video"
            variant={loadingOverlayVariant}
          />
        ) : null}
      </View>
    );
  }

  const showImageSkeleton =
    imageLoading && loadingMode === "internal";

  return (
    <View style={[styles.box, { width, height }]}>
      {showImageSkeleton ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Skeleton width={width} height={height} radius={0} />
        </View>
      ) : null}
      <Image
        source={{ uri }}
        style={[styles.fill, { opacity: imageLoading ? 0 : 1 }]}
        contentFit="contain"
        cachePolicy="memory-disk"
        transition={240}
        onLoad={() => finishInitialLoad()}
        onError={() => {
          setImageLoading(false);
          onError?.();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: "#0a0a12",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  fill: {
    width: "100%",
    height: "100%",
  },
});
