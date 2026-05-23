import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Skeleton } from "../../../../components/ui";
import { AccountType } from "../../../../constants/accountType";
import { fetchSportCategories } from "../../../auth/api/masterApi";
import { TrainerBrowseCard } from "../../../bookexpert/components/TrainerBrowseCard";
import { fetchOnlineUsers, fetchTrainersWithSlots } from "../../../home/api/homeApi";
import { useOnlinePresence } from "../../../socket/useOnlinePresence";
import { getTrainerCategories } from "../../../bookexpert/lib/trainerUtils";
import {
  TRAINEE_COACH_PAGE_SIZE,
  TRAINEE_COACH_PREVIEW_COUNT,
} from "../../lib/traineeDiscoverConstants";
import { sortTrainersForDiscover } from "../../lib/sortTrainersForDiscover";
import { PastBookedTrainersSection } from "./PastBookedTrainersSection";
import { ContinueWhereYouLeftOffCard } from "../trainee/ContinueWhereYouLeftOffCard";
import { CategoryEmptySuggestions } from "../trainee/CategoryEmptySuggestions";
import { FavoriteCoachesSection } from "../trainee/FavoriteCoachesSection";
import { useDashboardSessions } from "../../hooks/useDashboardSessions";
import { useFavoriteTrainers } from "../../hooks/useFavoriteTrainers";
import { useWalletBalance } from "../../../wallet/hooks/useWalletBalance";
import { TrainerBrowseFiltersSheet } from "../../../bookexpert/components/TrainerBrowseFiltersSheet";
import {
  countActiveFilters,
  DEFAULT_BROWSE_FILTERS,
  filtersToApiParams,
  type TrainerBrowseFilters,
} from "../../../bookexpert/lib/trainerBrowseConstants";
import { trainerHasOpenSlots } from "../../../bookexpert/lib/trainerUtils";
import { queryKeys } from "../../../../lib/queryKeys";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { getCategoryIcon } from "../../lib/categoryIcons";
import {
  getTraineeInterests,
  resolveTraineeDashboardCategories,
} from "../../lib/traineeInterests";
import { HomeUserAvatar } from "./HomeUserAvatar";

type Props = {
  /** Browse without account — trainer directory only; booking requires sign-in. */
  isGuest?: boolean;
  name: string;
  accountType: string;
  profilePicture?: string;
  user: Record<string, unknown> | null | undefined;
  onSettings: () => void;
  onViewTrainer: (t: Record<string, unknown>) => void;
  onInstantBook: (t: Record<string, unknown>) => void;
  onScheduleBook: (t: Record<string, unknown>) => void;
  /** When set, guest users see favorite control and tapping redirects to auth. */
  onToggleFavoriteGuest?: (t: Record<string, unknown>) => void;
  onOpenWallet?: () => void;
  onOpenSession?: (session: Record<string, unknown>) => void;
};

export function TraineeDiscoverDashboard({
  isGuest = false,
  name,
  accountType,
  profilePicture,
  user,
  onSettings,
  onViewTrainer,
  onInstantBook,
  onScheduleBook,
  onToggleFavoriteGuest,
  onOpenWallet,
  onOpenSession,
}: Props) {
  const { t } = useAppTranslation();
  const themeColors = useThemeColors();
  const styles = useStyles();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [browseFilters, setBrowseFilters] = useState<TrainerBrowseFilters>(DEFAULT_BROWSE_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(TRAINEE_COACH_PREVIEW_COUNT);

  const { nextSession } = useDashboardSessions(isGuest ? null : accountType);
  const { data: walletBalance } = useWalletBalance(!isGuest);
  const { isFavorite, toggleFavorite } = useFavoriteTrainers(!isGuest);
  const apiFilterParams = useMemo(() => filtersToApiParams(browseFilters), [browseFilters]);
  const activeFilterCount = countActiveFilters(browseFilters);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  const trimmed = debouncedSearch;
  const searchActive = trimmed.length >= 2 && !/^\d+$/.test(trimmed);

  const { data: masterSports = [] } = useQuery({
    queryKey: queryKeys.master.sportCategories,
    queryFn: fetchSportCategories,
    staleTime: 1000 * 60 * 30,
  });

  const interests = useMemo(() => getTraineeInterests(user), [user]);
  const dashboardCategories = useMemo(
    () => resolveTraineeDashboardCategories(interests, masterSports),
    [interests, masterSports]
  );

  /** Category filter: explicit filter sheet > sport chip > trainee profile interests */
  const apiCategories = useMemo(() => {
    if (browseFilters.selectedCategories.length > 0) {
      return browseFilters.selectedCategories.join(",");
    }
    if (searchActive) return undefined;
    if (selectedCategory) return selectedCategory;
    if (interests.length > 0) return interests.join(",");
    return undefined;
  }, [
    browseFilters.selectedCategories,
    searchActive,
    selectedCategory,
    interests,
  ]);

  const directoryFilterKey = JSON.stringify({
    apiCategories,
    searchActive,
    filters: apiFilterParams,
  });

  useEffect(() => {
    setVisibleCount(TRAINEE_COACH_PREVIEW_COUNT);
  }, [trimmed, directoryFilterKey]);

  const {
    data: directoryPages,
    isLoading,
    isRefetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: queryKeys.trainer.directorySearch(trimmed, directoryFilterKey),
    queryFn: ({ pageParam }) =>
      fetchTrainersWithSlots({
        search: searchActive ? trimmed : undefined,
        ...apiFilterParams,
        categories: apiCategories ?? apiFilterParams.categories,
        page: pageParam,
        limit: TRAINEE_COACH_PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.length >= TRAINEE_COACH_PAGE_SIZE ? lastPageParam + 1 : undefined,
    staleTime: 60_000,
  });

  const directoryRows = useMemo(
    () => directoryPages?.pages.flat() ?? [],
    [directoryPages]
  );

  const { data: onlineRaw = [] } = useQuery({
    queryKey: queryKeys.presence.bookExpertOnline,
    queryFn: fetchOnlineUsers,
    staleTime: 30_000,
    refetchInterval: isGuest ? false : 30_000,
    enabled: !isGuest,
  });

  const { isOnline } = useOnlinePresence();

  const mergedRows = useMemo(() => {
    const apiOnlineIds = new Set(onlineRaw.map((row: { _id?: string }) => String(row._id)));
    const isTrainerOnline = (id: string) => apiOnlineIds.has(id) || isOnline(id);
    let rows = directoryRows.map((row: Record<string, unknown>) => ({
      ...row,
      is_online: isTrainerOnline(String(row._id ?? "")),
    })) as Array<Record<string, unknown> & { is_online: boolean }>;
    if (browseFilters.onlineOnly) rows = rows.filter((r) => r.is_online);
    if (browseFilters.hasOpenSlots) {
      rows = rows.filter((r) => trainerHasOpenSlots(r));
    }
    return sortTrainersForDiscover(rows);
  }, [directoryRows, onlineRaw, isOnline, browseFilters.onlineOnly, browseFilters.hasOpenSlots]);

  const visibleRows = useMemo(
    () => mergedRows.slice(0, visibleCount),
    [mergedRows, visibleCount]
  );

  const canShowMore =
    visibleCount < mergedRows.length || Boolean(hasNextPage);

  const handleShowMore = () => {
    const nextVisible = visibleCount + TRAINEE_COACH_PAGE_SIZE;
    if (nextVisible > mergedRows.length && hasNextPage) {
      void fetchNextPage().then(() => setVisibleCount(nextVisible));
      return;
    }
    setVisibleCount(nextVisible);
  };

  const totalLabel =
    hasNextPage || mergedRows.length > visibleCount
      ? `${mergedRows.length}+`
      : String(mergedRows.length);

  const roleLabel = isGuest
    ? t("guest.exploringAsGuest")
    : accountType === AccountType.TRAINEE
      ? t("traineeDiscover.roleTrainee")
      : accountType || t("menu.member");

  const listTitle = searchActive
    ? t("traineeDiscover.resultsFor", { query: trimmed })
    : selectedCategory
      ? t("traineeDiscover.coachesIn", { category: selectedCategory })
      : interests.length > 0
        ? t("traineeDiscover.coachesForYou")
        : t("traineeDiscover.allCoaches");

  const showCategoryHint = interests.length === 0 && dashboardCategories.length > 0;

  const walletCredits =
    walletBalance?.balances?.available != null
      ? `$${(walletBalance.balances.available).toFixed(0)}`
      : "—";

  const altCategories = useMemo(() => {
    if (!selectedCategory) return [];
    return dashboardCategories.filter((c) => c !== selectedCategory).slice(0, 3);
  }, [selectedCategory, dashboardCategories]);

  return (
    <View style={styles.root}>
      <TrainerBrowseFiltersSheet
        visible={filtersOpen}
        value={browseFilters}
        onApply={setBrowseFilters}
        onDismiss={() => setFiltersOpen(false)}
      />

      <View style={styles.headerCard}>
        <View style={styles.headerTextCol}>
          <Text style={styles.welcome}>{t("traineeDiscover.welcome", { name })}</Text>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>{roleLabel}</Text>
          </View>
        </View>
        <Pressable
          onPress={onSettings}
          accessibilityRole="button"
          accessibilityLabel={t("traineeDiscover.profileA11y")}
        >
          <HomeUserAvatar uri={profilePicture} name={name} size={72} />
        </Pressable>
      </View>

      {onOpenWallet && !isGuest ? (
        <Pressable
          style={({ pressed }) => [styles.walletCard, pressed && { opacity: 0.92 }]}
          onPress={onOpenWallet}
          accessibilityRole="button"
          accessibilityLabel={t("traineeDiscover.walletA11y")}
        >
          <Ionicons name="wallet-outline" size={22} color={themeColors.brandNavy} />
          <Text style={styles.walletLabel}>{t("traineeDiscover.walletCredits")}</Text>
          <Text style={styles.walletValue}>{walletCredits}</Text>
          <Ionicons name="chevron-forward" size={18} color={themeColors.textMuted} />
        </Pressable>
      ) : null}

      {!isGuest && nextSession ? (
        <ContinueWhereYouLeftOffCard
          session={nextSession}
          onOpenSession={onOpenSession ? () => onOpenSession(nextSession) : undefined}
        />
      ) : null}

      {!isGuest ? <PastBookedTrainersSection onSelectTrainer={onViewTrainer} /> : null}

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={20} color={themeColors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder={t("traineeDiscover.searchPlaceholder")}
          placeholderTextColor={themeColors.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          autoCorrect={false}
        />
        {!!search && (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={20} color={themeColors.textMuted} />
          </Pressable>
        )}
        <Pressable
          style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
          onPress={() => setFiltersOpen(true)}
          accessibilityLabel={t("traineeDiscover.openFiltersA11y")}
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={activeFilterCount > 0 ? themeColors.brandTextOn : themeColors.brandNavy}
          />
          {activeFilterCount > 0 ? (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {search.trim().length > 0 && search.trim().length < 2 && (
        <Text style={styles.searchHint}>{t("bookExpert.searchMinHint")}</Text>
      )}

      {!isGuest ? <FavoriteCoachesSection onSelectTrainer={onViewTrainer} /> : null}

      {!searchActive && (
        <>
          <Text style={styles.sectionLabel}>
            {interests.length > 0
              ? t("traineeDiscover.yourSports")
              : t("traineeDiscover.browseSports")}
          </Text>
          {showCategoryHint && (
            <Text style={styles.hint}>{t("traineeDiscover.addInterestsHint")}</Text>
          )}
          <FlatList
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            data={[{ id: "__all__", label: t("traineeDiscover.all") }, ...dashboardCategories.map((c) => ({ id: c, label: c }))]}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.categoryStrip}
            renderItem={({ item }) => {
              const active =
                item.id === "__all__" ? selectedCategory === null : selectedCategory === item.label;
              const icon =
                item.id === "__all__"
                  ? ("grid-outline" as const)
                  : getCategoryIcon(item.label);
              return (
                <Pressable
                  style={[styles.categoryTile, active && styles.categoryTileActive]}
                  onPress={() =>
                    setSelectedCategory(item.id === "__all__" ? null : item.label)
                  }
                >
                  <View style={[styles.categoryIconWrap, active && styles.categoryIconWrapActive]}>
                    <Ionicons
                      name={icon}
                      size={22}
                      color={active ? themeColors.brandTextOn : themeColors.brandNavy}
                    />
                  </View>
                  <Text
                    style={[styles.categoryLabel, active && styles.categoryLabelActive]}
                    numberOfLines={2}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            }}
          />
        </>
      )}

      <View style={styles.listHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.listTitle}>{listTitle}</Text>
          {!isLoading && mergedRows.length > 0 && (
            <Text style={styles.listMeta}>
              {t("traineeDiscover.showingCount", {
                shown: visibleRows.length,
                total: totalLabel,
              })}
            </Text>
          )}
        </View>
        <Pressable
          style={[styles.liveFilter, browseFilters.onlineOnly && styles.liveFilterOn]}
          onPress={() =>
            setBrowseFilters((f) => ({ ...f, onlineOnly: !f.onlineOnly }))
          }
        >
          <View
            style={[styles.liveFilterDot, browseFilters.onlineOnly && styles.liveFilterDotOn]}
          />
          <Text
            style={[
              styles.liveFilterText,
              browseFilters.onlineOnly && styles.liveFilterTextOn,
            ]}
          >
            {t("traineeDiscover.liveOnly")}
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} width="100%" height={150} radius={radii.lg} style={{ marginBottom: space.sm }} />
          ))}
        </View>
      ) : mergedRows.length === 0 ? (
        selectedCategory && altCategories.length > 0 ? (
          <CategoryEmptySuggestions
            category={selectedCategory}
            alternatives={altCategories}
            onPick={setSelectedCategory}
          />
        ) : (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={40} color={themeColors.textMuted} />
            <Text style={styles.emptyTitle}>{t("traineeDiscover.emptyTitle")}</Text>
            <Text style={styles.emptySub}>{t("traineeDiscover.emptySub")}</Text>
          </View>
        )
      ) : (
        <View style={styles.trainerList}>
          {visibleRows.map((trainer) => {
            const highlight =
              searchActive && getTrainerCategories(trainer).length > 0
                ? getTrainerCategories(trainer)[0]
                : undefined;
            return (
              <TrainerBrowseCard
                key={String(trainer._id)}
                trainer={trainer}
                themeColors={themeColors}
                onPress={onViewTrainer}
                onBook={onInstantBook}
                onSchedule={onScheduleBook}
                highlightCategory={highlight}
                isFavorite={isGuest ? false : isFavorite(trainer)}
                onToggleFavorite={
                  isGuest
                    ? onToggleFavoriteGuest
                      ? () => onToggleFavoriteGuest(trainer)
                      : undefined
                    : () => toggleFavorite(trainer)
                }
              />
            );
          })}
          {canShowMore && (
            <Pressable
              style={({ pressed }) => [styles.showMoreBtn, pressed && { opacity: 0.85 }]}
              onPress={handleShowMore}
              disabled={isFetchingNextPage}
              accessibilityRole="button"
              accessibilityLabel={t("traineeDiscover.showMoreA11y")}
            >
              {isFetchingNextPage ? (
                <ActivityIndicator color={themeColors.brandNavy} />
              ) : (
                <>
                  <Text style={styles.showMoreText}>{t("traineeDiscover.showMore")}</Text>
                  <Ionicons name="chevron-down" size={18} color={themeColors.brandNavy} />
                </>
              )}
            </Pressable>
          )}
          {(isRefetching || isFetchingNextPage) && visibleRows.length > 0 && !canShowMore && (
            <ActivityIndicator style={{ marginVertical: space.md }} color={themeColors.brandNavy} />
          )}
        </View>
      )}
    </View>
  );
}

function useStyles() {
  const c = useThemeColors();
  return useThemedStyles((palette) =>
    StyleSheet.create({
      root: { gap: space.sm },
      headerCard: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.lg,
        padding: space.md,
        borderWidth: 1,
        borderColor: palette.border,
      },
      headerTextCol: { flex: 1, minWidth: 0, paddingRight: space.md },
      welcome: { ...typography.titleMd, color: palette.text, fontWeight: "700" },
      rolePill: {
        alignSelf: "flex-start",
        marginTop: space.sm,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: radii.pill,
        backgroundColor: palette.brandSubtle,
      },
      rolePillText: { ...typography.caption, color: palette.brandNavy, fontWeight: "700" },
      walletCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        marginTop: space.sm,
        paddingHorizontal: space.md,
        paddingVertical: space.md,
        borderRadius: radii.lg,
        backgroundColor: palette.surfaceElevated,
        borderWidth: 1,
        borderColor: palette.border,
      },
      walletLabel: {
        ...typography.bodySm,
        color: palette.textMuted,
        flexShrink: 0,
      },
      walletValue: {
        ...typography.titleSm,
        color: palette.text,
        fontWeight: "700",
        flex: 1,
        textAlign: "right",
      },
      filterBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: palette.border,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: palette.surface,
      },
      filterBtnActive: { backgroundColor: palette.brandNavy, borderColor: palette.brandNavy },
      filterBadge: {
        position: "absolute",
        top: -4,
        right: -4,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: palette.error,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 4,
      },
      filterBadgeText: { fontSize: 10, fontWeight: "700", color: "#fff" },
      searchBar: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.lg,
        paddingHorizontal: space.md,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: palette.border,
      },
      searchInput: {
        flex: 1,
        fontSize: typography.bodyMd.fontSize,
        color: palette.text,
        paddingVertical: 0,
      },
      searchHint: {
        ...typography.caption,
        color: palette.textMuted,
        paddingHorizontal: 4,
      },
      sectionLabel: {
        ...typography.titleSm,
        color: palette.text,
        fontWeight: "700",
        marginTop: space.xs,
      },
      hint: {
        ...typography.caption,
        color: palette.textMuted,
        marginBottom: 4,
      },
      categoryStrip: {
        gap: space.sm,
        paddingVertical: space.sm,
      },
      categoryTile: {
        width: 88,
        alignItems: "center",
        paddingVertical: space.sm,
        paddingHorizontal: 6,
        borderRadius: radii.md,
        backgroundColor: palette.surfaceElevated,
        borderWidth: 1,
        borderColor: palette.border,
      },
      categoryTileActive: {
        borderColor: palette.brandNavy,
        backgroundColor: palette.brandSubtle,
      },
      categoryIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: palette.surface,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 6,
      },
      categoryIconWrapActive: { backgroundColor: palette.brandNavy },
      categoryLabel: {
        ...typography.caption,
        color: palette.textSecondary,
        textAlign: "center",
        fontWeight: "600",
      },
      categoryLabelActive: { color: palette.brandNavy },
      listHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: space.xs,
        gap: space.sm,
      },
      listTitle: { ...typography.titleSm, color: palette.text, fontWeight: "700" },
      listMeta: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
      showMoreBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: space.md,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: palette.brandNavy,
        backgroundColor: palette.surfaceElevated,
      },
      showMoreText: { ...typography.label, color: palette.brandNavy, fontWeight: "700" },
      liveFilter: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surfaceElevated,
      },
      liveFilterOn: {
        borderColor: palette.success,
        backgroundColor: `${palette.success}14`,
      },
      liveFilterDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: palette.textMuted,
      },
      liveFilterDotOn: { backgroundColor: palette.success },
      liveFilterText: { ...typography.caption, color: palette.textMuted, fontWeight: "600" },
      liveFilterTextOn: { color: palette.success },
      loading: { gap: space.sm, marginTop: space.sm },
      trainerList: { gap: space.md, marginTop: space.sm },
      empty: {
        alignItems: "center",
        paddingVertical: space.xl,
        gap: space.sm,
      },
      emptyTitle: { ...typography.titleSm, color: palette.text },
      emptySub: { ...typography.bodySm, color: palette.textMuted, textAlign: "center" },
    })
  );
}
