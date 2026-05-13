import React, { useMemo } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState, ImageWithSkeleton, Skeleton } from "../../../components/ui";
import { colors, radii, space, typography } from "../../../theme";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { useHorizontalGutter } from "../../../lib/layout/useHorizontalGutter";
import { fetchRecentTrainees } from "../../home/api/homeApi";
import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";

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

  React.useEffect(() => {
    setFailed(false);
  }, [uri]);

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
    <ImageWithSkeleton
      uri={url}
      width={size}
      height={size}
      borderRadius={size / 2}
      resizeMode="cover"
      onLoadError={() => setFailed(true)}
      accessibilityLabel={name ? `Photo of ${name}` : "Profile photo"}
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
            <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
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
  const insets = useSafeAreaInsets();
  const gutter = useHorizontalGutter("md");
  const listPad = useMemo(
    () => ({
      ...gutter,
      paddingTop: space.md,
      paddingBottom: space.xl + insets.bottom,
      gap: space.sm,
    }),
    [gutter, insets.bottom]
  );

  const { data: students = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["students"],
    queryFn: fetchStudents,
    staleTime: 120_000,
  });

  if (isLoading) {
    return (
      <View style={listPad}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{ marginBottom: space.sm, flexDirection: "row", gap: space.sm, alignItems: "center" }}
          >
            <Skeleton width={44} height={44} radius={22} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="50%" height={12} />
              <Skeleton width="80%" height={10} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <FlatList
      data={students}
      keyExtractor={(item, i) => item?._id ?? String(i)}
      renderItem={({ item }) => <StudentCard student={item} />}
      contentContainerStyle={listPad}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandNavy} />
      }
      ListEmptyComponent={
        <EmptyState
          icon="people-outline"
          title="No students yet"
          description="Students who book sessions with you will appear here."
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: space.md,
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardInfo: { flex: 1 },
  studentName: { ...typography.subtitle, color: colors.text },
  studentEmail: { ...typography.bodySm, color: colors.textMuted, marginTop: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  metaText: { ...typography.caption, color: colors.textMuted },
  onlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success },

  avatarFallback: { backgroundColor: colors.brandNavy, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: colors.brandTextOn, fontWeight: "700" },
});
