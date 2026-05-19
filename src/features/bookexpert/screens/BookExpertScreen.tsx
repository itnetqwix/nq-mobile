import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState, Skeleton } from "../../../components/ui";
import { type AppColors, radii, space, typography, useThemeColors } from "../../../theme";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { fetchOnlineUsers, fetchTrainersWithSlots } from "../../home/api/homeApi";
import { useOnlinePresence } from "../../socket/useOnlinePresence";
import { InstantLessonBookingWizardModal } from "../../instant-lesson/booking-wizard";
import { ScheduledBookingWizardModal } from "../../scheduled-booking/ScheduledBookingWizardModal";
import type { MenuStackParamList } from "../../../navigation/types";
import { TrainerBrowseFiltersSheet } from "../components/TrainerBrowseFiltersSheet";
import { TrainerProfileModal } from "../components/TrainerProfileModal";
import {
  countActiveFilters,
  DEFAULT_BROWSE_FILTERS,
  filtersToApiParams,
  type TrainerBrowseFilters,
} from "../lib/trainerBrowseConstants";
import {
  getTrainerAvgRating,
  getTrainerCategories,
  getTrainerHourlyRate,
  getTrainerName,
} from "../lib/trainerUtils";
import { useAppTranslation } from "../../../i18n/useAppTranslation";

function Avatar({
  uri,
  name,
  size = 64,
  styles: st,
}: {
  uri?: string;
  name?: string;
  size?: number;
  styles: ReturnType<typeof makeStyles>;
}) {
  const [failed, setFailed] = React.useState(false);
  const url = getS3ImageUrl(uri);
  if (!url || failed) {
    return (
      <View style={[st.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[st.avatarInitial, { fontSize: size * 0.38 }]}>
          {(name ?? "?")[0]?.toUpperCase()}
        </Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: url }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      onError={() => setFailed(true)}
    />
  );
}

function TrainerCard({
  trainer,
  onPress,
  onBook,
  onSchedule,
  styles,
  themeColors,
}: {
  trainer: Record<string, unknown>;
  onPress: (t: Record<string, unknown>) => void;
  onBook: (t: Record<string, unknown>) => void;
  onSchedule: (t: Record<string, unknown>) => void;
  styles: ReturnType<typeof makeStyles>;
  themeColors: AppColors;
}) {
  const { t } = useAppTranslation();
  const { isOnline } = useOnlinePresence();
  const trainerId = String(trainer?._id ?? "");
  const name = getTrainerName(trainer);
  const showOnline = isOnline(trainerId) || !!(trainer as any)?.is_online;
  const cats = getTrainerCategories(trainer).slice(0, 3).join(" • ");
  const rating = getTrainerAvgRating(trainer);
  const hourly = getTrainerHourlyRate(trainer);
  const slotsCount = Array.isArray(trainer?.slots) ? (trainer.slots as unknown[]).length : null;

  return (
    <View style={styles.card}>
      <Pressable
        style={({ pressed }) => [pressed && { opacity: 0.92 }]}
        onPress={() => onPress(trainer)}
        accessibilityRole="button"
        accessibilityLabel={t("bookExpert.viewProfileA11y", { name })}
      >
        <View style={styles.cardRow}>
          <Avatar uri={trainer?.profile_picture as string} name={name} size={64} styles={styles} />
          <View style={styles.cardInfo}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.trainerName} numberOfLines={1}>
                {name}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={themeColors.textMuted} />
            </View>
            {!!cats && (
              <Text style={styles.trainerCat} numberOfLines={2}>
                {cats}
              </Text>
            )}
            {rating != null && (
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={13} color={themeColors.warning} />
                <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
              </View>
            )}
            {hourly != null && <Text style={styles.rateText}>${hourly.toFixed(0)}/hr</Text>}
            {slotsCount !== null && (
              <Text style={styles.slotsText}>
                {t("bookExpert.slotsAvailable", { count: slotsCount })}
              </Text>
            )}
          </View>
        </View>
      </Pressable>
      <View style={styles.cardFooter}>
        <View style={styles.btnRow}>
          <Pressable style={styles.actionBtn} onPress={() => onBook(trainer)}>
            <Ionicons name="flash" size={16} color={themeColors.brandTextOn} />
            <Text style={styles.actionBtnText}>{t("bookExpert.instant")}</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.actionBtnOutline]} onPress={() => onSchedule(trainer)}>
            <Ionicons name="calendar-outline" size={16} color={themeColors.brandNavy} />
            <Text style={[styles.actionBtnText, styles.actionBtnTextOutline]}>
              {t("bookExpert.schedule")}
            </Text>
          </Pressable>
        </View>
        {showOnline && (
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>{t("bookExpert.online")}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

type Props = { bookLessonTrainerId?: string };

export function BookExpertScreen({ bookLessonTrainerId }: Props) {
  const { t } = useAppTranslation();
  const themeColors = useThemeColors();
  const styles = useMemo(() => makeStyles(themeColors), [themeColors]);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [browseFilters, setBrowseFilters] = useState<TrainerBrowseFilters>(DEFAULT_BROWSE_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [profileTrainer, setProfileTrainer] = useState<Record<string, unknown> | null>(null);
  const [wizardTrainer, setWizardTrainer] = useState<Record<string, unknown> | null>(null);
  const [scheduleTrainer, setScheduleTrainer] = useState<Record<string, unknown> | null>(null);
  const navigation = useNavigation<NativeStackNavigationProp<MenuStackParamList>>();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const trimmed = debouncedSearch;
  const searchActive = trimmed.length >= 2 && !/^\d+$/.test(trimmed);
  const apiFilterParams = useMemo(() => filtersToApiParams(browseFilters), [browseFilters]);
  const activeFilterCount = countActiveFilters(browseFilters);

  const {
    data: directoryRows = [],
    isLoading: directoryLoading,
    isRefetching: directoryRefetching,
    refetch: refetchDirectory,
  } = useQuery({
    queryKey: ["trainersDirectory", trimmed, apiFilterParams],
    queryFn: () =>
      fetchTrainersWithSlots({
        search: searchActive ? trimmed : undefined,
        ...apiFilterParams,
        limit: 80,
      }),
    staleTime: 60_000,
  });

  const { data: onlineRaw = [] } = useQuery({
    queryKey: ["bookExpert", "online"],
    queryFn: fetchOnlineUsers,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const { isOnline } = useOnlinePresence();

  const mergedRows = useMemo(() => {
    const apiOnlineIds = new Set(onlineRaw.map((t: any) => String(t._id)));
    const isTrainerOnline = (id: string) => apiOnlineIds.has(id) || isOnline(id);
    const rows = directoryRows.map((t: any) => ({
      ...t,
      is_online: isTrainerOnline(String(t._id)),
    }));
    if (browseFilters.onlineOnly) return rows.filter((t) => t.is_online);
    return rows;
  }, [directoryRows, onlineRaw, isOnline, browseFilters.onlineOnly]);

  useEffect(() => {
    if (!bookLessonTrainerId || mergedRows.length === 0) return;
    const match = mergedRows.find((t) => String(t._id) === String(bookLessonTrainerId));
    if (match) {
      setProfileTrainer(match);
      navigation.setParams({ featureId: "book-lesson", bookLessonTrainerId: undefined });
    }
  }, [bookLessonTrainerId, mergedRows, navigation]);

  return (
    <View style={styles.root}>
      <InstantLessonBookingWizardModal
        visible={!!wizardTrainer}
        trainer={wizardTrainer}
        onDismiss={() => setWizardTrainer(null)}
      />
      <ScheduledBookingWizardModal
        visible={!!scheduleTrainer}
        trainer={scheduleTrainer}
        onDismiss={() => setScheduleTrainer(null)}
      />
      <TrainerProfileModal
        visible={!!profileTrainer}
        trainer={profileTrainer}
        onDismiss={() => setProfileTrainer(null)}
        onInstant={(t) => setWizardTrainer(t)}
        onSchedule={(t) => setScheduleTrainer(t)}
      />
      <TrainerBrowseFiltersSheet
        visible={filtersOpen}
        value={browseFilters}
        onApply={setBrowseFilters}
        onDismiss={() => setFiltersOpen(false)}
      />

      <View style={styles.hero}>
        <Text style={styles.heroTitle}>{t("bookExpert.heroTitle")}</Text>
        <Text style={styles.heroSub}>{t("bookExpert.heroSub")}</Text>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={themeColors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder={t("bookExpert.searchPlaceholder")}
          placeholderTextColor={themeColors.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          autoCorrect={false}
        />
        {!!search && (
          <Pressable onPress={() => setSearch("")} accessibilityLabel={t("bookExpert.clearSearchA11y")}>
            <Ionicons name="close-circle" size={18} color={themeColors.textMuted} />
          </Pressable>
        )}
        <Pressable
          style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
          onPress={() => setFiltersOpen(true)}
          accessibilityLabel={t("bookExpert.openFiltersA11y")}
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={activeFilterCount > 0 ? themeColors.brandTextOn : themeColors.brandNavy}
          />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {activeFilterCount > 0 && (
        <Pressable style={styles.activeFiltersHint} onPress={() => setFiltersOpen(true)}>
          <Text style={styles.activeFiltersText}>
            {t("bookExpert.filtersApplied", { count: activeFilterCount })}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={themeColors.brandNavy} />
        </Pressable>
      )}

      {search.trim().length > 0 && search.trim().length < 2 && (
        <Text style={styles.searchHint}>{t("bookExpert.searchMinHint")}</Text>
      )}

      {directoryLoading ? (
        <View style={styles.list}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ marginBottom: space.md }}>
              <Skeleton width="100%" height={140} radius={radii.md} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={mergedRows}
          keyExtractor={(item, i) => item?._id ?? String(i)}
          renderItem={({ item }) => (
            <TrainerCard
              trainer={item}
              styles={styles}
              themeColors={themeColors}
              onPress={setProfileTrainer}
              onBook={setWizardTrainer}
              onSchedule={setScheduleTrainer}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={directoryRefetching}
              onRefresh={() => void refetchDirectory()}
              tintColor={themeColors.brandNavy}
            />
          }
          ListHeaderComponent={
            <View style={styles.listBanner}>
              <Ionicons name="people-outline" size={16} color={themeColors.brandNavy} />
              <Text style={styles.listBannerText}>
                {searchActive
                  ? t("bookExpert.resultsFor", { query: trimmed })
                  : t("bookExpert.coachCount", { count: mergedRows.length })}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title={t("bookExpert.emptyTitle")}
              description={t("bookExpert.emptyDescription")}
            />
          }
        />
      )}
    </View>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    hero: {
      paddingHorizontal: space.md,
      paddingTop: space.md,
      paddingBottom: space.sm,
      backgroundColor: colors.surfaceElevated,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    heroTitle: { ...typography.titleMd, color: colors.headerTitle },
    heroSub: { ...typography.bodySm, color: colors.textMuted, marginTop: 6, lineHeight: 20 },
    searchHint: {
      ...typography.caption,
      color: colors.text,
      paddingHorizontal: space.md,
      paddingVertical: 6,
      backgroundColor: colors.warningSubtle,
    },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: space.md,
      paddingVertical: 10,
      gap: space.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    searchInput: {
      flex: 1,
      fontSize: typography.bodyMd.fontSize,
      color: colors.text,
      paddingVertical: 0,
    },
    filterBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    filterBtnActive: { backgroundColor: colors.brandNavy, borderColor: colors.brandNavy },
    filterBadge: {
      position: "absolute",
      top: -4,
      right: -4,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.error,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
    },
    filterBadgeText: { fontSize: 10, fontWeight: "700", color: "#fff" },
    activeFiltersHint: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: space.md,
      paddingVertical: 8,
      backgroundColor: `${colors.brandNavy}08`,
    },
    activeFiltersText: { ...typography.bodySm, color: colors.brandNavy, fontWeight: "600" },
    list: { padding: space.md, gap: space.sm, paddingBottom: space.xl },
    listBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: space.sm,
      paddingVertical: 8,
    },
    listBannerText: { ...typography.bodySm, fontWeight: "600", color: colors.textSecondary, flex: 1 },
    card: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radii.md,
      padding: space.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardRow: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
    cardInfo: { flex: 1, minWidth: 0 },
    cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    trainerName: { ...typography.titleSm, color: colors.text, flex: 1 },
    trainerCat: { ...typography.bodySm, color: colors.textMuted, marginTop: 3 },
    ratingRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4 },
    ratingText: { ...typography.bodySm, fontWeight: "600", color: colors.textSecondary },
    rateText: { ...typography.caption, color: colors.brandNavy, marginTop: 2, fontWeight: "600" },
    slotsText: { ...typography.caption, color: colors.success, marginTop: 3, fontWeight: "500" },
    cardFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: space.md,
      paddingTop: space.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderSubtle,
    },
    btnRow: { flexDirection: "row", gap: 8 },
    actionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radii.pill,
      backgroundColor: colors.brandNavy,
    },
    actionBtnOutline: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.brandNavy,
    },
    actionBtnText: { fontSize: 13, fontWeight: "600", color: colors.brandTextOn },
    actionBtnTextOutline: { color: colors.brandNavy },
    onlineBadge: { flexDirection: "row", alignItems: "center", gap: 5 },
    onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
    onlineText: { ...typography.caption, color: colors.success, fontWeight: "600" },
    avatarFallback: { backgroundColor: colors.brandNavy, alignItems: "center", justifyContent: "center" },
    avatarInitial: { color: colors.brandTextOn, fontWeight: "700" },
  });
}
