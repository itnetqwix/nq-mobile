import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../auth/context/AuthContext";
import { AccountType } from "../../../constants/accountType";
import { radii, space } from "../../../theme/tokens";
import { fetchTrainerSlots, fetchScheduledMeetings } from "../../home/api/homeApi";
import { UpcomingSessionsScreen } from "../../sessions/screens/UpcomingSessionsScreen";
import type { MainTabScreenProps } from "../../../navigation/types";

const NAVY = "#000080";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function SlotCard({ slot }: { slot: any }) {
  const day = slot?.day_of_week != null ? DAYS[slot.day_of_week] ?? slot.day_of_week : slot?.day ?? "";
  const start = slot?.start_time ?? slot?.startTime ?? "";
  const end = slot?.end_time ?? slot?.endTime ?? "";
  const isAvailable = slot?.is_available ?? slot?.isAvailable ?? true;

  return (
    <View style={[styles.slotCard, !isAvailable && styles.slotCardUnavailable]}>
      <View style={styles.slotLeft}>
        <Text style={styles.slotDay}>{day}</Text>
        <Text style={styles.slotTime}>
          {start} – {end}
        </Text>
      </View>
      <View style={[styles.slotBadge, isAvailable ? styles.slotAvail : styles.slotBooked]}>
        <Text style={[styles.slotBadgeText, isAvailable ? styles.slotAvailText : styles.slotBookedText]}>
          {isAvailable ? "Available" : "Booked"}
        </Text>
      </View>
    </View>
  );
}

function TrainerSchedule() {
  const { data: slots = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["trainerSlots"],
    queryFn: fetchTrainerSlots,
    staleTime: 60_000,
  });

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Schedule</Text>
        <Pressable style={styles.addBtn}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Add Slot</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={NAVY} />
        </View>
      ) : (
        <FlatList
          data={slots}
          keyExtractor={(item, i) => item?._id ?? String(i)}
          renderItem={({ item }) => <SlotCard slot={item} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={NAVY} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyTitle}>No schedule set up yet</Text>
              <Text style={styles.emptyBody}>
                Add your available time slots so trainees can book sessions with you.
              </Text>
              <Pressable style={styles.addBtnLarge}>
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={styles.addBtnText}>Add Your First Slot</Text>
              </Pressable>
            </View>
          }
        />
      )}
    </View>
  );
}

export function ScheduleScreen(_props: MainTabScreenProps<"Schedule">) {
  const { accountType } = useAuth();
  // Trainers manage their own slots; trainees see upcoming sessions
  if (accountType === AccountType.TRAINER) {
    return <TrainerSchedule />;
  }
  return <UpcomingSessionsScreen />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f6f7fb" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: NAVY },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: NAVY,
    borderRadius: radii.sm,
    paddingHorizontal: space.md,
    paddingVertical: 8,
  },
  addBtnLarge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: NAVY,
    borderRadius: radii.sm,
    paddingHorizontal: space.lg,
    paddingVertical: 12,
    marginTop: space.md,
  },
  addBtnText: { fontSize: 13, color: "#fff", fontWeight: "600" },

  list: { padding: space.md, gap: space.sm, paddingBottom: space.xl },

  slotCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: radii.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  slotCardUnavailable: { opacity: 0.65 },
  slotLeft: { gap: 2 },
  slotDay: { fontSize: 15, fontWeight: "700", color: "#111827" },
  slotTime: { fontSize: 13, color: "#6b7280" },

  slotBadge: { borderRadius: 4, paddingHorizontal: 10, paddingVertical: 4 },
  slotAvail: { backgroundColor: "#dcfce7" },
  slotBooked: { backgroundColor: "#dbeafe" },
  slotBadgeText: { fontSize: 12, fontWeight: "700" },
  slotAvailText: { color: "#15803d" },
  slotBookedText: { color: "#1d4ed8" },

  empty: { alignItems: "center", paddingVertical: space.xl * 2, gap: space.sm },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#374151" },
  emptyBody: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20, paddingHorizontal: space.lg },
});
