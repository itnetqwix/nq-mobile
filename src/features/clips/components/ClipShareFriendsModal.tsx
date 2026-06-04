import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ImageWithSkeleton } from "../../../components/ui";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { queryKeys } from "../../../lib/queryKeys";
import { fetchFriends } from "../../home/api/homeApi";
import { postClipShareRequests } from "../api/clipsShareApi";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { useAuth } from "../../auth/context/AuthContext";
import { resolveFriendUser } from "../../friends/lib/resolveFriendUser";

type FriendRow = {
  id: string;
  name: string;
  avatar?: string;
};

type Props = {
  visible: boolean;
  clipIds: string[];
  onClose: () => void;
  onSent: () => void;
};

export function ClipShareFriendsModal({ visible, clipIds, onClose, onSent }: Props) {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const styles = useStyles();
  const { user } = useAuth();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const currentUserId = String((user as any)?._id ?? (user as any)?.id ?? "");

  const { data: friendsRaw = [], isLoading } = useQuery({
    queryKey: queryKeys.friends.forClipShare,
    queryFn: fetchFriends,
    enabled: visible,
    staleTime: 60_000,
  });

  const friends: FriendRow[] = useMemo(() => {
    return (friendsRaw as any[])
      .map((f) => {
        const friend = resolveFriendUser(f, currentUserId);
        if (!friend) return null;
        return {
          id: friend.id,
          name: friend.name || t("locker.friendDefault"),
          avatar: friend.avatar,
        };
      })
      .filter(Boolean) as FriendRow[];
  }, [currentUserId, friendsRaw, t]);

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected]
  );

  const toggle = useCallback((id: string) => {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }, []);

  const send = async () => {
    if (clipIds.length === 0) {
      Alert.alert(t("locker.shareSelectClipsTitle"), t("locker.shareSelectClipsBody"));
      return;
    }
    if (selectedIds.length === 0) {
      Alert.alert(t("locker.shareSelectFriendsTitle"), t("locker.shareSelectFriendsBody"));
      return;
    }
    setBusy(true);
    try {
      const result = await postClipShareRequests({
        clipIds,
        friendIds: selectedIds,
      });
      const skipped = result.skipped ?? [];
      const delivered = result.deliveredByFriend ?? {};
      if (skipped.length && !Object.keys(delivered).length) {
        Alert.alert(t("locker.shareFailedTitle"), skipped[0]?.reason ?? t("locker.shareFailedBody"));
        return;
      }
      setSelected({});
      onSent();
      onClose();
      Alert.alert(
        t("locker.shareSentTitle"),
        result.message ?? t("locker.shareSentBody", { count: clipIds.length })
      );
    } catch (e) {
      Alert.alert(t("locker.shareFailedTitle"), getApiErrorMessage(e, t("locker.shareFailedBody")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, space.md) }]}>
        <Text style={styles.title}>{t("locker.shareToFriendsTitle")}</Text>
        <Pressable onPress={onClose} hitSlop={12} disabled={busy}>
          <Ionicons name="close" size={26} color={c.text} />
        </Pressable>
      </View>
      <Text style={styles.lead}>
        {t("locker.shareToFriendsLead", { count: clipIds.length })}
      </Text>
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={c.brandNavy} />
      ) : friends.length === 0 ? (
        <Text style={styles.muted}>{t("locker.noFriendsForShare")}</Text>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
          {friends.map((f) => {
            const on = !!selected[f.id];
            return (
              <Pressable
                key={f.id}
                style={[styles.row, on && styles.rowOn]}
                onPress={() => toggle(f.id)}
                disabled={busy}
              >
                {f.avatar ? (
                  <ImageWithSkeleton
                    uri={getS3ImageUrl(f.avatar)}
                    width={40}
                    height={40}
                    borderRadius={20}
                  />
                ) : (
                  <View style={styles.avatarPh}>
                    <Ionicons name="person" size={20} color={c.textMuted} />
                  </View>
                )}
                <Text style={styles.name} numberOfLines={1}>
                  {f.name}
                </Text>
                <Ionicons
                  name={on ? "checkmark-circle" : "ellipse-outline"}
                  size={22}
                  color={on ? c.brandNavy : c.textMuted}
                />
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
        <Pressable
          style={[styles.sendBtn, (busy || selectedIds.length === 0) && { opacity: 0.5 }]}
          onPress={send}
          disabled={busy || selectedIds.length === 0}
        >
          {busy ? (
            <ActivityIndicator color={c.brandTextOn} />
          ) : (
            <Text style={styles.sendText}>{t("locker.shareToFriends")}</Text>
          )}
        </Pressable>
      </View>
    </Modal>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: space.md,
        paddingBottom: space.sm,
      },
      title: { ...typography.titleMd, color: palette.text, flex: 1 },
      lead: {
        ...typography.bodySm,
        color: palette.textMuted,
        paddingHorizontal: space.md,
        marginBottom: space.md,
      },
      muted: { ...typography.bodySm, color: palette.textMuted, padding: space.md },
      row: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        paddingHorizontal: space.md,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: palette.border,
      },
      rowOn: { backgroundColor: palette.brandSubtle },
      avatarPh: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: palette.surfaceMuted,
        alignItems: "center",
        justifyContent: "center",
      },
      name: { flex: 1, ...typography.bodyMd, color: palette.text },
      footer: {
        paddingHorizontal: space.md,
        paddingTop: space.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: palette.border,
      },
      sendBtn: {
        backgroundColor: palette.brandNavy,
        borderRadius: radii.md,
        paddingVertical: 14,
        alignItems: "center",
      },
      sendText: { color: palette.brandTextOn, fontWeight: "700", fontSize: 16 },
    })
  );
}
