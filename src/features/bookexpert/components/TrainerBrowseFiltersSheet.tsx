import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../../../components/ui";
import { fetchSportCategories } from "../../auth/api/masterApi";
import { type AppColors, radii, space, typography, useThemeColors } from "../../../theme";
import {
  countActiveFilters,
  DEFAULT_BROWSE_FILTERS,
  PRICE_FILTER_OPTIONS,
  RATING_FILTER_OPTIONS,
  type TrainerBrowseFilters,
} from "../lib/trainerBrowseConstants";
import { groupCategoriesAlphabetically } from "../lib/trainerUtils";

const SORT_OPTIONS: { key: TrainerBrowseFilters["sortBy"]; label: string }[] = [
  { key: "name", label: "Name (A–Z)" },
  { key: "rating", label: "Top rated" },
  { key: "next_available", label: "Next available" },
  { key: "hourly_rate", label: "Price: low to high" },
  { key: "hourly_rate_desc", label: "Price: high to low" },
];

type Props = {
  visible: boolean;
  value: TrainerBrowseFilters;
  onApply: (next: TrainerBrowseFilters) => void;
  onDismiss: () => void;
};

export function TrainerBrowseFiltersSheet({ visible, value, onApply, onDismiss }: Props) {
  const themeColors = useThemeColors();
  const styles = useMemo(() => makeStyles(themeColors), [themeColors]);
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<TrainerBrowseFilters>(value);

  const { data: masterCategories = [] } = useQuery({
    queryKey: ["sportCategories"],
    queryFn: fetchSportCategories,
    staleTime: 300_000,
    enabled: visible,
  });

  const categorySections = useMemo(
    () => groupCategoriesAlphabetically(masterCategories),
    [masterCategories]
  );

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const toggleCategory = (cat: string) => {
    setDraft((prev) => {
      const has = prev.selectedCategories.includes(cat);
      return {
        ...prev,
        selectedCategories: has
          ? prev.selectedCategories.filter((c) => c !== cat)
          : [...prev.selectedCategories, cat],
      };
    });
  };

  const activeCount = countActiveFilters(draft);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onDismiss}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={onDismiss} hitSlop={12} accessibilityLabel="Close filters">
            <Ionicons name="close" size={26} color={themeColors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Filters</Text>
          <Pressable
            onPress={() => setDraft(DEFAULT_BROWSE_FILTERS)}
            hitSlop={8}
            accessibilityLabel="Clear all filters"
          >
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>Sort by</Text>
          <View style={styles.chipWrap}>
            {SORT_OPTIONS.map((opt) => {
              const active = draft.sortBy === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setDraft((p) => ({ ...p, sortBy: opt.key }))}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Price per hour</Text>
          <View style={styles.chipWrap}>
            {PRICE_FILTER_OPTIONS.map((opt) => {
              const active = draft.priceKey === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setDraft((p) => ({ ...p, priceKey: opt.key }))}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Rating</Text>
          <View style={styles.chipWrap}>
            {RATING_FILTER_OPTIONS.map((opt) => {
              const active = draft.ratingKey === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setDraft((p) => ({ ...p, ratingKey: opt.key }))}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            style={[styles.onlineRow, draft.onlineOnly && styles.onlineRowActive]}
            onPress={() => setDraft((p) => ({ ...p, onlineOnly: !p.onlineOnly }))}
          >
            <Ionicons
              name={draft.onlineOnly ? "checkmark-circle" : "ellipse-outline"}
              size={22}
              color={draft.onlineOnly ? themeColors.brandNavy : themeColors.textMuted}
            />
            <Text style={styles.onlineLabel}>Online coaches only</Text>
          </Pressable>

          <Pressable
            style={[styles.onlineRow, draft.hasOpenSlots && styles.onlineRowActive]}
            onPress={() => setDraft((p) => ({ ...p, hasOpenSlots: !p.hasOpenSlots }))}
          >
            <Ionicons
              name={draft.hasOpenSlots ? "checkmark-circle" : "ellipse-outline"}
              size={22}
              color={draft.hasOpenSlots ? themeColors.brandNavy : themeColors.textMuted}
            />
            <Text style={styles.onlineLabel}>Has open slots</Text>
          </Pressable>

          <Text style={styles.sectionLabel}>Categories</Text>
          {draft.selectedCategories.length > 0 && (
            <View style={styles.selectedRow}>
              {draft.selectedCategories.map((cat) => (
                <Pressable key={cat} style={styles.selectedChip} onPress={() => toggleCategory(cat)}>
                  <Text style={styles.selectedChipText}>{cat}</Text>
                  <Ionicons name="close" size={14} color={themeColors.brandNavy} />
                </Pressable>
              ))}
            </View>
          )}
          {categorySections.length === 0 ? (
            <Text style={styles.emptyCats}>Categories loading…</Text>
          ) : (
            categorySections.map((section) => (
              <View key={section.title} style={styles.catSection}>
                <Text style={styles.catSectionTitle}>{section.title}</Text>
                <View style={styles.chipWrap}>
                  {section.data.map((cat) => {
                    const active = draft.selectedCategories.includes(cat);
                    return (
                      <Pressable
                        key={cat}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => toggleCategory(cat)}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                          {cat}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Button
            label={activeCount > 0 ? `Show coaches (${activeCount} filter${activeCount > 1 ? "s" : ""})` : "Show coaches"}
            onPress={() => {
              onApply(draft);
              onDismiss();
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: space.md,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerTitle: { ...typography.titleSm, color: colors.text },
    clearText: { ...typography.bodySm, color: colors.brandNavy, fontWeight: "600" },
    scroll: { flex: 1 },
    scrollContent: { padding: space.md, paddingBottom: space.xl },
    sectionLabel: {
      ...typography.label,
      color: colors.textMuted,
      marginTop: space.md,
      marginBottom: space.sm,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
      maxWidth: "100%",
    },
    chipActive: { backgroundColor: colors.brandNavy, borderColor: colors.brandNavy },
    chipText: { ...typography.bodySm, color: colors.text },
    chipTextActive: { color: colors.brandTextOn, fontWeight: "600" },
    onlineRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: space.md,
      padding: space.md,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
    },
    onlineRowActive: { borderColor: colors.brandNavy, backgroundColor: `${colors.brandNavy}08` },
    onlineLabel: { ...typography.bodyMd, color: colors.text, fontWeight: "500" },
    selectedRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: space.sm },
    selectedChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radii.pill,
      backgroundColor: `${colors.brandNavy}12`,
    },
    selectedChipText: { ...typography.caption, color: colors.brandNavy, fontWeight: "600" },
    catSection: { marginBottom: space.sm },
    catSectionTitle: { ...typography.subtitle, color: colors.brandNavy, marginBottom: 8, fontWeight: "700" },
    emptyCats: { ...typography.bodySm, color: colors.textMuted },
    footer: {
      paddingHorizontal: space.md,
      paddingTop: space.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.surfaceElevated,
    },
  });
}
