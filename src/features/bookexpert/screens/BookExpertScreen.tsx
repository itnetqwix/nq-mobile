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
import { colors, radii, space } from "../../../theme/tokens";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { fetchOnlineUsers, fetchTrainersWithSlots } from "../../home/api/homeApi";
import { InstantLessonBookingWizardModal } from "../../instant-lesson/booking-wizard";
import type { MenuStackParamList } from "../../../navigation/types";

const NAVY = "#000080";

function Avatar({ uri, name, size = 64 }: { uri?: string; name?: string; size?: number }) {
  const [failed, setFailed] = React.useState(false);
  const url = getS3ImageUrl(uri);
  if (!url || failed) {
    return (
      <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.avatarInitial, { fontSize: size * 0.38 }]}>
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

function TrainerCard({ trainer, onBook }: { trainer: any; onBook: (t: any) => void }) {
  const name = trainer?.fullname || trainer?.fullName || "Trainer";
  const cats = Array.isArray(trainer?.categories)
    ? trainer.categories.slice(0, 3).join(" • ")
    : trainer?.categories ?? "";
  const rating = trainer?.rating;
  const slotsCount = Array.isArray(trainer?.slots) ? trainer.slots.length : null;

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <Avatar uri={trainer?.profile_picture} name={name} size={64} />
        <View style={styles.cardInfo}>
          <Text style={styles.trainerName}>{name}</Text>
          {!!cats && (
            <Text style={styles.trainerCat} numberOfLines={2}>
              {cats}
            </Text>
          )}
          {rating != null && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={13} color="#f59e0b" />
              <Text style={styles.ratingText}>{Number(rating).toFixed(1)}</Text>
            </View>
          )}
          {slotsCount !== null && (
            <Text style={styles.slotsText}>
              {slotsCount} slot{slotsCount !== 1 ? "s" : ""} available
            </Text>
          )}
        </View>
      </View>
      <View style={styles.cardFooter}>
        <Pressable
          style={({ pressed }) => [styles.bookBtn, pressed && styles.bookBtnPressed]}
          onPress={() => onBook(trainer)}
        >
          <Ionicons name="flash" size={15} color="#fff" style={{ marginRight: 4 }} />
          <Text style={styles.bookBtnText}>Book session</Text>
        </Pressable>
        {trainer?.is_online && (
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
  const [search, setSearch] = useState("");
  const [wizardTrainer, setWizardTrainer] = useState<Record<string, unknown> | null>(null);
  const navigation = useNavigation<NativeStackNavigationProp<MenuStackParamList>>();

  const trimmed = search.trim();
  /** Backend rejects empty or numeric-only `search` — see `TraineeService.getSlotsOfAllTrainers`. */
  const searchOk = trimmed.length >= 2 && !/^\d+$/.test(trimmed);

  const { data: onlineRaw = [], isLoading: onlineLoading, isRefetching: onlineRefetching, refetch: refetchOnline } =
    useQuery({
      queryKey: ["bookExpert", "online"],
      queryFn: fetchOnlineUsers,
      staleTime: 30_000,
      refetchInterval: 30_000,
    });

  const onlineTrainers = useMemo(
    () => onlineRaw.map((t: any) => ({ ...t, is_online: true })),
    [onlineRaw]
  );

  const {
    data: searchRows = [],
    isLoading: searchLoading,
    isRefetching: searchRefetching,
    refetch: refetchSearch,
  } = useQuery({
    queryKey: ["trainersWithSlots", trimmed],
    queryFn: () => fetchTrainersWithSlots({ search: trimmed }),
    enabled: searchOk,
    staleTime: 60_000,
  });

  const mergedRows = useMemo(() => {
    const onlineIds = new Set(onlineTrainers.map((t: any) => String(t._id)));
    if (!searchOk) {
      return onlineTrainers;
    }
    const map = new Map<string, any>();
    for (const t of onlineTrainers) {
      map.set(String(t._id), { ...t, is_online: true });
    }
    for (const t of searchRows) {
      const id = String(t._id);
      const prev = map.get(id);
      map.set(id, {
        ...t,
        is_online: prev?.is_online ?? onlineIds.has(id),
      });
    }
    return Array.from(map.values());
  }, [onlineTrainers, searchRows, searchOk]);

  const loading = onlineLoading || (searchOk && searchLoading);
  const refreshing = onlineRefetching || (searchOk && searchRefetching);

  const onRefresh = () => {
    void refetchOnline();
    if (searchOk) void refetchSearch();
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

      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Book a coach</Text>
        <Text style={styles.heroSub}>
          Coaches who are online now appear below. Search by name or category (at least 2 characters) to see trainers
          with published slots.
        </Text>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search trainers…"
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          autoCorrect={false}
        />
        {!!search && (
          <Pressable onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color="#9ca3af" />
          </Pressable>
        )}
      </View>

      {!searchOk && trimmed.length > 0 && trimmed.length < 2 && (
        <Text style={styles.searchHint}>Enter at least 2 characters to search the full directory.</Text>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={NAVY} />
          <Text style={styles.loadingText}>Loading trainers…</Text>
        </View>
      ) : (
        <FlatList
          data={mergedRows}
          keyExtractor={(item, i) => item?._id ?? String(i)}
          renderItem={({ item }) => <TrainerCard trainer={item} onBook={handleBook} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={NAVY} />
          }
          ListHeaderComponent={
            !searchOk ? (
              <View style={styles.listBanner}>
                <Ionicons name="radio-button-on" size={16} color="#16a34a" />
                <Text style={styles.listBannerText}>Online now — tap Book session to start</Text>
              </View>
            ) : (
              <View style={styles.listBanner}>
                <Ionicons name="funnel-outline" size={16} color={NAVY} />
                <Text style={styles.listBannerText}>Results for &quot;{trimmed}&quot;</Text>
              </View>
            )
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyTitle}>
                {searchOk ? "No trainers match that search" : "No coaches online right now"}
              </Text>
              <Text style={styles.emptyBody}>
                {searchOk
                  ? "Try another name or category, or pull to refresh."
                  : "Try a search (2+ letters), check back soon, or use Instant booking from the home hub."}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f6f7fb" },
  hero: {
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.sm,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  heroTitle: { fontSize: 20, fontWeight: "800", color: colors.brandNavy },
  heroSub: { fontSize: 13, color: colors.textMuted, marginTop: 6, lineHeight: 18 },
  searchHint: {
    fontSize: 12,
    color: "#92400e",
    paddingHorizontal: space.md,
    paddingVertical: 6,
    backgroundColor: "#fffbeb",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.sm },
  loadingText: { fontSize: 14, color: "#6b7280" },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: space.md,
    paddingVertical: 10,
    gap: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    paddingVertical: 0,
  },

  list: { padding: space.md, gap: space.sm, paddingBottom: space.xl },
  listBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: space.sm,
    paddingVertical: 8,
  },
  listBannerText: { fontSize: 13, fontWeight: "600", color: "#374151", flex: 1 },

  card: {
    backgroundColor: "#fff",
    borderRadius: radii.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardRow: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  cardInfo: { flex: 1 },
  trainerName: { fontSize: 16, fontWeight: "700", color: "#111827" },
  trainerCat: { fontSize: 13, color: "#6b7280", marginTop: 3, lineHeight: 18 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4 },
  ratingText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  slotsText: { fontSize: 12, color: "#16a34a", marginTop: 3, fontWeight: "500" },

  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: space.md,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#f3f4f6",
  },
  bookBtn: {
    backgroundColor: NAVY,
    borderRadius: radii.sm,
    paddingHorizontal: space.md,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
  },
  bookBtnPressed: { opacity: 0.75 },
  bookBtnText: { fontSize: 14, color: "#fff", fontWeight: "600" },

  onlineBadge: { flexDirection: "row", alignItems: "center", gap: 5 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#16a34a" },
  onlineText: { fontSize: 12, color: "#16a34a", fontWeight: "600" },

  avatarFallback: { backgroundColor: NAVY, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: "#fff", fontWeight: "700" },

  empty: { alignItems: "center", paddingVertical: space.xl * 2, gap: space.sm },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#374151" },
  emptyBody: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: space.lg,
  },
});
