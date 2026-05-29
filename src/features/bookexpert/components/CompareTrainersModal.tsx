import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
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
  type CompareTrainerRow,
  useCompareTrainers,
} from "../lib/compareTrainersStore";

type Props = {
  visible: boolean;
  onDismiss: () => void;
  onSchedule: (trainer: Record<string, unknown>) => void;
  onInstant: (trainer: Record<string, unknown>) => void;
};

/**
 * Side-by-side trainer comparison.
 *
 * Layout strategy: each pinned trainer becomes a vertical card. Cards
 * scroll horizontally so the user can see all of them on a phone width
 * without crushing the columns. Inside each card, attributes (rate,
 * rating, completed sessions, languages, categories) get the same row
 * label so eyes can sweep top-to-bottom and compare directly.
 */
export function CompareTrainersModal({
  visible,
  onDismiss,
  onSchedule,
  onInstant,
}: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const rows = useCompareTrainers();

  return (
    <Modal
      visible={visible && rows.length > 0}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onDismiss}
    >
      <View
        style={[styles.shell, { backgroundColor: c.surface, paddingTop: insets.top + 4 }]}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={[typography.titleLg, { color: c.text }]}>
              {t("bookExpert.compareModalTitle")}
            </Text>
            <Text style={[styles.subtitle, { color: c.textMuted }]}>
              {t("bookExpert.compareModalSubtitle", { count: rows.length })}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              haptics.tap();
              onDismiss();
            }}
            hitSlop={10}
            accessibilityLabel={t("common.close")}
          >
            <Ionicons name="close" size={24} color={c.text} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {rows.map((row, index) => (
            <CompareColumn
              key={`compare-${String(row._id ?? "row")}-${index}`}
              row={row}
              onSchedule={() => {
                haptics.tap();
                onSchedule(row.raw);
                onDismiss();
              }}
              onInstant={() => {
                haptics.tap();
                onInstant(row.raw);
                onDismiss();
              }}
            />
          ))}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            onPress={() => {
              haptics.tap();
              compareTrainersStore.clear();
              onDismiss();
            }}
            style={[styles.clearAllBtn, { backgroundColor: c.surfaceMuted }]}
            accessibilityRole="button"
          >
            <Ionicons name="trash-outline" size={16} color={c.textMuted} />
            <Text style={[styles.clearAllText, { color: c.textMuted }]}>
              {t("bookExpert.compareClearAll")}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function CompareColumn({
  row,
  onSchedule,
  onInstant,
}: {
  row: CompareTrainerRow;
  onSchedule: () => void;
  onInstant: () => void;
}) {
  const { t } = useAppTranslation();
  const c = useThemeColors();

  return (
    <View
      style={[
        styles.col,
        { backgroundColor: c.surfaceElevated, borderColor: c.borderSubtle },
      ]}
    >
      <View style={styles.colHeader}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: c.brandAccentSubtle, borderColor: c.brandAccent },
          ]}
        >
          {row.profile_picture ? (
            <Image source={{ uri: row.profile_picture }} style={styles.avatarImg} contentFit="cover" />
          ) : (
            <Text style={[styles.avatarLetter, { color: c.brandAccent }]}>
              {row.name.slice(0, 1).toUpperCase()}
            </Text>
          )}
        </View>
        <Text style={[typography.titleSm, { color: c.text }]} numberOfLines={2}>
          {row.name}
        </Text>
        {row.is_online ? (
          <View style={[styles.onlinePill, { backgroundColor: `${c.success}22` }]}>
            <View style={[styles.onlineDot, { backgroundColor: c.success }]} />
            <Text style={[styles.onlinePillText, { color: c.success }]}>
              {t("traineeDiscover.liveNow")}
            </Text>
          </View>
        ) : null}
      </View>

      <Stat
        label={t("bookExpert.compareRate")}
        value={
          row.hourly_rate != null
            ? `$${row.hourly_rate.toFixed(0)}/hr`
            : t("bookExpert.compareNotListed")
        }
      />
      <Stat
        label={t("bookExpert.compareRating")}
        value={
          row.avgRating != null
            ? `★ ${row.avgRating.toFixed(1)} (${row.reviewCount ?? 0})`
            : t("bookExpert.compareNoReviews")
        }
      />
      <Stat
        label={t("bookExpert.compareSessions")}
        value={
          row.completedSessions
            ? t("traineeDiscover.sessionsCompleted", { count: row.completedSessions })
            : t("bookExpert.compareNewCoach")
        }
      />
      <Stat
        label={t("bookExpert.compareLanguages")}
        value={
          row.languages && row.languages.length > 0
            ? row.languages.join(", ")
            : t("bookExpert.compareNotListed")
        }
      />
      <Stat
        label={t("bookExpert.compareCategories")}
        value={
          row.categories && row.categories.length > 0
            ? row.categories.slice(0, 3).join(", ")
            : t("bookExpert.compareNotListed")
        }
      />

      <View style={styles.actions}>
        <Pressable
          onPress={onInstant}
          disabled={!row.is_online}
          style={({ pressed }) => [
            styles.btnPrimary,
            { backgroundColor: row.is_online ? c.brandNavy : c.surfaceMuted },
            pressed && row.is_online && { opacity: 0.88 },
          ]}
        >
          <Ionicons
            name="flash"
            size={14}
            color={row.is_online ? c.brandTextOn : c.textMuted}
          />
          <Text
            style={[
              styles.btnPrimaryText,
              { color: row.is_online ? c.brandTextOn : c.textMuted },
            ]}
          >
            {t("bookExpert.instant")}
          </Text>
        </Pressable>
        <Pressable
          onPress={onSchedule}
          style={({ pressed }) => [
            styles.btnGhost,
            { borderColor: c.brandNavy },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="calendar-outline" size={14} color={c.brandNavy} />
          <Text style={[styles.btnGhostText, { color: c.brandNavy }]}>
            {t("traineeDiscover.bookSession")}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            haptics.tap();
            compareTrainersStore.remove(row._id);
          }}
          hitSlop={6}
          style={styles.removeBtn}
          accessibilityRole="button"
        >
          <Ionicons name="close-circle-outline" size={16} color={c.textMuted} />
          <Text style={[styles.removeText, { color: c.textMuted }]}>
            {t("bookExpert.compareRemove")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const c = useThemeColors();
  return (
    <View style={styles.statRow}>
      <Text style={[styles.statLabel, { color: c.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.statValue, { color: c.text }]} numberOfLines={3}>
        {value}
      </Text>
    </View>
  );
}

const COL_WIDTH = 240;

const styles = StyleSheet.create({
  shell: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  headerText: { flex: 1, paddingRight: 8 },
  subtitle: { ...typography.bodySm, marginTop: 4 },
  scrollContent: {
    paddingHorizontal: space.md,
    paddingBottom: space.lg,
    gap: 12,
  },
  col: {
    width: COL_WIDTH,
    borderRadius: 16,
    borderWidth: 1,
    padding: space.md,
    gap: 12,
  },
  colHeader: { alignItems: "center", gap: 8 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarLetter: { fontSize: 26, fontWeight: "800" },
  onlinePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  onlineDot: { width: 6, height: 6, borderRadius: 3 },
  onlinePillText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.4 },
  statRow: { gap: 2 },
  statLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  statValue: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  actions: { gap: 6, marginTop: 4 },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: radii.pill,
  },
  btnPrimaryText: { fontSize: 13, fontWeight: "800" },
  btnGhost: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  btnGhostText: { fontSize: 13, fontWeight: "700" },
  removeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingTop: 4,
  },
  removeText: { fontSize: 11, fontWeight: "600", textDecorationLine: "underline" },
  footer: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    alignItems: "center",
  },
  clearAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  clearAllText: { fontSize: 13, fontWeight: "700" },
});
