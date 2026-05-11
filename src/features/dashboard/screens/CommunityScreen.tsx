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
import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";

const NAVY = "#000080";

async function fetchCommunityUsers(): Promise<any[]> {
  const res = await apiClient.get(API_ROUTES.user.getAllUsers);
  return res.data?.result ?? res.data ?? [];
}

function Avatar({ uri, name, size = 48 }: { uri?: string; name?: string; size?: number }) {
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

function MemberCard({ user }: { user: any }) {
  const name = user?.fullname || user?.fullName || "Member";
  const role = user?.account_type || user?.accountType || "";
  return (
    <View style={styles.card}>
      <Avatar uri={user?.profile_picture} name={name} size={52} />
      <View style={styles.cardInfo}>
        <Text style={styles.memberName}>{name}</Text>
        {!!role && (
          <View style={[styles.roleBadge, role === "Trainer" ? styles.trainerBadge : styles.traineeBadge]}>
            <Text style={styles.roleText}>{role}</Text>
          </View>
        )}
      </View>
      {user?.is_online && <View style={styles.onlineDot} />}
    </View>
  );
}

export function CommunityScreen() {
  const { data: members = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["communityUsers"],
    queryFn: fetchCommunityUsers,
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
      data={members}
      keyExtractor={(item, i) => item?._id ?? String(i)}
      renderItem={({ item }) => <MemberCard user={item} />}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={NAVY} />
      }
      ListHeaderComponent={
        <View style={styles.headerCard}>
          <Ionicons name="globe-outline" size={28} color={NAVY} />
          <Text style={styles.headerText}>Your NetQwix Community</Text>
          <Text style={styles.headerSub}>Connect with trainers and trainees in your network.</Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={48} color="#d1d5db" />
          <Text style={styles.emptyTitle}>No community members yet</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: space.md, gap: space.sm, paddingBottom: space.xl },

  headerCard: {
    backgroundColor: "#f0f4ff",
    borderRadius: radii.md,
    padding: space.lg,
    alignItems: "center",
    gap: space.xs,
    marginBottom: space.md,
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  headerText: { fontSize: 16, fontWeight: "700", color: NAVY },
  headerSub: { fontSize: 13, color: "#6b7280", textAlign: "center" },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: radii.md,
    padding: space.md,
    gap: space.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cardInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  roleBadge: { alignSelf: "flex-start", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  trainerBadge: { backgroundColor: "#dbeafe" },
  traineeBadge: { backgroundColor: "#dcfce7" },
  roleText: { fontSize: 11, fontWeight: "600", color: "#374151" },
  onlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#16a34a" },

  avatarFallback: { backgroundColor: NAVY, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: "#fff", fontWeight: "700" },

  empty: { alignItems: "center", paddingVertical: space.xl * 2, gap: space.sm },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#374151" },
});
