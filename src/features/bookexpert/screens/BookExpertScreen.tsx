import React, { useEffect, useMemo, useState } from "react";
import type { BrowseTrainersParams } from "../../home/api/homeApi";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Button, EmptyState, Skeleton } from "../../../components/ui";
import { type AppColors, radii, space, typography, useThemeColors } from "../../../theme";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { fetchOnlineUsers, fetchTrainersWithSlots } from "../../home/api/homeApi";
import { useOnlinePresence } from "../../socket/useOnlinePresence";
import { InstantLessonBookingWizardModal } from "../../instant-lesson/booking-wizard";
import { ScheduledBookingModal } from "../../bookings/screens/ScheduledBookingModal";
import type { MenuStackParamList } from "../../../navigation/types";

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

const SORT_OPTIONS: { key: NonNullable<BrowseTrainersParams["sortBy"]>; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "rating", label: "Rating" },
  { key: "hourly_rate", label: "Rate ↑" },
  { key: "hourly_rate_desc", label: "Rate ↓" },
];

function TrainerCard({
  trainer,
  onBook,
  onSchedule,
  styles,
  themeColors,
}: {
  trainer: any;
  onBook: (t: any) => void;
  onSchedule: (t: any) => void;
  styles: ReturnType<typeof makeStyles>;
  themeColors: AppColors;
}) {
  const { isOnline } = useOnlinePresence();
  const trainerId = String(trainer?._id ?? "");
  const name = trainer?.fullname || trainer?.fullName || "Trainer";
  const showOnline = isOnline(trainerId) || !!trainer?.is_online;
  const cats = Array.isArray(trainer?.categories)
    ? trainer.categories.slice(0, 3).join(" • ")
    : trainer?.categories ?? "";
  const rating = trainer?.avgRating ?? trainer?.rating;
  const hourly = trainer?.hourly_rate ?? trainer?.extraInfo?.hourly_rate;
  const slotsCount = Array.isArray(trainer?.slots) ? trainer.slots.length : null;

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <Avatar uri={trainer?.profile_picture} name={name} size={64} styles={styles} />
        <View style={styles.cardInfo}>
          <Text style={styles.trainerName}>{name}</Text>
          {!!cats && (
            <Text style={styles.trainerCat} numberOfLines={2}>
              {cats}
            </Text>
          )}
          {rating != null && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={13} color={themeColors.warning} />
              <Text style={styles.ratingText}>{Number(rating).toFixed(1)}</Text>
            </View>
          )}
          {hourly != null && Number(hourly) > 0 && (
            <Text style={styles.rateText}>${Number(hourly).toFixed(0)}/hr</Text>
          )}
          {slotsCount !== null && (
            <Text style={styles.slotsText}>
              {slotsCount} slot{slotsCount !== 1 ? "s" : ""} available
            </Text>
          )}
        </View>
      </View>
      <View style={styles.cardFooter}>
        <View style={styles.btnRow}>
          <Button
            label="Instant"
            leftIcon="flash"
            size="sm"
            fullWidth={false}
            onPress={() => onBook(trainer)}
          />
          <Button
            label="Schedule"
            leftIcon="calendar-outline"
            size="sm"
            fullWidth={false}
            onPress={() => onSchedule(trainer)}
          />
        </View>
        {showOnline && (
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Online</Text>
          </View>
        )}
      </View>
    </View>
  );
}

type Props = { bookLessonTrainerId?: string };

export function BookExpertScreen({ bookLessonTrainerId }: Props) {
  const themeColors = useThemeColors();
  const styles = useMemo(() => makeStyles(themeColors), [themeColors]);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sortBy, setSortBy] = useState<NonNullable<BrowseTrainersParams["sortBy"]>>("name");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [wizardTrainer, setWizardTrainer] = useState<Record<string, unknown> | null>(null);
  const [scheduleTrainer, setScheduleTrainer] = useState<Record<string, unknown> | null>(null);
  const navigation = useNavigation<NativeStackNavigationProp<MenuStackParamList>>();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const trimmed = debouncedSearch;
  const searchActive = trimmed.length >= 2 && !/^\d+$/.test(trimmed);

  const {
    data: directoryRows = [],
    isLoading: directoryLoading,
    isRefetching: directoryRefetching,
    refetch: refetchDirectory,
  } = useQuery({
    queryKey: ["trainersDirectory", trimmed, category, sortBy, onlineOnly],
    queryFn: () =>
      fetchTrainersWithSlots({
        search: searchActive ? trimmed : undefined,
        category: category.trim() || undefined,
        sortBy,
        onlineOnly,
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
    if (onlineOnly) return rows.filter((t) => t.is_online);
    return rows;
  }, [directoryRows, onlineRaw, isOnline, onlineOnly]);

  const loading = directoryLoading;
  const refreshing = directoryRefetching;

  const onRefresh = () => {
    void refetchDirectory();
  };

  useEffect(() => {
    if (!bookLessonTrainerId || mergedRows.length === 0) return;
    const match = mergedRows.find((t) => String(t._id) === String(bookLessonTrainerId));
    if (match) {
      setWizardTrainer(match);
      navigation.setParams({ featureId: "book-lesson", bookLessonTrainerId: undefined });
    }
  }, [bookLessonTrainerId, mergedRows, navigation]);

  const handleBook = (trainer: any) => {
    setWizardTrainer(trainer);
  };

  return (
    <View style={styles.root}>
      <InstantLessonBookingWizardModal
        visible={!!wizardTrainer}
        trainer={wizardTrainer}
        onDismiss={() => setWizardTrainer(null)}
      />
      <ScheduledBookingModal
        visible={!!scheduleTrainer}
        trainer={scheduleTrainer}
        onDismiss={() => setScheduleTrainer(null)}
      />

      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Book a coach</Text>
        <Text style={styles.heroSub}>
          Browse all coaches or search by name. Filter by category, sort by rating or rate, and show online only.
        </Text>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={themeColors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search trainers…"
          placeholderTextColor={themeColors.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          autoCorrect={false}
        />
        {!!search && (
          <Pressable onPress={() => setSearch("")} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={18} color={themeColors.textMuted} />
          </Pressable>
        )}
      </View>

      <View style={styles.filterRow}>
        <TextInput
          style={styles.categoryInput}
          placeholder="Category filter"
          placeholderTextColor={themeColors.textMuted}
          value={category}
          onChangeText={setCategory}
          autoCorrect={false}
        />
        <Pressable
          style={[styles.filterChip, onlineOnly && styles.filterChipActive]}
          onPress={() => setOnlineOnly((v) => !v)}
        >
          <Ionicons
            name="radio-button-on"
            size={14}
            color={onlineOnly ? themeColors.brandTextOn : themeColors.success}
          />
          <Text style={[styles.filterChipText, onlineOnly && styles.filterChipTextActive]}>Online</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
        {SORT_OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            style={[styles.sortChip, sortBy === opt.key && styles.sortChipActive]}
            onPress={() => setSortBy(opt.key)}
          >
            <Text style={[styles.sortChipText, sortBy === opt.key && styles.sortChipTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {search.trim().length > 0 && search.trim().length < 2 && (
        <Text style={styles.searchHint}>Enter at least 2 characters to narrow search.</Text>
      )}

      {loading ? (
        <View style={styles.list}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ marginBottom: space.md }}>
              <Skeleton width="100%" height={132} radius={radii.md} />
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
              onBook={handleBook}
              onSchedule={(t) => setScheduleTrainer(t)}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.brandNavy} />
          }
          ListHeaderComponent={
            <View style={styles.listBanner}>
              <Ionicons
                name={searchActive ? "funnel-outline" : "people-outline"}
                size={16}
                color={themeColors.brandNavy}
              />
              <Text style={styles.listBannerText}>
                {searchActive
                  ? `Results for "${trimmed}"`
                  : onlineOnly
                    ? "Online coaches"
                    : "All coaches — book instant or schedule"}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title={searchActive || category.trim() ? "No trainers match your filters" : "No coaches found"}
              description="Try another search, category, or turn off Online-only."
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
    heroSub: { ...typography.bodySm, color: colors.textMuted, marginTop: 6 },
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
      fontWeight: typography.bodyMd.fontWeight,
      fontFamily: typography.bodyMd.fontFamily,
      letterSpacing: typography.bodyMd.letterSpacing,
      color: colors.text,
      paddingVertical: 0,
      textAlignVertical: "center",
    },
    filterRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      paddingHorizontal: space.md,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    categoryInput: {
      flex: 1,
      ...typography.bodySm,
      color: colors.text,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    filterChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipActive: { backgroundColor: colors.brandNavy, borderColor: colors.brandNavy },
    filterChipText: { ...typography.caption, fontWeight: "600", color: colors.textSecondary },
    filterChipTextActive: { color: colors.brandTextOn },
    sortRow: {
      paddingHorizontal: space.md,
      paddingVertical: 8,
      gap: 8,
    },
    sortChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
    },
    sortChipActive: { backgroundColor: colors.brandNavy, borderColor: colors.brandNavy },
    sortChipText: { ...typography.caption, fontWeight: "600", color: colors.textMuted },
    sortChipTextActive: { color: colors.brandTextOn },
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
    cardInfo: { flex: 1 },
    trainerName: { ...typography.titleSm, color: colors.text },
    trainerCat: { ...typography.bodySm, color: colors.textMuted, marginTop: 3 },
    ratingRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4 },
    ratingText: { ...typography.bodySm, fontWeight: "600", color: colors.textSecondary },
    rateText: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
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
    onlineBadge: { flexDirection: "row", alignItems: "center", gap: 5 },
    onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
    onlineText: { ...typography.caption, color: colors.success, fontWeight: "600" },
    avatarFallback: { backgroundColor: colors.brandNavy, alignItems: "center", justifyContent: "center" },
    avatarInitial: { color: colors.brandTextOn, fontWeight: "700" },
  });
}
