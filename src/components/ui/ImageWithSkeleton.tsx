import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import React, { useCallback, useState } from "react";
import {
  StyleSheet,
  View,
  type ImageResizeMode,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useThemeColors, useThemedStyles } from "../../theme";
import { Skeleton } from "./Skeleton";

const RESIZE_MAP: Record<string, string> = {
  cover: "cover",
  contain: "contain",
  stretch: "fill",
  center: "center",
};

export type ImageWithSkeletonProps = {
  /** Remote URI (or use `source` for local assets). */
  uri?: string | null;
  /** When set, overrides `uri` (e.g. `require('./x.png')`). */
  source?: ImageSourcePropType;
  width: number;
  height: number;
  borderRadius?: number;
  resizeMode?: ImageResizeMode;
  /** Merged onto the outer container (position, margins, etc.). */
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** Fired when the remote image fails so parents can swap UI (e.g. Avatar → initials). */
  onLoadError?: () => void;
  /** Override expo-image cache policy. Pass "reload" to force a fresh fetch (e.g. after upload). */
  cachePolicy?: "disk" | "memory" | "memory-disk" | "none" | "reload";
};

/**
 * Network image with built-in disk/memory caching via expo-image, a shimmer
 * skeleton while loading, and a compact placeholder on failure.
 */
export function ImageWithSkeleton({
  uri,
  source,
  width,
  height,
  borderRadius = 0,
  resizeMode = "cover",
  style,
  accessibilityLabel,
  onLoadError,
  cachePolicy = "disk",
}: ImageWithSkeletonProps) {
  const c = useThemeColors();
  const styles = useThemedStyles((palette) =>
    StyleSheet.create({
      box: {
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: palette.surfaceMuted,
      },
      img: {
        ...StyleSheet.absoluteFillObject,
      },
    })
  );

  const resolved = source ?? (uri ? { uri } : null);
  const isRemoteUri =
    typeof resolved === "object" &&
    resolved !== null &&
    !Array.isArray(resolved) &&
    "uri" in resolved &&
    typeof (resolved as { uri: string }).uri === "string";

  const [loaded, setLoaded] = useState(!isRemoteUri);
  const [error, setError] = useState(false);

  const handleLoad = useCallback(() => {
    setLoaded(true);
  }, []);

  const handleError = useCallback(() => {
    setError(true);
    onLoadError?.();
  }, [onLoadError]);

  if (!resolved || error) {
    const iconSize = Math.round(Math.min(width, height) * 0.38);
    return (
      <View
        style={[styles.box, { width, height, borderRadius }, style]}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="image"
      >
        <Ionicons name="image-outline" size={Math.max(14, iconSize)} color={c.textMuted} />
      </View>
    );
  }

  return (
    <View
      style={[styles.box, { width, height, borderRadius, overflow: "hidden" }, style]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
    >
      {!loaded && (
        <View style={[StyleSheet.absoluteFillObject, { borderRadius }]} pointerEvents="none">
          <Skeleton width={width} height={height} radius={borderRadius} />
        </View>
      )}
      <ExpoImage
        source={resolved}
        style={[styles.img, { opacity: loaded ? 1 : 0 }]}
        contentFit={(RESIZE_MAP[resizeMode] as any) ?? "cover"}
        cachePolicy={cachePolicy}
        transition={280}
        recyclingKey={isRemoteUri ? (resolved as { uri: string }).uri : undefined}
        onLoad={handleLoad}
        onError={handleError}
      />
    </View>
  );
}
