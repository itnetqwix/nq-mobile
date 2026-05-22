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
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Skeleton } from "../../../../components/ui";
import { AccountType } from "../../../../constants/accountType";
import { fetchSportCategories } from "../../../auth/api/masterApi";
import { TrainerBrowseCard } from "../../../bookexpert/components/TrainerBrowseCard";
import { fetchOnlineUsers, fetchTrainersWithSlots } from "../../../home/api/homeApi";
import { useOnlinePresence } from "../../../socket/useOnlinePresence";
import { getTrainerCategories } from "../../../bookexpert/lib/trainerUtils";
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
  name: string;
  accountType: string;
  profilePicture?: string;
  user: Record<string, unknown> | null | undefined;
  onSettings: () => void;
  onViewTrainer: (t: Record<string, unknown>) => void;
  onInstantBook: (t: Record<string, unknown>) => void;
  onScheduleBook: (t: Record<string, unknown>) => void;
};

export function TraineeDiscoverDashboard({
  name,
  accountType,
  profilePicture,
  user,
  onSettings,
  onViewTrainer,
  onInstantBook,
  onScheduleBook,
}: Props) {
  const { t } = useAppTranslation();
  const themeColors = useThemeColors();
  const styles = useStyles();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [liveOnly, setLiveOnly] = useState(false);

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

  const apiCategories = useMemo(() => {
    if (searchActive) return undefined;
    if (selectedCategory) return selectedCategory;
    if (interests.length > 0) return interests.join(",");
    return undefined;
  }, [searchActive, selectedCategory, interests]);

  const {
    data: directoryRows = [],
    isLoading,
    isRefetching,
  } = useQuery({
    queryKey: queryKeys.trainer.directorySearch(
      trimmed,
      JSON.stringify({ apiCategories, liveOnly })
    ),
    queryFn: () =>
      fetchTrainersWithSlots({
        search: searchActive ? trimmed : undefined,
        categories: apiCategories,
        onlineOnly: liveOnly || undefined,
        limit: 80,
        sortBy: "rating",
      }),
    staleTime: 60_000,
  });

  const { data: onlineRaw = [] } = useQuery({
    queryKey: queryKeys.presence.bookExpertOnline,
    queryFn: fetchOnlineUsers,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const { isOnline } = useOnlinePresence();

  const mergedRows = useMemo(() => {
    const apiOnlineIds = new Set(onlineRaw.map((row: { _id?: string }) => String(row._id)));
    const isTrainerOnline = (id: string) => apiOnlineIds.has(id) || isOnline(id);
    let rows = directoryRows.map((row: Record<string, unknown>) => ({
      ...row,
      is_online: isTrainerOnline(String(row._id ?? "")),
    })) as Array<Record<string, unknown> & { is_online: boolean }>;
    if (liveOnly) rows = rows.filter((r) => r.is_online);
    rows.sort((a, b) => {
      if (a.is_online !== b.is_online) return a.is_online ? -1 : 1;
      return 0;
    });
    return rows;
  }, [directoryRows, onlineRaw, isOnline, liveOnly]);

  const roleLabel =
    accountType === AccountType.TRAINEE
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

  return (
    <View style={styles.root}>
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
      </View>

      {search.trim().length > 0 && search.trim().length < 2 && (
        <Text style={styles.searchHint}>{t("bookExpert.searchMinHint")}</Text>
      )}

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
        <Text style={styles.listTitle}>{listTitle}</Text>
        <Pressable
          style={[styles.liveFilter, liveOnly && styles.liveFilterOn]}
          onPress={() => setLiveOnly((v) => !v)}
        >
          <View style={[styles.liveFilterDot, liveOnly && styles.liveFilterDotOn]} />
          <Text style={[styles.liveFilterText, liveOnly && styles.liveFilterTextOn]}>
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
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={40} color={themeColors.textMuted} />
          <Text style={styles.emptyTitle}>{t("traineeDiscover.emptyTitle")}</Text>
          <Text style={styles.emptySub}>{t("traineeDiscover.emptySub")}</Text>
        </View>
      ) : (
        <View style={styles.trainerList}>
          {mergedRows.map((trainer) => {
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
              />
            );
          })}
          {isRefetching && (
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
      listTitle: { ...typography.titleSm, color: palette.text, fontWeight: "700", flex: 1 },
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
