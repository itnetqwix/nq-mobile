import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { apiClient } from "../../../api/client";
import { Button, EmptyState, Skeleton } from "../../../components/ui";
import { API_ROUTES } from "../../../config/apiRoutes";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { queryKeys } from "../../../lib/queryKeys";
import { colors, radii, space, typography } from "../../../theme";
import { ClipUploadModal } from "../../dashboard/components/locker/ClipUploadModal";
import { updatePerFriendContentSettings } from "../../settings/api/privacyApi";
import { useOnlinePresence } from "../../socket/useOnlinePresence";
import { useAppTranslation } from "../../../i18n/useAppTranslation";

type FriendDetailProps = {
  friend: any;
  onBack: () => void;
};

function unwrap<T>(res: { data: any }): T {
  return (res.data?.data ?? res.data) as T;
}

function friendUser(row: any) {
  return row?.receiverId ?? row?.senderId ?? row;
}

function Avatar({ uri, name }: { uri?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const url = getS3ImageUrl(uri);
  if (!url || failed) {
    return (
      <View style={styles.avatarFallback}>
        <Text style={styles.avatarInitial}>{name[0]?.toUpperCase() ?? "?"}</Text>
      </View>
    );
  }
  return <Image source={{ uri: url }} style={styles.avatar} onError={() => setFailed(true)} />;
}

export function FriendDetailScreen({ friend, onBack }: FriendDetailProps) {
  const { t } = useAppTranslation();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { isOnline } = useOnlinePresence();
  const user = friendUser(friend);
  const friendId = String(user?._id ?? "");
  const name = user?.fullname || user?.fullName || t("friends.friendDefault");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const summaryQ = useQuery({
    queryKey: queryKeys.friends.content(friendId),
    queryFn: async () => unwrap<any>(await apiClient.get(API_ROUTES.user.friendContent(friendId))),
    enabled: !!friendId,
  });
  const clipsQ = useQuery({
    queryKey: queryKeys.friends.clips(friendId),
    queryFn: async () => unwrap<any[]>(await apiClient.get(API_ROUTES.user.friendClips(friendId))),
    enabled: !!friendId && summaryQ.data?.access?.canViewClips === true,
  });
  const plansQ = useQuery({
    queryKey: queryKeys.friends.gamePlans(friendId),
    queryFn: async () => unwrap<any[]>(await apiClient.get(API_ROUTES.user.friendGamePlans(friendId))),
    enabled: !!friendId && summaryQ.data?.access?.canViewGamePlans !== false,
  });

  const clips = useMemo(
    () =>
      (clipsQ.data ?? []).flatMap((category: any) =>
        (category.subcategories ?? []).flatMap((sub: any) =>
          (sub.clips ?? []).map((clip: any) => ({
            ...clip,
            categoryName: category.categoryName,
            subcategoryName: sub.subcategoryName,
          }))
        )
      ),
    [clipsQ.data]
  );
  const plans = useMemo(
    () =>
      (plansQ.data ?? []).flatMap((group: any) =>
        (group.report ?? []).map((item: any) => ({ ...item, groupDate: group._id }))
      ),
    [plansQ.data]
  );

  const override = summaryQ.data?.settings?.friendOverride ?? {};
  const canUpload = summaryQ.data?.access?.canUpload === true;

  const toggleOverride = async (key: "allow_view_clips" | "allow_upload", value: boolean) => {
    setSavingSettings(true);
    try {
      await updatePerFriendContentSettings(friendId, { [key]: value });
      await queryClient.invalidateQueries({ queryKey: queryKeys.friends.content(friendId) });
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.response?.data?.message ?? t("friends.privacy.saveFailed"));
    } finally {
      setSavingSettings(false);
    }
  };

  const openCaptured = () => {
    navigation.navigate("Capture", {
      screen: "CapturedLibrary",
      params: { uploadForFriend: { id: friendId, name } },
    });
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.brandNavy} />
        </Pressable>
        <Avatar uri={user?.profile_picture} name={name} />
        <View style={styles.headerText}>
          <Text style={styles.title}>{name}</Text>
          <Text style={styles.subtitle}>
            {isOnline(friendId) || user?.is_online
              ? t("discoverHome.onlineStatusOnline")
              : t("discoverHome.onlineStatusOffline")}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {summaryQ.isLoading ? (
          <Skeleton width="100%" height={120} radius={radii.lg} />
        ) : (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t("friends.detail.sharingWithYou")}</Text>
            <View style={styles.statsRow}>
              <Text style={styles.stat}>{t("friends.detail.clipCount", { count: summaryQ.data?.counts?.clips ?? 0 })}</Text>
              <Text style={styles.stat}>{t("friends.detail.gamePlanCount", { count: summaryQ.data?.counts?.gamePlans ?? 0 })}</Text>
            </View>
            {summaryQ.data?.access?.hasSessionGrant ? (
              <Text style={styles.banner}>{t("friends.detail.sessionGrantBanner")}</Text>
            ) : null}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("friends.detail.uploadTitle", { name })}</Text>
          <View style={styles.actions}>
            <Button
              label={t("friends.uploadForFriend.fromCaptured")}
              onPress={openCaptured}
              disabled={!canUpload}
              fullWidth={false}
            />
            <Button
              label={t("friends.uploadForFriend.fromGallery")}
              onPress={() => setGalleryOpen(true)}
              disabled={!canUpload}
              variant="secondary"
              fullWidth={false}
            />
          </View>
          {!canUpload ? <Text style={styles.muted}>{summaryQ.data?.access?.uploadMessage}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("friends.privacy.perFriendTitle")}</Text>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleText}>{t("friends.privacy.allowThisFriendView")}</Text>
            <Switch
              value={override.allow_view_clips !== false}
              disabled={savingSettings}
              onValueChange={(value) => toggleOverride("allow_view_clips", value)}
            />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleText}>{t("friends.privacy.allowThisFriendUpload")}</Text>
            <Switch
              value={override.allow_upload !== false}
              disabled={savingSettings}
              onValueChange={(value) => toggleOverride("allow_upload", value)}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t("friends.detail.clips")}</Text>
        {clipsQ.isLoading ? <ActivityIndicator /> : null}
        {!summaryQ.data?.access?.canViewClips ? (
          <EmptyState
            icon="lock-closed-outline"
            title={t("friends.detail.clipsLockedTitle")}
            description={summaryQ.data?.access?.clipsMessage ?? t("friends.detail.clipsLockedBody")}
          />
        ) : clips.length === 0 && !clipsQ.isLoading ? (
          <EmptyState
            icon="videocam-outline"
            title={t("friends.detail.noClips")}
            description={t("friends.detail.noClipsBody")}
          />
        ) : (
          clips.slice(0, 12).map((clip) => (
            <View key={String(clip._id)} style={styles.mediaRow}>
              <Image source={{ uri: getS3ImageUrl(clip.thumbnail) }} style={styles.thumb} />
              <View style={styles.mediaText}>
                <Text style={styles.mediaTitle} numberOfLines={1}>{clip.title}</Text>
                <Text style={styles.muted} numberOfLines={1}>
                  {clip.categoryName} • {clip.subcategoryName}
                </Text>
              </View>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>{t("friends.detail.gamePlans")}</Text>
        {plansQ.isLoading ? <ActivityIndicator /> : null}
        {plans.length === 0 && !plansQ.isLoading ? (
          <EmptyState
            icon="document-text-outline"
            title={t("friends.detail.noGamePlans")}
            description={t("friends.detail.noGamePlansBody")}
          />
        ) : (
          plans.slice(0, 12).map((plan) => (
            <View key={String(plan._id)} style={styles.mediaRow}>
              <View style={styles.planIcon}>
                <Ionicons name="document-text-outline" size={22} color={colors.brandNavy} />
              </View>
              <View style={styles.mediaText}>
                <Text style={styles.mediaTitle} numberOfLines={1}>{plan.title || t("gamePlans.planDefault")}</Text>
                <Text style={styles.muted} numberOfLines={1}>{plan.description || t("friends.detail.publishedPlan")}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <ClipUploadModal
        visible={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onUploaded={() => {
          setGalleryOpen(false);
          queryClient.invalidateQueries({ queryKey: queryKeys.friends.content(friendId) });
        }}
        uploadForFriend={{ id: friendId, name }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: space.md,
    gap: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandSubtle,
  },
  avatar: { width: 54, height: 54, borderRadius: 27 },
  avatarFallback: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.brandNavy,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { color: colors.brandTextOn, fontWeight: "700", fontSize: 22 },
  headerText: { flex: 1 },
  title: { ...typography.titleLg, color: colors.text, fontWeight: "700" },
  subtitle: { ...typography.caption, color: colors.textMuted },
  content: { padding: space.md, gap: space.md, paddingBottom: space.xl },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    gap: space.sm,
  },
  sectionTitle: { ...typography.subtitle, color: colors.text, fontWeight: "700" },
  statsRow: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
  stat: { ...typography.caption, color: colors.brandNavy, fontWeight: "700" },
  banner: { ...typography.caption, color: colors.success, fontWeight: "700" },
  actions: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
  muted: { ...typography.caption, color: colors.textMuted },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  toggleText: { ...typography.body, color: colors.text, flex: 1 },
  mediaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.sm,
  },
  thumb: { width: 72, height: 52, borderRadius: radii.sm, backgroundColor: colors.border },
  planIcon: {
    width: 72,
    height: 52,
    borderRadius: radii.sm,
    backgroundColor: colors.brandSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  mediaText: { flex: 1, minWidth: 0 },
  mediaTitle: { ...typography.body, color: colors.text, fontWeight: "700" },
});
