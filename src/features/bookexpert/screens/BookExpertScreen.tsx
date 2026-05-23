import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
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
import { TrainerBrowseCard } from "../components/TrainerBrowseCard";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { queryKeys } from "../../../lib/queryKeys";
import { dedupeTrainersById, flatListKeyExtractor } from "../../../lib/lists/trainerListUtils";
import { useAuth } from "../../auth/context/AuthContext";
import { useGuestMode } from "../../auth/hooks/useGuestMode";
import { useRequireAuth } from "../../auth/hooks/useRequireAuth";
import { getTraineeInterests } from "../../dashboard/lib/traineeInterests";

type Props = { bookLessonTrainerId?: string };

export function BookExpertScreen({ bookLessonTrainerId }: Props) {
  const { t } = useAppTranslation();
  const { user } = useAuth();
  const isGuest = useGuestMode();
  const { requireAuth } = useRequireAuth();
  const themeColors = useThemeColors();
  const styles = useMemo(() => makeStyles(themeColors), [themeColors]);

  const traineeInterests = useMemo(() => getTraineeInterests(user), [user]);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [browseFilters, setBrowseFilters] = useState<TrainerBrowseFilters>(() => ({
    ...DEFAULT_BROWSE_FILTERS,
    selectedCategories: traineeInterests.length ? [...traineeInterests] : [],
  }));
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
  const apiCategories = useMemo(() => {
    if (browseFilters.selectedCategories.length > 0) {
      return browseFilters.selectedCategories.join(",");
    }
    if (searchActive) return undefined;
    if (traineeInterests.length > 0) return traineeInterests.join(",");
    return undefined;
  }, [browseFilters.selectedCategories, searchActive, traineeInterests]);
  const activeFilterCount = countActiveFilters(browseFilters);

  const {
    data: directoryRows = [],
    isLoading: directoryLoading,
    isRefetching: directoryRefetching,
    refetch: refetchDirectory,
  } = useQuery({
    queryKey: queryKeys.trainer.directorySearch(
      trimmed,
      JSON.stringify({ ...apiFilterParams, categories: apiCategories })
    ),
    queryFn: () =>
      fetchTrainersWithSlots({
        search: searchActive ? trimmed : undefined,
        ...apiFilterParams,
        categories: apiCategories ?? apiFilterParams.categories,
        limit: 80,
      }),
    staleTime: 60_000,
  });

  const { data: onlineRaw = [] } = useQuery({
    queryKey: queryKeys.presence.bookExpertOnline,
    queryFn: fetchOnlineUsers,
    staleTime: 30_000,
    refetchInterval: isGuest ? false : 30_000,
    enabled: !isGuest,
  });

  const { isOnline } = useOnlinePresence();

  const mergedRows = useMemo(() => {
    const apiOnlineIds = new Set(onlineRaw.map((t: any) => String(t._id)));
    const isTrainerOnline = (id: string) => apiOnlineIds.has(id) || isOnline(id);
    const rows = directoryRows.map((t: any) => ({
      ...t,
      is_online: isTrainerOnline(String(t._id)),
    }));
    const filtered = browseFilters.onlineOnly ? rows.filter((t) => t.is_online) : rows;
    return dedupeTrainersById(filtered);
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
      {!isGuest ? (
        <>
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
        </>
      ) : null}
      <TrainerProfileModal
        visible={!!profileTrainer}
        trainer={profileTrainer}
        onDismiss={() => setProfileTrainer(null)}
        onInstant={(tr) =>
          requireAuth(() => setWizardTrainer(tr), {
            intent: "book",
            messageKey: "guest.signInToBook",
            trainer: tr,
            bookMode: "instant",
          })
        }
        onSchedule={(tr) =>
          requireAuth(() => setScheduleTrainer(tr), {
            intent: "book",
            messageKey: "guest.signInToBook",
            trainer: tr,
            bookMode: "schedule",
          })
        }
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
          keyExtractor={flatListKeyExtractor}
          renderItem={({ item }) => (
            <TrainerBrowseCard
              trainer={item}
              themeColors={themeColors}
              onPress={setProfileTrainer}
              onBook={(tr) =>
                requireAuth(() => setWizardTrainer(tr), {
                  intent: "book",
                  messageKey: "guest.signInToBook",
                  trainer: tr,
                  bookMode: "instant",
                })
              }
              onSchedule={(tr) =>
                requireAuth(() => setScheduleTrainer(tr), {
                  intent: "book",
                  messageKey: "guest.signInToBook",
                  trainer: tr,
                  bookMode: "schedule",
                })
              }
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
