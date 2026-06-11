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
import { FriendRowSkeleton, ImageWithSkeleton, SkeletonGroup } from "../../../components/ui";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { queryKeys } from "../../../lib/queryKeys";
import { fetchFriends } from "../../home/api/homeApi";
import { postClipShareRequests } from "../api/clipsShareApi";
import { shareClipExternally } from "../lib/shareClipExternally";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { useAppTranslation } from "../../../i18n/useAppTranslation";

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

type ShareTab = "friends" | "link";

export function ClipShareFriendsModal({ visible, clipIds, onClose, onSent }: Props) {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const styles = useStyles();

  const [tab, setTab] = useState<ShareTab>("friends");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const { data: friendsRaw = [], isLoading } = useQuery({
    queryKey: queryKeys.friends.forClipShare,
    queryFn: fetchFriends,
    enabled: visible,
    staleTime: 60_000,
  });

  const friends: FriendRow[] = useMemo(() => {
    return (friendsRaw as any[])
      .map((f) => {
        const id = String(f._id ?? f.id ?? f.user_id ?? "");
        if (!id) return null;
        return {
          id,
          name: f.fullname ?? f.full_name ?? f.name ?? f.email ?? t("locker.friendDefault"),
          avatar: f.profile_picture ?? f.avatar,
        };
      })
      .filter(Boolean) as FriendRow[];
  }, [friendsRaw, t]);

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected]
  );

  const toggle = useCallback((id: string) => {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }, []);

  const sendToFriends = async () => {
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
      const result = await postClipShareRequests({ clipIds, friendIds: selectedIds });
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

  const handleExternalShare = async () => {
    if (clipIds.length === 0) return;
    const firstClipId = clipIds[0];
    await shareClipExternally({
      title: t("locker.sharedClipTitle", { defaultValue: "Check out this clip on Netqwix!" }),
      clipId: firstClipId,
      t,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, space.md) }]}>
        <Text style={styles.title}>
          {t("locker.shareClipTitle", { defaultValue: "Share clip" })}
        </Text>
        <Pressable onPress={onClose} hitSlop={12} disabled={busy}>
          <Ionicons name="close" size={26} color={c.text} />
        </Pressable>
      </View>

      {/* Clip count label */}
      <Text style={styles.lead}>
        {t("locker.shareToFriendsLead", { count: clipIds.length })}
      </Text>

      {/* Tab bar */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, tab === "friends" && styles.tabActive]}
          onPress={() => setTab("friends")}
        >
          <Ionicons
            name="people-outline"
            size={16}
            color={tab === "friends" ? c.brandNavy : c.textMuted}
          />
          <Text style={[styles.tabLabel, tab === "friends" && styles.tabLabelActive]}>
            {t("locker.shareTabFriends", { defaultValue: "Netqwix friends" })}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === "link" && styles.tabActive]}
          onPress={() => setTab("link")}
        >
          <Ionicons
            name="share-social-outline"
            size={16}
            color={tab === "link" ? c.brandNavy : c.textMuted}
          />
          <Text style={[styles.tabLabel, tab === "link" && styles.tabLabelActive]}>
            {t("locker.shareTabLink", { defaultValue: "Share link" })}
          </Text>
        </Pressable>
      </View>

      {/* ── Friends tab ── */}
      {tab === "friends" && (
        <>
          {isLoading ? (
            <SkeletonGroup
              count={5}
              gap={0}
              renderRow={() => <FriendRowSkeleton />}
              style={{ marginTop: space.sm }}
            />
          ) : friends.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="people-outline" size={40} color={c.textMuted} />
              <Text style={styles.muted}>{t("locker.noFriendsForShare")}</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
              {friends.map((f) => {
                const on = !!selected[f.id];
                return (
                  <Pressable
                    key={f.id}
                    style={[styles.friendRow, on && styles.friendRowOn]}
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
                    <Text style={styles.friendName} numberOfLines={1}>{f.name}</Text>
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

          {/* Footer */}
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
            <Pressable
              style={[styles.primaryBtn, (busy || selectedIds.length === 0) && { opacity: 0.5 }]}
              onPress={sendToFriends}
              disabled={busy || selectedIds.length === 0}
            >
              {busy ? (
                <ActivityIndicator color={c.brandTextOn} />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {t("locker.shareToFriends", {
                    defaultValue: selectedIds.length > 0
                      ? `Send to ${selectedIds.length} friend${selectedIds.length > 1 ? "s" : ""}`
                      : "Select friends",
                  })}
                </Text>
              )}
            </Pressable>
          </View>
        </>
      )}

      {/* ── Link tab ── */}
      {tab === "link" && (
        <ScrollView contentContainerStyle={[styles.linkTabContent, { paddingBottom: insets.bottom + 40 }]}>
          {/* Info banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={18} color={c.brandNavy} />
            <Text style={styles.infoText}>
              {t("locker.externalShareNote", {
                defaultValue:
                  "Recipients will need a Netqwix account to view the full clip. They'll be prompted to sign up if they don't have one.",
              })}
            </Text>
          </View>

          {/* Native share button */}
          <Pressable
            style={({ pressed }) => [styles.shareOptionRow, pressed && { opacity: 0.85 }]}
            onPress={handleExternalShare}
          >
            <View style={[styles.shareOptionIcon, { backgroundColor: "#eff6ff" }]}>
              <Ionicons name="share-outline" size={22} color="#2563eb" />
            </View>
            <View style={styles.shareOptionMeta}>
              <Text style={styles.shareOptionTitle}>
                {t("locker.shareViaOtherApps", { defaultValue: "Share via other apps" })}
              </Text>
              <Text style={styles.shareOptionSub}>
                {t("locker.shareViaOtherAppsSub", { defaultValue: "WhatsApp, iMessage, email, and more" })}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
          </Pressable>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>{t("common.or", { defaultValue: "or" })}</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Send to friends shortcut */}
          <Pressable
            style={({ pressed }) => [styles.shareOptionRow, pressed && { opacity: 0.85 }]}
            onPress={() => setTab("friends")}
          >
            <View style={[styles.shareOptionIcon, { backgroundColor: "#f0fdf4" }]}>
              <Ionicons name="people-outline" size={22} color="#16a34a" />
            </View>
            <View style={styles.shareOptionMeta}>
              <Text style={styles.shareOptionTitle}>
                {t("locker.sendToNetqwixFriends", { defaultValue: "Send to Netqwix friends" })}
              </Text>
              <Text style={styles.shareOptionSub}>
                {t("locker.sendToNetqwixFriendsSub", { defaultValue: "Share directly with your connections" })}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
          </Pressable>
        </ScrollView>
      )}
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
        marginBottom: space.sm,
      },
      tabRow: {
        flexDirection: "row",
        paddingHorizontal: space.md,
        gap: space.sm,
        marginBottom: space.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: palette.border,
        paddingBottom: space.sm,
      },
      tab: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 10,
        borderRadius: radii.md,
        backgroundColor: palette.surfaceMuted,
      },
      tabActive: {
        backgroundColor: palette.brandSubtle,
      },
      tabLabel: { ...typography.label, color: palette.textMuted, fontSize: 13 },
      tabLabelActive: { color: palette.brandNavy, fontWeight: "700" },
      emptyWrap: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: space.sm,
        padding: space.xl,
        opacity: 0.7,
      },
      muted: { ...typography.bodySm, color: palette.textMuted, textAlign: "center" },
      friendRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        paddingHorizontal: space.md,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: palette.border,
      },
      friendRowOn: { backgroundColor: palette.brandSubtle },
      avatarPh: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: palette.surfaceMuted,
        alignItems: "center",
        justifyContent: "center",
      },
      friendName: { flex: 1, ...typography.bodyMd, color: palette.text },
      footer: {
        paddingHorizontal: space.md,
        paddingTop: space.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: palette.border,
      },
      primaryBtn: {
        backgroundColor: palette.brandNavy,
        borderRadius: radii.md,
        paddingVertical: 14,
        alignItems: "center",
      },
      primaryBtnText: { color: palette.brandTextOn, fontWeight: "700", fontSize: 16 },
      /* Link tab */
      linkTabContent: {
        padding: space.md,
        gap: space.md,
      },
      infoBanner: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: space.sm,
        padding: space.md,
        borderRadius: radii.lg,
        backgroundColor: palette.brandSubtle,
        borderWidth: 1,
        borderColor: palette.brandAccentSubtle,
      },
      infoText: {
        ...typography.bodySm,
        color: palette.brandNavy,
        flex: 1,
        lineHeight: 18,
      },
      shareOptionRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        padding: space.md,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surfaceElevated,
      },
      shareOptionIcon: {
        width: 48,
        height: 48,
        borderRadius: radii.md,
        alignItems: "center",
        justifyContent: "center",
      },
      shareOptionMeta: { flex: 1 },
      shareOptionTitle: { ...typography.bodyMd, fontWeight: "700", color: palette.text },
      shareOptionSub: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
      dividerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        marginVertical: space.xs,
      },
      dividerLine: {
        flex: 1,
        height: StyleSheet.hairlineWidth,
        backgroundColor: palette.border,
      },
      dividerLabel: { ...typography.caption, color: palette.textMuted },
    })
  );
}
