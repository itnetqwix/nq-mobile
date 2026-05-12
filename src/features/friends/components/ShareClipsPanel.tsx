import React, { useCallback, useMemo, useState } from "react";
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
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { radii, space } from "../../../theme/tokens";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { postMyClipsGrouped, postShareClipsToEmail } from "../../home/api/homeApi";

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

export function ShareClipsPanel() {
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const { data: groups = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["locker", "myClips"],
    queryFn: () => postMyClipsGrouped({}),
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

  const onShare = useCallback(async () => {
    if (!emailRegex.test(email.trim())) {
      Alert.alert("Invalid email", "Enter a valid recipient email.");
      return;
    }
    if (selectedClips.length === 0) {
      Alert.alert("Select clips", "Choose at least one clip to share.");
      return;
    }
    setBusy(true);
    try {
      await postShareClipsToEmail(email, selectedClips);
      setEmail("");
      setSelected({});
      Alert.alert("Sent", "Clips were shared by email (same as the website).");
    } catch (e: any) {
      Alert.alert("Share failed", e?.message ?? "Could not share clips.");
    } finally {
      setBusy(false);
    }
  }, [email, selectedClips]);

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
        Same API as the web Share Clips card: POST `/user/share-clips` with `user_email` and full
        clip objects.
      </Text>

      <Text style={styles.label}>Recipient email</Text>
      <TextInput
        style={styles.input}
        placeholder="friend@example.com"
        placeholderTextColor="#9ca3af"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

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
        style={[styles.shareBtn, busy && { opacity: 0.6 }]}
        onPress={onShare}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.shareBtnText}>Send by email</Text>
        )}
      </Pressable>
    </ScrollView>
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
  toolbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  clipCount: { fontSize: 12, color: "#6b7280" },
  link: { fontSize: 13, fontWeight: "600", color: NAVY },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: space.sm,
  },
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
