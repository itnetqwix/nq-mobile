import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { VoiceInputState } from "../../ai/useVoiceInput";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { radii, space, typography, useThemeColors } from "../../../theme";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onOpenFilters?: () => void;
  activeFilterCount?: number;
  placeholder?: string;
  embedded?: boolean;
  voiceState?: VoiceInputState;
  onVoicePress?: () => void;
};

/**
 * Blinkit-style search — text + voice + filters.
 */
export function HomeStickySearchBar({
  value,
  onChangeText,
  onOpenFilters,
  activeFilterCount = 0,
  placeholder,
  embedded = false,
  voiceState = "idle",
  onVoicePress,
}: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();

  const voiceIcon =
    voiceState === "recording" ? "stop-circle" : voiceState === "processing" ? "hourglass" : "mic";
  const voiceColor =
    voiceState === "recording" ? c.danger : voiceState === "processing" ? c.textMuted : c.brandAccent;

  return (
    <View style={[styles.wrap, embedded && styles.wrapEmbedded]}>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: c.surfaceElevated,
            borderColor: c.border,
          },
        ]}
      >
        <Ionicons name="search-outline" size={16} color={c.textMuted} />
        <TextInput
          style={[styles.input, { color: c.text }]}
          placeholder={
            placeholder ?? t("homeMarketplace.searchPlaceholder", {
              defaultValue: "Search coaches, sports…",
            })
          }
          placeholderTextColor={c.textMuted}
          value={value}
          onChangeText={onChangeText}
          returnKeyType="search"
          autoCorrect={false}
        />
        {onVoicePress ? (
          <Pressable
            onPress={onVoicePress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("homeMarketplace.voice.start", {
              defaultValue: "Search by voice",
            })}
            style={[
              styles.voiceBtn,
              voiceState === "recording" && { backgroundColor: c.dangerSubtle },
            ]}
          >
            {voiceState === "processing" ? (
              <ActivityIndicator size="small" color={voiceColor} />
            ) : (
              <Ionicons name={voiceIcon} size={16} color={voiceColor} />
            )}
          </Pressable>
        ) : null}
        {!!value && (
          <Pressable onPress={() => onChangeText("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={c.textMuted} />
          </Pressable>
        )}
        {onOpenFilters ? (
          <Pressable
            style={[
              styles.filterBtn,
              { borderColor: c.border },
              activeFilterCount > 0 && {
                backgroundColor: c.brandNavy,
                borderColor: c.brandNavy,
              },
            ]}
            onPress={onOpenFilters}
            accessibilityLabel={t("traineeDiscover.openFiltersA11y")}
          >
            <Ionicons
              name="options-outline"
              size={16}
              color={activeFilterCount > 0 ? c.brandTextOn : c.brandNavy}
            />
            {activeFilterCount > 0 ? (
              <View style={[styles.badge, { backgroundColor: c.error }]}>
                <Text style={styles.badgeText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  wrapEmbedded: {
    paddingTop: space.xs,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    borderRadius: radii.lg,
    paddingHorizontal: space.sm,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  input: {
    flex: 1,
    fontSize: typography.bodySm.fontSize,
    paddingVertical: 2,
    minHeight: 24,
  },
  voiceBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 10, fontWeight: "700", color: "#fff" },
});
