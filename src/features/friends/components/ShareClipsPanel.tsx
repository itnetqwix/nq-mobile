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
  TextInput,
  View,
} from "react-native";
import { ImageWithSkeleton, Skeleton } from "../../../components/ui";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { colors, radii, space, typography } from "../../../theme";
import {
  fetchAllUsers,
  fetchFriends,
  findNetqwixUserByEmail,
  postMyClipsGrouped,
  postShareClipsToEmail,
} from "../../home/api/homeApi";
import {
  NOTIFICATION_TITLES,
  NOTIFICATION_TYPES,
  useNotifications,
} from "../../notifications/NotificationContext";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function flattenClips(groups: { _id: string; clips: any[] }[]): any[] {
  const out: any[] = [];
  for (const g of groups || []) {
    for (const c of g.clips || []) {
      out.push({ ...c, _category: g._id });
    }
  }
  return out;
}

type Recipient = {
  _id: string;
  fullname?: string;
  email: string;
  profile_picture?: string;
  account_type?: string;
};

export function ShareClipsPanel() {
  const { emitNotification } = useNotifications();
  const [query, setQuery] = useState("");
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [validating, setValidating] = useState(false);

  const { data: groups = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["locker", "myClips"],
    queryFn: () => postMyClipsGrouped({}),
    staleTime: 30_000,
  });

  const friendsQ = useQuery({
    queryKey: ["friends", "list"],
    queryFn: fetchFriends,
    staleTime: 60_000,
  });

  const usersQ = useQuery({
    queryKey: ["users", "search", query.trim()],
    queryFn: () => fetchAllUsers(query.trim()),
    enabled: query.trim().length >= 2,
    staleTime: 30_000,
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
  const onShare = useCallback(async () => {
    let target = recipient;

    if (!target && query.trim()) {
      const typed = query.trim().toLowerCase();
      if (!emailRegex.test(typed)) {
        Alert.alert(
          "Pick a NetQwix user",
          "Tap a friend or search for a NetQwix member. To invite someone new, use Invite Friends."
        );
        return;
      }
      setValidating(true);
      try {
        const found = await findNetqwixUserByEmail(typed);
        if (!found) {
          Alert.alert(
            "Not on NetQwix",
            `${typed} doesn't have a NetQwix account. Share clips can only be sent to NetQwix members — try Invite Friends instead.`
          );
          return;
        }
        target = {
          _id: String(found._id),
          fullname: found.fullname,
          email: found.email,
          profile_picture: found.profile_picture,
          account_type: found.account_type,
        };
        setRecipient(target);
      } catch (e) {
        Alert.alert(
          "Check failed",
          getApiErrorMessage(e, "Could not verify the recipient. Please try again.")
        );
        return;
      } finally {
        setValidating(false);
      }
    }

    if (!target) {
      Alert.alert("Pick a recipient", "Choose a NetQwix friend or search for a user first.");
      return;
    }
    if (selectedClips.length === 0) {
      Alert.alert("Select clips", "Choose at least one clip to share.");
      return;
    }
    setBusy(true);
    try {
      await postShareClipsToEmail(target.email, selectedClips);
      /**
       * Persist an inbox entry on the recipient side. The backend already
       * emails them; this gets a matching in-app row so they see "Clip
       * Shared" without waiting for the next inbox refresh.
       */
      try {
        emitNotification({
          title: NOTIFICATION_TITLES.clipShared,
          description: `${target.fullname ?? "A NetQwix member"} shared ${
            selectedClips.length
          } clip${selectedClips.length === 1 ? "" : "s"} with you.`,
          receiverId: target._id,
          type: NOTIFICATION_TYPES.TRANSCATIONAL,
          bookingInfo: { clipIds: selectedClips },
        });
      } catch {
        /** Notification failure must not block the share UX. */
      }
      setSelected({});
      setRecipient(null);
      setQuery("");
      Alert.alert("Sent", `Clips shared with ${target.fullname ?? target.email}.`);
    } catch (e: any) {
      Alert.alert(
        "Share failed",
        getApiErrorMessage(e, "Could not share clips.")
      );
    } finally {
      setBusy(false);
    }
  }, [recipient, query, selectedClips, emitNotification]);

  const friendSuggestions: Recipient[] = useMemo(() => {
    const friends: any[] = friendsQ.data ?? [];
    const q = query.trim().toLowerCase();
    return friends
      .map((f: any) => ({
        _id: String(f._id ?? f.id ?? f.user_id ?? f.email ?? ""),
        fullname: f.fullname ?? f.full_name ?? f.name ?? f.email ?? "Friend",
        email: f.email ?? "",
        profile_picture: f.profile_picture ?? f.avatar ?? "",
        account_type: f.account_type,
      }))
      .filter((u: Recipient) => !!u.email)
      .filter((u: Recipient) =>
        q
          ? (u.fullname ?? "").toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
          : true
      )
      .slice(0, 8);
  }, [friendsQ.data, query]);

  const userResults: Recipient[] = useMemo(() => {
    if (query.trim().length < 2) return [];
    const friendEmails = new Set(friendSuggestions.map((f) => f.email.toLowerCase()));
    return (usersQ.data ?? [])
      .map((u: any) => ({
        _id: String(u._id),
        fullname: u.fullname ?? u.full_name ?? u.email ?? "User",
        email: u.email ?? "",
        profile_picture: u.profile_picture,
        account_type: u.account_type,
      }))
      .filter((u: Recipient) => !!u.email && !friendEmails.has(u.email.toLowerCase()))
      .slice(0, 8);
  }, [usersQ.data, friendSuggestions, query]);

  /** Clear the picked recipient if the user starts editing the search again. */
  useEffect(() => {
    if (recipient && query.trim().toLowerCase() !== recipient.email.toLowerCase()) {
      setRecipient(null);
    }
  }, [query, recipient]);

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
        Share clips with anyone on NetQwix. Type a friend's name or email — only verified
        NetQwix accounts are allowed. Use{" "}
        <Text style={{ fontWeight: "700", color: colors.brandNavy }}>Invite Friends</Text> to bring new
        people to the platform.
      </Text>

      <Text style={styles.label}>Recipient</Text>
      {recipient ? (
        <View style={styles.recipientChip}>
          {recipient.profile_picture ? (
            <RecipientAvatar uri={recipient.profile_picture} name={recipient.fullname ?? recipient.email ?? ""} />
          ) : (
            <View style={[styles.recipientAvatar, styles.recipientAvatarFb]}>
              <Text style={styles.recipientAvatarInitial}>
                {(recipient.fullname ?? recipient.email ?? "?")[0]?.toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.recipientName} numberOfLines={1}>
              {recipient.fullname ?? recipient.email}
            </Text>
            <Text style={styles.recipientEmail} numberOfLines={1}>
              {recipient.email}
            </Text>
          </View>
          <Pressable
            hitSlop={10}
            onPress={() => {
              setRecipient(null);
              setQuery("");
            }}
          >
            <Ionicons name="close-circle" size={22} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : (
        <View>
          <TextInput
            style={styles.input}
            placeholder="Search NetQwix members by name or email"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={query}
            onChangeText={setQuery}
          />
          {(friendSuggestions.length > 0 || userResults.length > 0 || usersQ.isFetching) && (
            <View style={styles.pickList}>
              {friendSuggestions.length > 0 && (
                <Text style={styles.pickHeader}>Friends</Text>
              )}
              {friendSuggestions.map((u) => (
                <UserRow key={`friend-${u._id}`} user={u} onPick={setRecipient} />
              ))}

              {query.trim().length >= 2 && (
                <Text style={styles.pickHeader}>NetQwix members</Text>
              )}
              {usersQ.isFetching && (
                <View style={styles.searchSpin}>
                  <ActivityIndicator size="small" color={colors.brandNavy} />
                </View>
              )}
              {userResults.map((u) => (
                <UserRow key={`user-${u._id}`} user={u} onPick={setRecipient} />
              ))}

              {query.trim().length >= 2 &&
                !usersQ.isFetching &&
                userResults.length === 0 &&
                friendSuggestions.length === 0 && (
                  <Text style={styles.pickEmpty}>
                    No NetQwix users match "{query.trim()}". Use Invite Friends to invite them.
                  </Text>
                )}
            </View>
          )}
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
        {clips.map((clip) => {
          const id = String(clip._id);
          const on = !!selected[id];
          const thumb =
            getS3ImageUrl(clip.thumbnail ?? clip.thumbnail_url ?? clip.poster) || "";
          return (
            <Pressable
              key={id}
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
        style={[styles.shareBtn, (busy || validating) && { opacity: 0.6 }]}
        onPress={onShare}
        disabled={busy || validating}
      >
        {busy || validating ? (
          <ActivityIndicator color={colors.brandTextOn} />
        ) : (
          <Text style={styles.shareBtnText}>
            {recipient ? `Send to ${recipient.fullname ?? recipient.email}` : "Send by email"}
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

function UserRowAvatar({ uri, name }: { uri: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const url = getS3ImageUrl(uri);
  useEffect(() => {
    setFailed(false);
  }, [uri]);
  if (!url || failed) {
    return (
      <View style={[styles.userAvatar, styles.recipientAvatarFb]}>
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
      style={styles.userAvatar}
      onLoadError={() => setFailed(true)}
      accessibilityLabel={name ? `Photo of ${name}` : "User photo"}
    />
  );
}

function UserRow({
  user,
  onPick,
}: {
  user: Recipient;
  onPick: (u: Recipient) => void;
}) {
  return (
    <Pressable style={styles.userRow} onPress={() => onPick(user)}>
      {user.profile_picture ? (
        <UserRowAvatar uri={user.profile_picture} name={user.fullname ?? user.email ?? ""} />
      ) : (
        <View style={[styles.userAvatar, styles.recipientAvatarFb]}>
          <Text style={styles.recipientAvatarInitial}>
            {(user.fullname ?? user.email ?? "?")[0]?.toUpperCase()}
          </Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.userName} numberOfLines={1}>
          {user.fullname ?? user.email}
        </Text>
        <Text style={styles.userEmail} numberOfLines={1}>
          {user.email}
        </Text>
      </View>
      {!!user.account_type && (
        <Text style={styles.userRole}>{user.account_type.toLowerCase()}</Text>
      )}
    </Pressable>
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
    ...typography.bodyMd,
    backgroundColor: colors.surfaceElevated,
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
