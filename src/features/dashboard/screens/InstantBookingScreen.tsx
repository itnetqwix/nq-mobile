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
import { Button, EmptyState, Skeleton } from "../../../components/ui";
import { colors, radii, space, typography } from "../../../theme";
import { fetchOnlineUsers } from "../../home/api/homeApi";
import { InstantLessonBookingWizardModal } from "../../instant-lesson/booking-wizard";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { useAppTranslation } from "../../../i18n/useAppTranslation";

function Avatar({ uri, name, size = 56 }: { uri?: string; name?: string; size?: number }) {
  const [failed, setFailed] = React.useState(false);
  const url = getS3ImageUrl(uri);
  if (!url || failed) {
    return (
      <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={{ fontSize: size * 0.38, fontWeight: "700", color: colors.brandTextOn }}>
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
  const { t } = useAppTranslation();
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
        <View style={styles.list}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ marginBottom: space.md }}>
              <Skeleton width="100%" height={84} radius={radii.md} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={onlineTrainers}
          keyExtractor={(item, i) => item?._id ?? String(i)}
          renderItem={({ item }) => {
            const name = item?.fullname ?? item?.fullName ?? t("instantBooking.trainerDefault");
            return (
              <View style={styles.trainerCard}>
                <Avatar uri={item?.profile_picture} name={name} size={56} />
                <View style={styles.trainerInfo}>
                  <Text style={styles.trainerName}>{name}</Text>
                  <View style={styles.onlineRow}>
                    <View style={styles.onlineDot} />
                    <Text style={styles.onlineText}>{t("instantBooking.onlineNow")}</Text>
                  </View>
                  {!!item?.category && (
                    <Text style={styles.trainerCat} numberOfLines={1}>{item.category}</Text>
                  )}
                </View>
                <Button
                  label={t("instantBooking.bookNow")}
                  leftIcon="flash"
                  size="sm"
                  fullWidth={false}
                  onPress={() => setWizardTrainer(item)}
                />
              </View>
            );
          }}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandNavy} />
          }
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Ionicons name="people" size={18} color={colors.brandNavy} />
              <Text style={styles.listHeaderText}>
                {t("instantBooking.trainersOnline", { count: onlineTrainers.length })}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="wifi-outline"
              title={t("instantBooking.emptyTitle")}
              description={t("instantBooking.emptyDescription")}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.sm },
  loadingText: { ...typography.bodyMd, color: colors.textMuted },
  list: { padding: space.md, gap: space.sm, paddingBottom: space.xl },
  listHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  listHeaderText: { ...typography.bodySm, fontWeight: "700", color: colors.brandNavy },

  trainerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: space.md,
  },
  avatarFallback: { backgroundColor: colors.brandNavy, alignItems: "center", justifyContent: "center" },
  trainerInfo: { flex: 1 },
  trainerName: { ...typography.subtitle, color: colors.text },
  onlineRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  onlineDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.success },
  onlineText: { ...typography.caption, color: colors.success, fontWeight: "600" },
  trainerCat: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
});
