import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, typography } from "../../theme";
import { ImageWithSkeleton } from "./ImageWithSkeleton";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
export type AvatarProps = {
  /** Already-resolved URI; pass undefined to render initials. */
  uri?: string | null;
  /** Used to compute the initials fallback. */
  name?: string | null;
  size?: AvatarSize;
  style?: StyleProp<ViewStyle>;
};

const SIZE_MAP: Record<AvatarSize, { dim: number; font: number }> = {
  xs: { dim: 24, font: 11 },
  sm: { dim: 32, font: 13 },
  md: { dim: 40, font: 15 },
  lg: { dim: 56, font: 20 },
  xl: { dim: 80, font: 28 },
};

export function Avatar({ uri, name, size = "md", style }: AvatarProps) {
  const { dim, font } = SIZE_MAP[size];
  const initials = pickInitials(name);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [uri]);

  if (uri && !imageFailed) {
    return (
      <ImageWithSkeleton
        uri={uri}
        width={dim}
        height={dim}
        borderRadius={dim / 2}
        resizeMode="cover"
        style={style}
        onLoadError={() => setImageFailed(true)}
        accessibilityLabel={name ? `Profile photo, ${name}` : "Profile photo"}
      />
    );
  }

  return (
    <View
      style={[
        { width: dim, height: dim, borderRadius: dim / 2 },
        styles.fallback,
        style,
      ]}
    >
      <Text
        style={[
          typography.label,
          { fontSize: font, color: colors.brandTextOn, fontWeight: "700" },
        ]}
      >
        {initials}
      </Text>
    </View>
  );
}

function pickInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.brandNavy,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
