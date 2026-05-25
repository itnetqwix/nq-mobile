import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { haptics } from "../../../lib/haptics";
import { radii, space, typography, useThemeColors } from "../../../theme";
import {
  compareTrainersStore,
  MAX_COMPARE_TRAINERS,
  useCompareTrainers,
} from "../lib/compareTrainersStore";

type Props = {
  onOpenCompare: () => void;
};

/**
 * Floating "compare basket" pinned to the bottom of the trainer directory.
 * Stays out of the way (gracefully hides when nothing is pinned) and gives
 * a one-tap entry to the side-by-side comparison modal. Caller controls
 * the modal so the tray can sit in any screen that lists trainers.
 */
export function CompareTrainersTray({ onOpenCompare }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const rows = useCompareTrainers();

  if (rows.length === 0) return null;

  const slots = Array.from({ length: MAX_COMPARE_TRAINERS }, (_, i) => rows[i]);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.root, { bottom: insets.bottom + 80 }]}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: c.surfaceElevated,
            borderColor: c.borderSubtle,
            shadowColor: c.brandNavy,
          },
        ]}
      >
        <View style={styles.avatarsRow}>
          {slots.map((row, i) => (
            <View
              key={row?._id ?? `slot-${i}`}
              style={[
                styles.avatarSlot,
                {
                  backgroundColor: c.brandAccentSubtle,
                  borderColor: row ? c.brandAccent : c.borderSubtle,
                  borderStyle: row ? "solid" : "dashed",
                },
              ]}
            >
              {row?.profile_picture ? (
                <Image
                  source={{ uri: row.profile_picture }}
                  style={styles.avatarImg}
                  contentFit="cover"
                />
              ) : row ? (
                <Text style={[styles.avatarLetter, { color: c.brandAccent }]}>
                  {row.name.slice(0, 1).toUpperCase()}
                </Text>
              ) : (
                <Ionicons name="add" size={16} color={c.textMuted} />
              )}
              {row ? (
                <Pressable
                  hitSlop={6}
                  onPress={() => {
                    haptics.tap();
                    compareTrainersStore.remove(row._id);
                  }}
                  style={[styles.avatarRemove, { backgroundColor: c.error }]}
                  accessibilityLabel={t("bookExpert.compareRemoveA11y", {
                    name: row.name,
                  })}
                >
                  <Ionicons name="close" size={10} color="#fff" />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>

        <View style={styles.meta}>
          <Text style={[typography.titleSm, { color: c.text }]}>
            {t("bookExpert.compareTrayTitle", { count: rows.length })}
          </Text>
          <Pressable
            onPress={() => {
              haptics.tap();
              compareTrainersStore.clear();
            }}
            hitSlop={6}
            accessibilityRole="button"
          >
            <Text style={[styles.clearText, { color: c.textMuted }]}>
              {t("bookExpert.compareClear")}
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => {
            haptics.tap();
            onOpenCompare();
          }}
          disabled={rows.length < 2}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: rows.length < 2 ? c.surfaceMuted : c.brandNavy,
              opacity: pressed && rows.length >= 2 ? 0.85 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: rows.length < 2 }}
        >
          <Ionicons
            name="git-compare-outline"
            size={16}
            color={rows.length < 2 ? c.textMuted : c.brandTextOn}
          />
          <Text
            style={[
              styles.ctaText,
              { color: rows.length < 2 ? c.textMuted : c.brandTextOn },
            ]}
          >
            {rows.length < 2
              ? t("bookExpert.compareNeedMore")
              : t("bookExpert.compareOpen")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    left: 12,
    right: 12,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 6,
  },
  avatarsRow: { flexDirection: "row", gap: -8 },
  avatarSlot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    overflow: "visible",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
  },
  avatarImg: { width: 32, height: 32, borderRadius: 16 },
  avatarLetter: { fontSize: 14, fontWeight: "800" },
  avatarRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  meta: { flex: 1, gap: 2, marginLeft: space.xs },
  clearText: { fontSize: 11, fontWeight: "600", textDecorationLine: "underline" },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.pill,
  },
  ctaText: { fontSize: 13, fontWeight: "800" },
});
