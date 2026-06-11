import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { SkeletonGroup, TrainerBrowseCardSkeleton } from "../../../../components/ui";
import { AccountType } from "../../../../constants/accountType";
import { fetchSportCategories } from "../../../auth/api/masterApi";
import { TrainerBrowseCard } from "../../../bookexpert/components/TrainerBrowseCard";
import {
  dedupeRowsById,
  fetchOnlineUsers,
  fetchTrainersWithSlots,
} from "../../../home/api/homeApi";
import { useOnlinePresence } from "../../../socket/useOnlinePresence";
import { getTrainerCategories } from "../../../bookexpert/lib/trainerUtils";
import { trainerListItemKey } from "../../../../lib/lists/trainerListUtils";
import {
  TRAINEE_COACH_PAGE_SIZE,
  TRAINEE_COACH_PREVIEW_COUNT,
} from "../../lib/traineeDiscoverConstants";
import { sortTrainersForDiscover } from "../../lib/sortTrainersForDiscover";
import { PastBookedTrainersSection } from "./PastBookedTrainersSection";
import { ForYouTrainersSection } from "./ForYouTrainersSection";
import { GuestSeededCoachesSection } from "./GuestSeededCoachesSection";
import { RecentlyViewedTrainersRow } from "./RecentlyViewedTrainersRow";
import { useRecentlyViewedTrainers } from "../../hooks/useRecentlyViewedTrainers";
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
import { resolveTraineeTimeZone } from "../../../../lib/user/resolveTraineeTimeZone";
import { queryKeys } from "../../../../lib/queryKeys";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { getCategoryIcon } from "../../lib/categoryIcons";
import {
  getTraineeInterests,
  resolveTraineeDashboardCategories,
} from "../../lib/traineeInterests";
import { HomeHeroCarousel } from "../../../home/components/HomeHeroCarousel";
import { HomeOffersCarousel } from "../../../home/components/HomeOffersCarousel";
import { StickyBottomPromoBar } from "../../../home/components/StickyBottomPromoBar";
import { DiscoverHomeChrome } from "../../../home/layout/DiscoverHomeChrome";
import { MiniFriendsSection } from "../shared/MiniFriendsSection";
import { useHomeScrollHandler } from "../../../home/hooks/useHomeScrollHandler";
import { useSearchVoice } from "../../../home/hooks/useSearchVoice";
import type { HomeCategoryChip } from "../../../home/components/HomeCategoryChipsRow";
import {
  useMarketplaceContentWidth,
  useMarketplaceHorizontalPad,
  useMarketplaceScrollPadding,
} from "../../../home/layout/marketplaceLayout";
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
  onOpenFriends?: () => void;
  leadingContent?: React.ReactNode;
  footer?: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  refreshControl?: React.ReactElement<React.ComponentProps<typeof RefreshControl>>;
  /** Combined morph + tab-bar scroll handler from the parent home screen. */
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle?: number;
  onDeepLink?: (url: string) => void;
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
  onOpenFriends,
  leadingContent,
  footer,
  contentContainerStyle,
  refreshControl,
  onScroll: onScrollProp,
  scrollEventThrottle: scrollEventThrottleProp,
  onDeepLink,
}: Props) {
  const marketplacePad = useMarketplaceHorizontalPad();
  const marketplaceContentWidth = useMarketplaceContentWidth();
  const marketplaceScrollBottom = useMarketplaceScrollPadding();
  const homeScroll = useHomeScrollHandler();
  const { t } = useAppTranslation();
  const themeColors = useThemeColors();
  const styles = useStyles();
  const [search, setSearch] = useState("");
  const { voice, toggle: toggleVoice } = useSearchVoice(setSearch);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [browseFilters, setBrowseFilters] = useState<TrainerBrowseFilters>(DEFAULT_BROWSE_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(TRAINEE_COACH_PREVIEW_COUNT);

  const { nextSession } = useDashboardSessions(isGuest ? null : accountType);
  const { data: walletBalance } = useWalletBalance(!isGuest);
  const isTraineeAccount = accountType === AccountType.TRAINEE;
  const { isFavorite, toggleFavorite } = useFavoriteTrainers(!isGuest && isTraineeAccount);
  const userId = user?._id != null ? String(user._id) : null;
  const { recentTrainers, track: trackRecentTrainer } = useRecentlyViewedTrainers(
    isGuest ? null : userId
  );
  const recentTrainerIds = useMemo(
    () => recentTrainers.map((r) => String(r._id ?? "")).filter(Boolean),
    [recentTrainers]
  );
  const handleViewTrainer = useCallback(
    (trainer: Record<string, unknown>) => {
      void trackRecentTrainer(trainer);
      onViewTrainer(trainer);
    },
    [onViewTrainer, trackRecentTrainer]
  );
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

  const traineeTimeZone = resolveTraineeTimeZone(user ?? undefined);

  const directoryFilterKey = JSON.stringify({
    apiCategories,
    searchActive,
    filters: apiFilterParams,
    traineeTimeZone,
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
        traineeTimeZone,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.length >= TRAINEE_COACH_PAGE_SIZE ? lastPageParam + 1 : undefined,
    staleTime: 60_000,
  });

  const directoryRows = useMemo(
    () => dedupeRowsById(directoryPages?.pages.flat() ?? []),
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
    return sortTrainersForDiscover(
      dedupeRowsById(rows as Array<{ _id?: unknown; id?: unknown }>)
    );
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

  const marketplaceHeadline = name || t("traineeDiscover.roleTrainee", { defaultValue: "Trainee" });
  const marketplaceSubline = isGuest ? t("guest.exploringAsGuest") : undefined;

  const listTitle = searchActive
    ? t("traineeDiscover.resultsFor", { query: trimmed })
    : selectedCategory
      ? t("traineeDiscover.coachesIn", { category: selectedCategory })
      : interests.length > 0
        ? t("traineeDiscover.coachesForYou")
        : t("traineeDiscover.allCoaches");

  const walletCredits =
    walletBalance?.balances?.available != null
      ? `$${(walletBalance.balances.available).toFixed(0)}`
      : "—";

  const altCategories = useMemo(() => {
    if (!selectedCategory) return [];
    return dashboardCategories.filter((c) => c !== selectedCategory).slice(0, 3);
  }, [selectedCategory, dashboardCategories]);

  const categoryStripItems = useMemo<HomeCategoryChip[]>(
    () => [
      { id: "__all__", label: t("traineeDiscover.all"), icon: "grid-outline" },
      ...dashboardCategories.map((c) => ({
        id: c,
        label: c,
        icon: getCategoryIcon(c),
      })),
    ],
    [dashboardCategories, t]
  );

  const discoverBody = (
    <>
      <TrainerBrowseFiltersSheet
        visible={filtersOpen}
        value={browseFilters}
        onApply={setBrowseFilters}
        onDismiss={() => setFiltersOpen(false)}
      />

      {!isGuest && nextSession ? (
        <ContinueWhereYouLeftOffCard
          session={nextSession}
          onOpenSession={onOpenSession ? () => onOpenSession(nextSession) : undefined}
        />
      ) : null}

      {!isGuest ? <PastBookedTrainersSection onSelectTrainer={handleViewTrainer} /> : null}

      {!isGuest ? <FavoriteCoachesSection onSelectTrainer={handleViewTrainer} /> : null}

      {!isGuest && onOpenFriends ? (
        <MiniFriendsSection onPressAll={onOpenFriends} />
      ) : null}

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
        <SkeletonGroup
          count={4}
          style={styles.loading}
          renderRow={() => <TrainerBrowseCardSkeleton />}
        />
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
          {visibleRows.map((trainer, index) => {
            const highlight =
              searchActive && getTrainerCategories(trainer).length > 0
                ? getTrainerCategories(trainer)[0]
                : undefined;
            return (
              <TrainerBrowseCard
                key={trainerListItemKey(trainer, index, "discover-")}
                trainer={trainer}
                themeColors={themeColors}
                onPress={handleViewTrainer}
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
    </>
  );

  const marketplaceScrollContent = (
    <>
      {leadingContent}
      <HomeHeroCarousel
        guest={isGuest}
        onDeepLink={onDeepLink}
        contentWidth={marketplaceContentWidth}
      />
      <HomeOffersCarousel guest={isGuest} onDeepLink={onDeepLink} />
      <View style={styles.root}>{discoverBody}</View>
      {footer ? <View style={styles.footerWrap}>{footer}</View> : null}
    </>
  );

  return (
    <View style={{ flex: 1 }}>
      <DiscoverHomeChrome
        compactTop
        headline={marketplaceHeadline}
        subline={marketplaceSubline}
        profilePicture={profilePicture}
        profileName={name}
        onPressProfile={onSettings}
        searchValue={search}
        onSearchChange={setSearch}
        onOpenFilters={() => setFiltersOpen(true)}
        activeFilterCount={activeFilterCount}
        categoryChips={!searchActive ? categoryStripItems : undefined}
        selectedCategoryId={selectedCategory ?? "__all__"}
        onSelectCategory={(id) => setSelectedCategory(id)}
        voiceState={voice.state}
        onVoicePress={toggleVoice}
      />
      {search.trim().length > 0 && search.trim().length < 2 ? (
        <Text
          style={[
            styles.searchHint,
            {
              paddingLeft: marketplacePad.paddingLeft,
              paddingRight: marketplacePad.paddingRight,
            },
          ]}
        >
          {t("bookExpert.searchMinHint")}
        </Text>
      ) : null}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          contentContainerStyle,
          { paddingBottom: marketplaceScrollBottom },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={onScrollProp ?? homeScroll.onScroll}
        scrollEventThrottle={scrollEventThrottleProp ?? homeScroll.scrollEventThrottle}
        refreshControl={refreshControl}
      >
        {marketplaceScrollContent}
      </ScrollView>
      <StickyBottomPromoBar guest={isGuest} onDeepLink={onDeepLink} />
    </View>
  );
}

function useStyles() {
  const c = useThemeColors();
  return useThemedStyles((palette) =>
    StyleSheet.create({
      root: { gap: space.md, paddingTop: space.xs },
      footerWrap: { marginTop: space.md },
      walletCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        marginTop: 0,
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
      searchHint: {
        ...typography.caption,
        color: palette.textMuted,
        marginBottom: space.xs,
      },
      listHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: space.xs,
        gap: space.sm,
      },
      listTitle: { ...typography.titleSm, color: palette.text, fontWeight: "700" },
      listMeta: { ...typography.caption, color: palette.textMuted, marginTop: space.xxs },
      showMoreBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: space.xs,
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
        gap: space.xs,
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
