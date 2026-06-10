import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  pickProfileImageKey,
  resolveProfileImageFallback,
  resolveProfileImageUrl,
} from "../../lib/profileImage";
import { useThemeColors } from "../../theme";
import { ImageWithSkeleton } from "./ImageWithSkeleton";

type Props = {
  uri?: string;
  user?: Record<string, unknown> | null;
  name?: string;
  size?: number;
  onlineStatus?: "online" | "offline";
  /** Append to URL as ?t=<value> to bust the expo-image disk cache after an upload. */
  cacheBust?: string | number;
};

/**
 * Circular profile photo with S3/CDN resolution, host fallback, and initials.
 */
export function ProfileAvatar({
  uri,
  user,
  name,
  size = 48,
  onlineStatus,
  cacheBust,
}: Props) {
  const c = useThemeColors();
  const storageKey = useMemo(
    () => uri ?? pickProfileImageKey(user) ?? null,
    [uri, user]
  );
  const primaryUrl = useMemo(() => {
    const base = resolveProfileImageUrl(storageKey ?? undefined);
    if (!base || !cacheBust) return base;
    return `${base}${base.includes("?") ? "&" : "?"}t=${cacheBust}`;
  }, [storageKey, cacheBust]);
  const fallbackUrl = useMemo(
    () => resolveProfileImageFallback(storageKey ?? undefined),
    [storageKey]
  );

  const [activeUrl, setActiveUrl] = useState(primaryUrl);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setActiveUrl(primaryUrl);
    setFailed(false);
  }, [primaryUrl]);

  const handleError = () => {
    if (fallbackUrl && activeUrl !== fallbackUrl) {
      setActiveUrl(fallbackUrl);
      return;
    }
    setFailed(true);
  };

  const inner =
    !activeUrl || failed ? (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: c.brandNavy,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: size * 0.38, color: c.brandTextOn, fontWeight: "700" }}>
          {(name ?? "?")[0]?.toUpperCase()}
        </Text>
      </View>
    )     : (
      <ImageWithSkeleton
        uri={activeUrl}
        width={size}
        height={size}
        borderRadius={size / 2}
        resizeMode="cover"
        cachePolicy="disk"
        onLoadError={handleError}
        accessibilityLabel={name ? `Photo of ${name}` : "Profile photo"}
      />
    );

  if (!onlineStatus) return inner;

  return (
    <View style={{ width: size, height: size }}>
      {inner}
      <View
        style={[
          styles.dot,
          {
            width: Math.max(10, size * 0.22),
            height: Math.max(10, size * 0.22),
            borderRadius: Math.max(5, size * 0.11),
            borderColor: c.surfaceElevated,
            backgroundColor: onlineStatus === "online" ? "#43A047" : "#E57373",
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    borderWidth: 2,
  },
});
