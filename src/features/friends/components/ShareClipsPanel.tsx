import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { radii, space } from "../../../theme/tokens";
import {
  fetchAllUsers,
  fetchFriends,
  findNetqwixUserByEmail,
  postMyClipsGrouped,
  postShareClipsToEmail,
} from "../../home/api/homeApi";

const NAVY = "#000080";
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
  }, [recipient, query, selectedClips]);

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
        <ActivityIndicator size="large" color={NAVY} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={NAVY} />
      }
    >
      <Text style={styles.intro}>
        Share clips with anyone on NetQwix. Type a friend's name or email — only verified
        NetQwix accounts are allowed. Use{" "}
        <Text style={{ fontWeight: "700", color: NAVY }}>Invite Friends</Text> to bring new
        people to the platform.
      </Text>

      <Text style={styles.label}>Recipient</Text>
      {recipient ? (
        <View style={styles.recipientChip}>
          {recipient.profile_picture ? (
            <Image
              source={{ uri: getS3ImageUrl(recipient.profile_picture) }}
              style={styles.recipientAvatar}
            />
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
            <Ionicons name="close-circle" size={22} color="#9ca3af" />
          </Pressable>
        </View>
      ) : (
        <View>
          <TextInput
            style={styles.input}
            placeholder="Search NetQwix members by name or email"
            placeholderTextColor="#9ca3af"
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
                  <ActivityIndicator size="small" color={NAVY} />
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
                  <Image source={{ uri: thumb }} style={styles.thumb} />
                ) : (
                  <View style={styles.thumbPh}>
                    <Ionicons name="videocam" size={28} color={NAVY} />
                  </View>
                )}
                <View style={[styles.check, on && styles.checkOn]}>
                  <Ionicons name={on ? "checkmark" : "ellipse-outline"} size={16} color="#fff" />
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
          <Ionicons name="film-outline" size={40} color="#d1d5db" />
          <Text style={styles.emptyText}>No clips in your locker yet.</Text>
        </View>
      )}

      <Pressable
        style={[styles.shareBtn, (busy || validating) && { opacity: 0.6 }]}
        onPress={onShare}
        disabled={busy || validating}
      >
        {busy || validating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.shareBtnText}>
            {recipient ? `Send to ${recipient.fullname ?? recipient.email}` : "Send by email"}
          </Text>
        )}
      </Pressable>
    </ScrollView>
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
        <Image
          source={{ uri: getS3ImageUrl(user.profile_picture) }}
          style={styles.userAvatar}
        />
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
  root: { flex: 1, backgroundColor: "#f6f7fb" },
  content: { padding: space.md, paddingBottom: space.xl * 2, gap: space.sm },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl },
  intro: { fontSize: 13, color: "#6b7280", lineHeight: 18 },
  label: { fontSize: 13, fontWeight: "700", color: "#374151", marginTop: space.sm },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: "#fff",
  },

  pickList: {
    marginTop: 8,
    backgroundColor: "#fff",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },
  pickHeader: {
    paddingHorizontal: space.sm,
    paddingTop: space.sm,
    paddingBottom: 4,
    fontSize: 11,
    fontWeight: "800",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pickEmpty: {
    padding: space.sm,
    fontSize: 12,
    color: "#9ca3af",
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
    borderTopColor: "#f3f4f6",
  },
  userAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#eef2ff" },
  userName: { fontSize: 14, fontWeight: "700", color: "#111827" },
  userEmail: { fontSize: 12, color: "#6b7280", marginTop: 1 },
  userRole: {
    fontSize: 10,
    fontWeight: "700",
    color: NAVY,
    backgroundColor: "#eef2ff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    textTransform: "uppercase",
  },

  recipientChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#eef2ff",
    padding: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#c7d2fe",
  },
  recipientAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff" },
  recipientAvatarFb: { alignItems: "center", justifyContent: "center" },
  recipientAvatarInitial: { color: NAVY, fontWeight: "800", fontSize: 15 },
  recipientName: { fontSize: 14, fontWeight: "700", color: "#111827" },
  recipientEmail: { fontSize: 12, color: "#6b7280", marginTop: 1 },

  toolbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  clipCount: { fontSize: 12, color: "#6b7280" },
  link: { fontSize: 13, fontWeight: "600", color: NAVY },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: space.sm },
  tile: {
    width: "47%",
    backgroundColor: "#fff",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 8,
    gap: 4,
  },
  tileOn: { borderColor: NAVY, backgroundColor: "#eff6ff" },
  thumbWrap: { position: "relative" },
  thumb: { width: "100%", aspectRatio: 1, borderRadius: radii.sm, backgroundColor: "#f3f4f6" },
  thumbPh: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: radii.sm,
    backgroundColor: "#f0f4ff",
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
  checkOn: { backgroundColor: NAVY },
  tileTitle: { fontSize: 12, fontWeight: "600", color: "#111827" },
  tileCat: { fontSize: 11, color: "#6b7280" },

  empty: { alignItems: "center", paddingVertical: space.lg, gap: 8 },
  emptyText: { fontSize: 14, color: "#9ca3af" },

  shareBtn: {
    marginTop: space.lg,
    backgroundColor: NAVY,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  shareBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
