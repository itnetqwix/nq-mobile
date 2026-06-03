import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { ImageWithSkeleton } from "../../../components/ui";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { getClipThumbnailUrl } from "../../../lib/clipMediaUrl";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { queryKeys } from "../../../lib/queryKeys";
import {
  fetchClipShareInbox,
  respondClipShareRequest,
  type ClipShareRequestRow,
} from "../api/clipsShareApi";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { useAppTranslation } from "../../../i18n/useAppTranslation";

type Props = {
  onAccepted?: () => void;
};

function InboxCard({
  row,
  busy,
  onAccept,
  onDecline,
}: {
  row: ClipShareRequestRow;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useCardStyles();
  const name = row.sharer?.fullname ?? t("locker.friendDefault");
  const clipCount = row.clips?.length ?? row.clip_ids?.length ?? 0;
  const preview = row.clips?.[0];

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        {row.sharer?.profile_picture ? (
          <ImageWithSkeleton
            uri={getS3ImageUrl(row.sharer.profile_picture)}
            width={36}
            height={36}
            borderRadius={18}
          />
        ) : (
          <View style={styles.avatarPh}>
            <Ionicons name="person" size={18} color={c.textMuted} />
          </View>
        )}
        <View style={styles.headText}>
          <Text style={styles.title} numberOfLines={1}>
            {t("locker.shareInboxTitle", { name })}
          </Text>
          <Text style={styles.sub}>
            {t("locker.shareInboxClips", { count: clipCount })}
          </Text>
        </View>
        {preview ? (
          <ImageWithSkeleton
            uri={getClipThumbnailUrl(preview) ?? undefined}
            width={48}
            height={48}
            borderRadius={radii.sm}
            resizeMode="cover"
          />
        ) : null}
      </View>
      <View style={styles.actions}>
        <Pressable
          style={[styles.btn, styles.decline]}
          onPress={onDecline}
          disabled={busy}
        >
          <Text style={styles.declineText}>{t("locker.shareDecline")}</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.accept]} onPress={onAccept} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={c.brandTextOn} size="small" />
          ) : (
            <Text style={styles.acceptText}>{t("locker.shareAccept")}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

export function ClipShareInboxBanner({ onAccepted }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const queryClient = useQueryClient();
  const styles = useBannerStyles();

  const inboxQ = useQuery({
    queryKey: queryKeys.locker.shareInbox,
    queryFn: fetchClipShareInbox,
    staleTime: 20_000,
  });

  const respondMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "accept" | "decline" }) =>
      respondClipShareRequest(id, action),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.locker.shareInbox });
      if (vars.action === "accept") {
        void queryClient.invalidateQueries({ queryKey: queryKeys.locker.sharedClips });
        onAccepted?.();
        Alert.alert(t("locker.shareAcceptedTitle"), t("locker.shareAcceptedBody"));
      }
    },
    onError: (e) => {
      Alert.alert(t("locker.shareFailedTitle"), getApiErrorMessage(e));
    },
  });

  const rows = inboxQ.data ?? [];
  if (rows.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.bannerHead}>
        <Ionicons name="mail-unread-outline" size={18} color={c.brandNavy} />
        <Text style={styles.bannerTitle}>{t("locker.sharePendingBanner")}</Text>
      </View>
      {rows.map((row) => (
        <InboxCard
          key={String(row._id)}
          row={row}
          busy={respondMut.isPending}
          onAccept={() => respondMut.mutate({ id: String(row._id), action: "accept" })}
          onDecline={() => respondMut.mutate({ id: String(row._id), action: "decline" })}
        />
      ))}
    </View>
  );
}

function useBannerStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      wrap: { marginBottom: space.md, gap: space.sm },
      bannerHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
      bannerTitle: { ...typography.label, color: palette.brandNavy, fontWeight: "700" },
    })
  );
}

function useCardStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      card: {
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: palette.border,
        padding: space.md,
      },
      head: { flexDirection: "row", alignItems: "center", gap: space.sm },
      avatarPh: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: palette.surfaceMuted,
        alignItems: "center",
        justifyContent: "center",
      },
      headText: { flex: 1, minWidth: 0 },
      title: { ...typography.bodyMd, fontWeight: "600", color: palette.text },
      sub: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
      actions: { flexDirection: "row", gap: space.sm, marginTop: space.md },
      btn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: radii.md,
        alignItems: "center",
      },
      decline: { backgroundColor: palette.surfaceMuted },
      declineText: { color: palette.text, fontWeight: "600" },
      accept: { backgroundColor: palette.brandNavy },
      acceptText: { color: palette.brandTextOn, fontWeight: "700" },
    })
  );
}
