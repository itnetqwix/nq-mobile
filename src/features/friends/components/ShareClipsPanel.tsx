import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ImageWithSkeleton, Skeleton } from "../../../components/ui";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { colors, radii, space, typography } from "../../../theme";
import { fetchFriends, postMyClipsGrouped } from "../../home/api/homeApi";
import { postClipShareRequests } from "../../clips/api/clipsShareApi";
import { queryKeys } from "../../../lib/queryKeys";
import { useAuth } from "../../auth/context/AuthContext";
import { resolveFriendUser } from "../lib/resolveFriendUser";

type ShareFriendRow = {
  _id: string;
  fullname: string;
  email: string;
  profile_picture: string;
};

/**
 * Flatten the locker's nested category → subcategory → clips response
 * into a flat list, tagging each clip with the originating category id
 * so the picker can show category badges if we ever surface them.
 *
 * The API switched from a single-level `{ _id, clips }[]` shape to a
 * nested `{ categoryId, subcategories: [{ clips }] }[]` shape (see
 * `NestedCategoryGroup`). We walk both levels here so the picker keeps
 * working with the current backend without touching the rest of the
 * component.
 */
function flattenClips(
  groups: Array<{
    categoryId?: string | null;
    subcategories?: Array<{ clips?: unknown[] }>;
  }>
): any[] {
  const out: any[] = [];
  for (const g of groups || []) {
    const categoryId = g.categoryId ?? null;
    for (const sub of g.subcategories ?? []) {
      for (const c of sub.clips ?? []) {
        out.push({ ...(c as Record<string, unknown>), _category: categoryId });
      }
    }
  }
  return out;
}

export function ShareClipsPanel() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [selectedFriends, setSelectedFriends] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const currentUserId = String((user as any)?._id ?? (user as any)?.id ?? "");

  const { data: groups = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["locker", "myClips"],
    queryFn: () => postMyClipsGrouped({}),
    staleTime: 30_000,
  });

  const friendsQ = useQuery({
    queryKey: queryKeys.friends.forClipShare,
    queryFn: fetchFriends,
    staleTime: 60_000,
  });

  const clips = useMemo(() => flattenClips(groups), [groups]);

  const toggle = useCallback((id: string) => {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }, []);

  const selectedClips = useMemo(
    () => clips.filter((c) => selected[String(c._id)]),
    [clips, selected]
  );

  /**
   * NetQwix-only enforcement: even though the backend doesn't validate the recipient,
   * we only allow sending to addresses that resolve to a real NetQwix user account.
   * Use Invite Friends for non-members instead.
   */
  const friendRows = useMemo(() => {
    return (friendsQ.data ?? [])
      .reduce<ShareFriendRow[]>((rows, f: any) => {
        const friend = resolveFriendUser(f, currentUserId);
        if (!friend) return rows;
        rows.push({
          _id: friend.id,
          fullname: friend.name,
          email: friend.email ?? "",
          profile_picture: friend.avatar ?? "",
        });
        return rows;
      }, [])
      .filter((u) => !!u._id);
  }, [currentUserId, friendsQ.data]);

  const selectedFriendIds = useMemo(
    () => Object.keys(selectedFriends).filter((id) => selectedFriends[id]),
    [selectedFriends]
  );

  const toggleFriend = useCallback((id: string) => {
    setSelectedFriends((s) => ({ ...s, [id]: !s[id] }));
  }, []);

  const onShare = useCallback(async () => {
    if (selectedClips.length === 0) {
      Alert.alert("Select clips", "Choose at least one clip to share.");
      return;
    }
    if (selectedFriendIds.length === 0) {
      Alert.alert("Select friends", "Choose at least one friend on your friends list.");
      return;
    }
    setBusy(true);
    try {
      const clipIds = selectedClips.map((c) => String(c._id));
      const result = await postClipShareRequests({
        clipIds,
        friendIds: selectedFriendIds,
      });
      setSelected({});
      setSelectedFriends({});
      Alert.alert(
        "Shared",
        result.message ?? "Clips were added to your friends' lockers."
      );
    } catch (e: any) {
      Alert.alert("Share failed", getApiErrorMessage(e, "Could not share clips."));
    } finally {
      setBusy(false);
    }
  }, [selectedClips, selectedFriendIds]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brandNavy} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandNavy} />
      }
    >
      <Text style={styles.intro}>
        Share clips with friends only. Clips are added to their locker right away; they can remove them later.
        Use <Text style={{ fontWeight: "700", color: colors.brandNavy }}>Invite Friends</Text> to
        add new people first.
      </Text>

      <Text style={styles.label}>Friends</Text>
      {friendRows.length === 0 ? (
        <Text style={styles.pickEmpty}>No friends yet. Add friends from My Community.</Text>
      ) : (
        <View style={styles.pickList}>
          {friendRows.map((u) => {
            const on = !!selectedFriends[u._id];
            return (
              <Pressable
                key={u._id}
                style={[styles.friendRow, on && styles.friendRowOn]}
                onPress={() => toggleFriend(u._id)}
              >
                {u.profile_picture ? (
                  <RecipientAvatar uri={u.profile_picture} name={u.fullname} />
                ) : (
                  <View style={[styles.recipientAvatar, styles.recipientAvatarFb]}>
                    <Text style={styles.recipientAvatarInitial}>
                      {(u.fullname ?? "?")[0]?.toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={styles.recipientName} numberOfLines={1}>
                  {u.fullname}
                </Text>
                <Ionicons
                  name={on ? "checkmark-circle" : "ellipse-outline"}
                  size={22}
                  color={on ? colors.brandNavy : colors.textMuted}
                />
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.toolbar}>
        <Text style={styles.clipCount}>
          {clips.length} clip{clips.length === 1 ? "" : "s"} · {selectedClips.length} selected
        </Text>
        <Pressable onPress={() => refetch()} hitSlop={8}>
          <Text style={styles.link}>{isRefetching ? "Refreshing…" : "Refresh"}</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {clips.map((clip, clipIndex) => {
          const id = String(clip._id);
          const on = !!selected[id];
          const thumb =
            getS3ImageUrl(clip.thumbnail ?? clip.thumbnail_url ?? clip.poster) || "";
          return (
            <Pressable
              key={`share-clip-${id || "row"}-${clipIndex}`}
              style={[styles.tile, on && styles.tileOn]}
              onPress={() => toggle(id)}
            >
              <View style={styles.thumbWrap}>
                {thumb ? (
                  <ClipGridThumb uri={thumb} />
                ) : (
                  <View style={styles.thumbPh}>
                    <Ionicons name="videocam" size={28} color={colors.brandNavy} />
                  </View>
                )}
                <View style={[styles.check, on && styles.checkOn]}>
                  <Ionicons name={on ? "checkmark" : "ellipse-outline"} size={16} color={colors.brandTextOn} />
                </View>
              </View>
              <Text style={styles.tileTitle} numberOfLines={2}>
                {clip.title ?? clip.file_name ?? "Clip"}
              </Text>
              {!!clip._category && (
                <Text style={styles.tileCat} numberOfLines={1}>
                  {String(clip._category)}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {clips.length === 0 && (
        <View style={styles.empty}>
          <Ionicons name="film-outline" size={40} color={colors.borderStrong} />
          <Text style={styles.emptyText}>No clips in your locker yet.</Text>
        </View>
      )}

      <Pressable
        style={[styles.shareBtn, busy && { opacity: 0.6 }]}
        onPress={onShare}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={colors.brandTextOn} />
        ) : (
          <Text style={styles.shareBtnText}>
            Share with {selectedFriendIds.length} friend
            {selectedFriendIds.length === 1 ? "" : "s"}
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

function ClipGridThumb({ uri }: { uri: string }) {
  const [side, setSide] = useState(0);
  return (
    <View
      style={{ width: "100%", alignSelf: "stretch" }}
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w > 0 && w !== side) setSide(w);
      }}
    >
      {side > 0 ? (
        <ImageWithSkeleton
          uri={uri}
          width={side}
          height={side}
          borderRadius={radii.sm}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.thumbPh, { minHeight: 120 }]}>
          <Skeleton width="100%" height={120} radius={radii.sm} />
        </View>
      )}
    </View>
  );
}

function RecipientAvatar({ uri, name }: { uri: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const url = getS3ImageUrl(uri);
  useEffect(() => {
    setFailed(false);
  }, [uri]);
  if (!url || failed) {
    return (
      <View style={[styles.recipientAvatar, styles.recipientAvatarFb]}>
        <Text style={styles.recipientAvatarInitial}>{(name ?? "?")[0]?.toUpperCase()}</Text>
      </View>
    );
  }
  return (
    <ImageWithSkeleton
      uri={url}
      width={36}
      height={36}
      borderRadius={18}
      resizeMode="cover"
      style={styles.recipientAvatar}
      onLoadError={() => setFailed(true)}
      accessibilityLabel={name ? `Photo of ${name}` : "Recipient photo"}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { padding: space.md, paddingBottom: space.xl * 2, gap: space.sm },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl },
  intro: { ...typography.bodySm, color: colors.textMuted },
  label: { ...typography.label, color: colors.textSecondary, marginTop: space.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: typography.bodyMd.fontWeight,
    fontFamily: typography.bodyMd.fontFamily,
    letterSpacing: typography.bodyMd.letterSpacing,
    backgroundColor: colors.surfaceElevated,
    textAlignVertical: "center",
  },

  pickList: {
    marginTop: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  pickHeader: {
    paddingHorizontal: space.sm,
    paddingTop: space.sm,
    paddingBottom: 4,
    ...typography.overline,
    color: colors.textMuted,
  },
  pickEmpty: {
    padding: space.sm,
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: "italic",
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: space.sm,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
  },
  friendRowOn: { backgroundColor: colors.brandSubtle },
  searchSpin: { padding: space.sm, alignItems: "center" },

  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: space.sm,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
  },
  userAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandSubtle },
  userName: { ...typography.bodyMd, fontWeight: "700", color: colors.text },
  userEmail: { ...typography.caption, color: colors.textMuted, marginTop: 1 },
  userRole: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.brandNavy,
    backgroundColor: colors.brandSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    textTransform: "uppercase",
  },

  recipientChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.brandSubtle,
    padding: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#c7d2fe",
  },
  recipientAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceElevated },
  recipientAvatarFb: { alignItems: "center", justifyContent: "center" },
  recipientAvatarInitial: { color: colors.brandNavy, fontWeight: "800", fontSize: 15 },
  recipientName: { ...typography.bodyMd, fontWeight: "700", color: colors.text },
  recipientEmail: { ...typography.caption, color: colors.textMuted, marginTop: 1 },

  toolbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  clipCount: { ...typography.caption, color: colors.textMuted },
  link: { ...typography.bodySm, fontWeight: "600", color: colors.brandNavy },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: space.sm },
  tile: {
    width: "47%",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
    gap: 4,
  },
  tileOn: { borderColor: colors.brandNavy, backgroundColor: colors.brandSubtle },
  thumbWrap: { position: "relative" },
  thumb: { width: "100%", aspectRatio: 1, borderRadius: radii.sm, backgroundColor: colors.surfaceMuted },
  thumbPh: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: radii.sm,
    backgroundColor: colors.brandSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  check: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: colors.brandNavy },
  tileTitle: { ...typography.caption, fontWeight: "600", color: colors.text },
  tileCat: { ...typography.caption, color: colors.textMuted, fontSize: 11 },

  empty: { alignItems: "center", paddingVertical: space.lg, gap: 8 },
  emptyText: { ...typography.bodyMd, color: colors.textMuted },

  shareBtn: {
    marginTop: space.lg,
    backgroundColor: colors.brandNavy,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  shareBtnText: { ...typography.button, color: colors.brandTextOn, fontSize: 16 },
});
