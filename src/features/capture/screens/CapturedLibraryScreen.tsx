import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { ClipUploadModal } from "../../dashboard/components/locker/ClipUploadModal";
import { CapturedClipPlayer } from "../components/CapturedClipPlayer";
import {
  CapturedShareSheet,
  type CapturedShareTarget,
} from "../components/CapturedShareSheet";
import {
  getCapturedClips,
  deleteCapturedClip,
  type CapturedClip,
} from "./CaptureScreen";
import { colors, radii, space, typography } from "../../../theme";

const SHARE_MY_CLIPS = "My Clips";
const SHARE_FRIENDS = "Friends";
const SHARE_EMAIL = "Email";

export function CapturedLibraryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [clips, setClips] = useState<CapturedClip[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [uploadVisible, setUploadVisible] = useState(false);
  const [uploadShareTarget, setUploadShareTarget] = useState<
    typeof SHARE_MY_CLIPS | typeof SHARE_FRIENDS | typeof SHARE_EMAIL
  >(SHARE_MY_CLIPS);

  const load = useCallback(async () => {
    const c = await getCapturedClips();
    setClips(c);
    setActiveId((prev) => {
      if (prev && c.some((clip) => clip.id === prev)) return prev;
      return c[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeClip = useMemo(
    () => clips.find((c) => c.id === activeId) ?? null,
    [clips, activeId]
  );

  const toggleSelect = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const confirmDelete = (ids: string[]) => {
    if (ids.length === 0) return;
    Alert.alert(
      "Delete clip",
      ids.length === 1
        ? "Delete this clip? This cannot be undone."
        : `Delete ${ids.length} clips? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            for (const id of ids) {
              await deleteCapturedClip(id);
            }
            setSelected(new Set());
            setSelectMode(false);
            void load();
          },
        },
      ]
    );
  };

  const openShare = (target: CapturedShareTarget) => {
    if (!activeClip) return;
    const map: Record<CapturedShareTarget, typeof SHARE_MY_CLIPS | typeof SHARE_FRIENDS | typeof SHARE_EMAIL> = {
      "my-clips": SHARE_MY_CLIPS,
      friends: SHARE_FRIENDS,
      email: SHARE_EMAIL,
    };
    setUploadShareTarget(map[target]);
    setUploadVisible(true);
  };

  const formatDuration = (secs?: number) => {
    if (!secs) return "";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `0:${s.toString().padStart(2, "0")}`;
  };

  const renderItem = ({ item }: { item: CapturedClip }) => {
    const isActive = activeId === item.id;
    const isSelected = selected.has(item.id);
    return (
      <Pressable
        style={[styles.clipRow, isActive && styles.clipRowActive]}
        onPress={() => {
          if (selectMode) {
            toggleSelect(item.id);
            return;
          }
          setActiveId(item.id);
        }}
        onLongPress={() => {
          if (!selectMode) setSelectMode(true);
          toggleSelect(item.id);
        }}
      >
        {selectMode && (
          <View style={[styles.check, isSelected && styles.checkOn]}>
            {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
          </View>
        )}
        <View style={styles.thumb}>
          <Ionicons name="videocam" size={20} color="#94a3b8" />
        </View>
        <View style={styles.clipMeta}>
          <Text style={styles.clipDate} numberOfLines={1}>
            {new Date(item.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
          {item.durationSecs ? (
            <Text style={styles.clipDur}>{formatDuration(item.durationSecs)}</Text>
          ) : null}
        </View>
        {isActive && !selectMode ? (
          <Ionicons name="volume-high-outline" size={18} color={colors.brandNavy} />
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.brandNavy} />
        </Pressable>
        <Text style={styles.title}>Captured Library</Text>
        {selectMode ? (
          <Pressable
            style={styles.headerAction}
            onPress={() => {
              setSelectMode(false);
              setSelected(new Set());
            }}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        ) : (
          <Pressable
            style={styles.headerAction}
            onPress={() => setSelectMode(true)}
            disabled={clips.length === 0}
          >
            <Ionicons name="checkbox-outline" size={22} color={colors.brandNavy} />
          </Pressable>
        )}
      </View>

      {selectMode && selected.size > 0 && (
        <View style={styles.selectBar}>
          <Text style={styles.selectBarText}>{selected.size} selected</Text>
          <Pressable style={styles.deleteBar} onPress={() => confirmDelete([...selected])}>
            <Ionicons name="trash-outline" size={16} color="#fff" />
            <Text style={styles.deleteBarText}>Delete</Text>
          </Pressable>
        </View>
      )}

      {clips.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="videocam-outline" size={48} color="#9ca3af" />
          <Text style={styles.emptyTitle}>No captured clips yet</Text>
          <Text style={styles.emptySub}>Tap the Capture tab to record your first clip.</Text>
          <Pressable style={styles.captureBtn} onPress={() => navigation.navigate("Capture")}>
            <Ionicons name="videocam-outline" size={16} color="#fff" />
            <Text style={styles.captureBtnText}>Start Recording</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <CapturedClipPlayer
            clip={activeClip}
            onDelete={() => activeClip && confirmDelete([activeClip.id])}
            onShare={() => setShareSheetVisible(true)}
          />

          <Text style={styles.listHeading}>All clips ({clips.length})</Text>
          <FlatList
            data={clips}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}

      <CapturedShareSheet
        visible={shareSheetVisible}
        onClose={() => setShareSheetVisible(false)}
        onSelect={openShare}
      />

      <ClipUploadModal
        visible={uploadVisible}
        onClose={() => setUploadVisible(false)}
        onUploaded={() => void load()}
        initialVideo={
          activeClip
            ? {
                uri: activeClip.uri,
                durationSecs: activeClip.durationSecs,
                fileName: `capture_${activeClip.id}.mp4`,
              }
            : null
        }
        defaultShareTarget={uploadShareTarget}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  backBtn: { padding: 4 },
  title: { flex: 1, ...typography.subtitle, marginLeft: space.sm },
  headerAction: { padding: 6 },
  cancelText: { color: colors.brandNavy, fontWeight: "600", fontSize: 15 },
  selectBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: "#f3f4f6",
  },
  selectBarText: { ...typography.bodySm, color: "#374151" },
  deleteBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ef4444",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.md,
  },
  deleteBarText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  listHeading: {
    marginHorizontal: space.md,
    marginBottom: space.xs,
    fontSize: 13,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  list: { paddingHorizontal: space.md, paddingBottom: space.xl },
  clipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: 10,
    paddingHorizontal: space.sm,
    borderRadius: radii.md,
    marginBottom: 6,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  clipRowActive: {
    borderColor: colors.brandNavy,
    backgroundColor: "#eff6ff",
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: colors.brandNavy, borderColor: colors.brandNavy },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
  },
  clipMeta: { flex: 1 },
  clipDate: { fontSize: 14, fontWeight: "600", color: "#111827" },
  clipDur: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
    padding: space.xl,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  emptySub: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20 },
  captureBtn: {
    marginTop: space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brandNavy,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radii.md,
  },
  captureBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
