import React, { useState } from "react";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, space } from "../../../theme/tokens";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { fetchTrainersWithSlots } from "../../home/api/homeApi";

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
          {!!cats && <Text style={styles.trainerCat} numberOfLines={2}>{cats}</Text>}
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
          <Text style={styles.bookBtnText}>Book Session</Text>
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

export function BookExpertScreen() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: trainers = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["trainersWithSlots", search],
    queryFn: () => fetchTrainersWithSlots(search ? { search } : undefined),
    staleTime: 60_000,
  });

  const handleBook = (trainer: any) => {
    // Navigate to booking flow (future implementation)
  };

  return (
    <View style={styles.root}>
      {/* Search bar — matches website's book-lesson search */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search trainers by name or category..."
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {!!search && (
          <Pressable onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color="#9ca3af" />
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={NAVY} />
          <Text style={styles.loadingText}>Finding available trainers...</Text>
        </View>
      ) : (
        <FlatList
          data={trainers}
          keyExtractor={(item, i) => item?._id ?? String(i)}
          renderItem={({ item }) => (
            <TrainerCard trainer={item} onBook={handleBook} />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={NAVY} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyTitle}>No trainers found</Text>
              <Text style={styles.emptyBody}>
                {search
                  ? `No results for "${search}". Try a different search.`
                  : "No trainers are currently available. Check back soon."}
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
  emptyBody: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20, paddingHorizontal: space.lg },
});
