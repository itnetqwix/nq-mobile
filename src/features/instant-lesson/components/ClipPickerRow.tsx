import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii } from "../../../theme/tokens";
import { getS3ImageUrl } from "../../../lib/imageUtils";
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
  const [imgFailed, setImgFailed] = useState(false);
  const thumb = getS3ImageUrl(clip.thumbnail) || "";
  const label = clip.title || clip.name || "Untitled clip";

  return (
    <Pressable
      style={[styles.row, selected && styles.rowOn]}
      onPress={() => onToggle(clip._id)}
    >
      <View style={styles.thumbBox}>
        {thumb && !imgFailed ? (
          <Image
            source={{ uri: thumb }}
            style={styles.thumbImg}
            resizeMode="cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <View style={[styles.thumbImg, styles.thumbFallback]}>
            <Ionicons name="film-outline" size={22} color="#9ca3af" />
          </View>
        )}
        <View style={styles.playBadge}>
          <Ionicons name="play" size={11} color="#fff" />
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
        color={selected ? colors.brandNavy : "#9ca3af"}
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
    backgroundColor: "#fff",
  },
  rowOn: { borderColor: colors.brandNavy, backgroundColor: "#f0f4ff" },
  thumbBox: {
    width: THUMB,
    height: THUMB,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#e5e7eb",
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
  title: { fontSize: 14, fontWeight: "600", color: colors.text },
  category: { fontSize: 12, color: colors.textMuted },
});
