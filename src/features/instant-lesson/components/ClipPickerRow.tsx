import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ImageWithSkeleton } from "../../../components/ui";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, typography } from "../../../theme";
import { getClipThumbnailUrl } from "../../../lib/clipMediaUrl";
import type { ClipRow } from "../instantLessonClipsApi";

type Props = {
  clip: ClipRow & {
    file_name?: string;
    thumbnail?: string;
    category?: string;
  };
  selected: boolean;
  onToggle: (id: string) => void;
};

/**
 * Booking-wizard / waiting-modal clip row that mirrors the web bookings clip tile:
 * shows the locker thumbnail + title + category, with a checkbox indicator.
 */
export function ClipPickerRow({ clip, selected, onToggle }: Props) {
  const thumb = getClipThumbnailUrl(clip);
  const label = clip.title || clip.name || "Untitled clip";

  return (
    <Pressable
      style={[styles.row, selected && styles.rowOn]}
      onPress={() => onToggle(clip._id)}
    >
      <View style={styles.thumbBox}>
        {thumb ? (
          <ImageWithSkeleton
            uri={thumb}
            width={THUMB}
            height={THUMB}
            borderRadius={radii.sm}
            resizeMode="cover"
            accessibilityLabel={label}
          />
        ) : (
          <View style={[styles.thumbImg, styles.thumbFallback]}>
            <Ionicons name="film-outline" size={22} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.playBadge}>
          <Ionicons name="play" size={11} color={colors.brandTextOn} />
        </View>
      </View>

      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={2}>
          {label}
        </Text>
        {!!clip.category && (
          <Text style={styles.category} numberOfLines={1}>
            {clip.category}
          </Text>
        )}
      </View>

      <Ionicons
        name={selected ? "checkbox" : "square-outline"}
        size={22}
        color={selected ? colors.brandNavy : colors.textMuted}
      />
    </Pressable>
  );
}

const THUMB = 56;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
    backgroundColor: colors.surfaceElevated,
  },
  rowOn: { borderColor: colors.brandNavy, backgroundColor: colors.brandSubtle },
  thumbBox: {
    width: THUMB,
    height: THUMB,
    borderRadius: radii.sm,
    overflow: "hidden",
    position: "relative",
    backgroundColor: colors.border,
  },
  thumbImg: { width: "100%", height: "100%" },
  thumbFallback: { alignItems: "center", justifyContent: "center" },
  playBadge: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  meta: { flex: 1, gap: 2 },
  title: { ...typography.bodyMd, fontWeight: "600", color: colors.text },
  category: { ...typography.caption, color: colors.textMuted },
});
