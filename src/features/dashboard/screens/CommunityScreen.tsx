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
import { EmptyState, ImageWithSkeleton, Pill, Skeleton } from "../../../components/ui";
import { colors, radii, space, typography } from "../../../theme";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { useHorizontalGutter } from "../../../lib/layout/useHorizontalGutter";
import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";

async function fetchCommunityUsers(): Promise<any[]> {
  const res = await apiClient.get(API_ROUTES.user.getAllUsers);
  return res.data?.result ?? res.data ?? [];
}

function Avatar({ uri, name, size = 48 }: { uri?: string; name?: string; size?: number }) {
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

function MemberCard({ user }: { user: any }) {
  const name = user?.fullname || user?.fullName || "Member";
  const role = user?.account_type || user?.accountType || "";
  return (
    <View style={styles.card}>
      <Avatar uri={user?.profile_picture} name={name} size={52} />
      <View style={styles.cardInfo}>
        <Text style={styles.memberName}>{name}</Text>
        {!!role ? (
          <Pill
            label={role}
            tone={role === "Trainer" ? "info" : "success"}
            style={{ marginTop: 4 }}
          />
        ) : null}
      </View>
      {user?.is_online && <View style={styles.onlineDot} />}
    </View>
  );
}

export function CommunityScreen() {
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
  const { data: members = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["communityUsers"],
    queryFn: fetchCommunityUsers,
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
              <Skeleton width="70%" height={10} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <FlatList
      data={members}
      keyExtractor={(item, i) => item?._id ?? String(i)}
      renderItem={({ item }) => <MemberCard user={item} />}
      contentContainerStyle={listPad}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandNavy} />
      }
      ListHeaderComponent={
        <View style={styles.headerCard}>
          <Ionicons name="globe-outline" size={28} color={colors.brandNavy} />
          <Text style={styles.headerText}>Your NetQwix Community</Text>
          <Text style={styles.headerSub}>Connect with trainers and trainees in your network.</Text>
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          icon="people-outline"
          title="No community members yet"
          description="Members will appear here as your network grows."
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerCard: {
    backgroundColor: colors.brandSubtle,
    borderRadius: radii.md,
    padding: space.lg,
    alignItems: "center",
    gap: space.xs,
    marginBottom: space.md,
    borderWidth: 1,
    borderColor: colors.brandAccentSubtle,
  },
  headerText: { ...typography.titleSm, color: colors.brandNavy },
  headerSub: { ...typography.bodySm, color: colors.textMuted, textAlign: "center" },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: space.md,
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardInfo: { flex: 1 },
  memberName: { ...typography.subtitle, color: colors.text },
  onlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success },

  avatarFallback: { backgroundColor: colors.brandNavy, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: colors.brandTextOn, fontWeight: "700" },
});
