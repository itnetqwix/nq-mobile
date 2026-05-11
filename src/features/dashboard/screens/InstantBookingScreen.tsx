import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { radii, space } from "../../../theme/tokens";
import { fetchOnlineUsers } from "../../home/api/homeApi";
import { useAuth } from "../../auth/context/AuthContext";
import { useInstantLesson } from "../../instant-lesson/InstantLessonContext";
import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import type { RootStackParamList } from "../../../navigation/types";

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
  const { traineeBooking, startBooking, cancelBooking, clearTraineeBooking } = useInstantLesson();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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
      const res = await apiClient.post(API_ROUTES.trainee.bookInstantMeeting, {
        coachId: trainerId,
        duration: 30,
      });
      const lessonId =
        res.data?.result?._id ?? res.data?._id ?? res.data?.lessonId;
      if (!lessonId) throw new Error("No lesson ID returned");
      const traineeId = String((user as any)?._id ?? (user as any)?.id ?? "");
      startBooking({
        lessonId,
        coachId: trainerId,
        traineeId,
        trainerName: trainer?.fullname ?? trainer?.fullName ?? "Trainer",
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

  const handleJoinLesson = () => {
    if (!traineeBooking?.lessonId) return;
    const lessonId = traineeBooking.lessonId;
    clearTraineeBooking();
    navigation.navigate("Meeting", { lessonId });
  };

  const handleCancelBooking = () => {
    Alert.alert("Cancel Request", "Cancel this lesson request?", [
      { text: "Keep Waiting", style: "cancel" },
      { text: "Cancel", style: "destructive", onPress: cancelBooking },
    ]);
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

      {/* Trainee booking state modal */}
      {!!traineeBooking && (
        <Modal visible transparent animationType="fade" statusBarTranslucent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              {traineeBooking.step === "waiting" && (
                <>
                  <ActivityIndicator size="large" color={NAVY} style={{ marginBottom: 12 }} />
                  <Text style={styles.modalTitle}>Waiting for Response</Text>
                  <Text style={styles.modalSubtitle}>
                    Requesting{" "}
                    <Text style={{ fontWeight: "700" }}>{traineeBooking.trainerName}</Text>…
                  </Text>
                  <Text style={styles.modalHint}>The trainer has 60 seconds to accept.</Text>
                  <Pressable style={styles.cancelBtn} onPress={handleCancelBooking}>
                    <Text style={styles.cancelBtnText}>Cancel Request</Text>
                  </Pressable>
                </>
              )}

              {traineeBooking.step === "accepted" && (
                <>
                  <Ionicons name="checkmark-circle" size={56} color="#16a34a" />
                  <Text style={styles.modalTitle}>Lesson Accepted!</Text>
                  <Text style={styles.modalSubtitle}>
                    {traineeBooking.trainerName} accepted your request.
                  </Text>
                  <Pressable style={styles.joinBtn} onPress={handleJoinLesson}>
                    <Ionicons name="videocam" size={18} color="#fff" />
                    <Text style={styles.joinBtnText}>Join Lesson Now</Text>
                  </Pressable>
                </>
              )}

              {(traineeBooking.step === "declined" || traineeBooking.step === "expired") && (
                <>
                  <Ionicons name="close-circle" size={56} color="#dc2626" />
                  <Text style={styles.modalTitle}>
                    {traineeBooking.step === "declined" ? "Request Declined" : "Request Expired"}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {traineeBooking.step === "declined"
                      ? "The trainer is unavailable right now."
                      : "No response was received in time."}
                  </Text>
                  <Pressable style={styles.cancelBtn} onPress={clearTraineeBooking}>
                    <Text style={styles.cancelBtnText}>OK, Got It</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </Modal>
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

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: space.md,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: space.lg,
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    gap: 12,
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#111827" },
  modalSubtitle: { fontSize: 14, color: "#6b7280", textAlign: "center" },
  modalHint: { fontSize: 12, color: "#9ca3af", textAlign: "center" },
  cancelBtn: {
    marginTop: 4,
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 24,
    width: "100%",
    alignItems: "center",
  },
  cancelBtnText: { fontSize: 15, fontWeight: "600", color: "#374151" },
  joinBtn: {
    marginTop: 4,
    backgroundColor: "#16a34a",
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "100%",
    justifyContent: "center",
  },
  joinBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
