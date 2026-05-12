import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useAuth } from "../../auth/context/AuthContext";
import { useInstantLesson } from "../../instant-lesson/InstantLessonContext";
import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { getS3ImageUrl } from "../../../lib/imageUtils";

/** Matches web + `nq-backend-main` `bookInstantMeeting` response: `{ status, data: { bookingId, booking } }`. */
function parseInstantBookingLessonId(res: any): string | undefined {
  const d = res?.data?.data ?? res?.data;
  if (!d || typeof d !== "object") return undefined;
  const bid = d.bookingId;
  if (bid != null) {
    const id = typeof bid === "object" && bid !== null ? (bid as any)._id ?? (bid as any).id : bid;
    if (id != null && id !== "") return String(id);
  }
  const booking = d.booking ?? d.result;
  const fromBooking = booking?._id ?? booking?.id;
  if (fromBooking != null && fromBooking !== "") return String(fromBooking);
  if (d._id) return String(d._id);
  return undefined;
}

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
  const { user } = useAuth();
  const { startBooking } = useInstantLesson();
  const [bookingLoading, setBookingLoading] = useState<string | null>(null);

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

  const handleBookInstant = async (trainer: any) => {
    const trainerId = trainer?._id ?? trainer?.id;
    if (!trainerId) return;
    setBookingLoading(trainerId);
    try {
      /** Same contract as `nq-backend` `bookInstantMeetingModal`: `trainer_id` + ISO `booked_date`. */
      const res = await apiClient.post(API_ROUTES.trainee.bookInstantMeeting, {
        trainer_id: trainerId,
        booked_date: new Date().toISOString(),
      });
      const lessonId = parseInstantBookingLessonId(res);
      if (!lessonId) {
        throw new Error(
          "Server did not return a booking id. Ensure the API returns `data.bookingId` after booking."
        );
      }
      const traineeId = String((user as any)?._id ?? (user as any)?.id ?? "");
      startBooking({
        lessonId,
        coachId: trainerId,
        traineeId,
        trainerName: trainer?.fullname ?? trainer?.fullName ?? "Trainer",
        durationMinutes: 30,
      });
    } catch (err: any) {
      Alert.alert(
        "Booking Failed",
        err?.response?.data?.message ?? err?.message ?? "Could not book the instant lesson."
      );
    } finally {
      setBookingLoading(null);
    }
  };

  return (
    <View style={styles.root}>
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
            const isBooking = bookingLoading === (item?._id ?? item?.id);
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
                  onPress={() => handleBookInstant(item)}
                  disabled={isBooking}
                >
                  {isBooking ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="flash" size={15} color="#fff" />
                      <Text style={styles.bookBtnText}>Book Now</Text>
                    </>
                  )}
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
