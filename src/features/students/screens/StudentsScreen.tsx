import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { radii, space } from "../../../theme/tokens";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { fetchRecentTrainees } from "../../home/api/homeApi";
import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";

const NAVY = "#000080";

async function fetchStudents(): Promise<any[]> {
  try {
    const res = await apiClient.get(API_ROUTES.user.getAllTrainee);
    return res.data?.result ?? res.data ?? [];
  } catch {
    return fetchRecentTrainees();
  }
}

function Avatar({ uri, name, size = 52 }: { uri?: string; name?: string; size?: number }) {
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

function StudentCard({ student }: { student: any }) {
  const name = student?.fullname || student?.fullName || "Student";
  const email = student?.email ?? "";
  const joined = student?.createdAt
    ? new Date(student.createdAt).toLocaleDateString()
    : "";

  return (
    <View style={styles.card}>
      <Avatar uri={student?.profile_picture} name={name} size={52} />
      <View style={styles.cardInfo}>
        <Text style={styles.studentName}>{name}</Text>
        {!!email && <Text style={styles.studentEmail}>{email}</Text>}
        {!!joined && (
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={12} color="#9ca3af" />
            <Text style={styles.metaText}>Joined {joined}</Text>
          </View>
        )}
      </View>
      {student?.is_online && (
        <View style={styles.onlineDot} />
      )}
    </View>
  );
}

export function StudentsScreen() {
  const { data: students = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["students"],
    queryFn: fetchStudents,
    staleTime: 120_000,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={NAVY} />
      </View>
    );
  }

  return (
    <FlatList
      data={students}
      keyExtractor={(item, i) => item?._id ?? String(i)}
      renderItem={({ item }) => <StudentCard student={item} />}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={NAVY} />
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={48} color="#d1d5db" />
          <Text style={styles.emptyTitle}>No students yet</Text>
          <Text style={styles.emptyBody}>
            Students who book sessions with you will appear here.
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: space.md, gap: space.sm, paddingBottom: space.xl },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: radii.md,
    padding: space.md,
    gap: space.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardInfo: { flex: 1 },
  studentName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  studentEmail: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  metaText: { fontSize: 12, color: "#9ca3af" },
  onlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#16a34a" },

  avatarFallback: { backgroundColor: NAVY, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: "#fff", fontWeight: "700" },

  empty: { alignItems: "center", paddingVertical: space.xl * 2, gap: space.sm },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#374151" },
  emptyBody: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20, paddingHorizontal: space.lg },
});
