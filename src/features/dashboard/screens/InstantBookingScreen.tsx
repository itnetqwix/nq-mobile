import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { radii, space } from "../../../theme/tokens";
import { fetchOnlineUsers } from "../../home/api/homeApi";
import { InstantLessonBookingWizardModal } from "../../instant-lesson/booking-wizard";
import { getS3ImageUrl } from "../../../lib/imageUtils";

const NAVY = "#000080";

function Avatar({ uri, name, size = 56 }: { uri?: string; name?: string; size?: number }) {
  const [failed, setFailed] = React.useState(false);
  const url = getS3ImageUrl(uri);
  if (!url || failed) {
    return (
      <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={{ fontSize: size * 0.38, fontWeight: "700", color: "#fff" }}>
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

export function InstantBookingScreen() {
  const [wizardTrainer, setWizardTrainer] = useState<Record<string, unknown> | null>(null);

  const { data: onlineUsers = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["onlineUsers"],
    queryFn: fetchOnlineUsers,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const onlineTrainers = Array.isArray(onlineUsers)
    ? onlineUsers.filter((u: any) => {
        const at = String(u?.account_type ?? u?.accountType ?? "").toLowerCase();
        return at === "trainer";
      })
    : [];

  return (
    <View style={styles.root}>
      <InstantLessonBookingWizardModal
        visible={!!wizardTrainer}
        trainer={wizardTrainer}
        onDismiss={() => setWizardTrainer(null)}
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={NAVY} />
          <Text style={styles.loadingText}>Finding online trainers…</Text>
        </View>
      ) : (
        <FlatList
          data={onlineTrainers}
          keyExtractor={(item, i) => item?._id ?? String(i)}
          renderItem={({ item }) => {
            const name = item?.fullname ?? item?.fullName ?? "Trainer";
            return (
              <View style={styles.trainerCard}>
                <Avatar uri={item?.profile_picture} name={name} size={56} />
                <View style={styles.trainerInfo}>
                  <Text style={styles.trainerName}>{name}</Text>
                  <View style={styles.onlineRow}>
                    <View style={styles.onlineDot} />
                    <Text style={styles.onlineText}>Online Now</Text>
                  </View>
                  {!!item?.category && (
                    <Text style={styles.trainerCat} numberOfLines={1}>{item.category}</Text>
                  )}
                </View>
                <Pressable
                  style={({ pressed }) => [styles.bookBtn, pressed && { opacity: 0.75 }]}
                  onPress={() => setWizardTrainer(item)}
                >
                  <Ionicons name="flash" size={15} color="#fff" />
                  <Text style={styles.bookBtnText}>Book Now</Text>
                </Pressable>
              </View>
            );
          }}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={NAVY} />
          }
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Ionicons name="people" size={18} color={NAVY} />
              <Text style={styles.listHeaderText}>
                {onlineTrainers.length} trainer{onlineTrainers.length !== 1 ? "s" : ""} online
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="wifi-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyTitle}>No trainers online</Text>
              <Text style={styles.emptyBody}>
                Check back soon or book a scheduled session instead.
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
  list: { padding: space.md, gap: space.sm, paddingBottom: space.xl },
  listHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  listHeaderText: { fontSize: 13, fontWeight: "700", color: NAVY },

  trainerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: radii.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: space.md,
  },
  avatarFallback: { backgroundColor: NAVY, alignItems: "center", justifyContent: "center" },
  trainerInfo: { flex: 1 },
  trainerName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  onlineRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  onlineDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#16a34a" },
  onlineText: { fontSize: 12, color: "#16a34a", fontWeight: "600" },
  trainerCat: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  bookBtn: {
    backgroundColor: NAVY,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 84,
    justifyContent: "center",
  },
  bookBtnText: { fontSize: 13, fontWeight: "600", color: "#fff" },

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
