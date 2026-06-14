import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { LockerViewerModal } from "../../dashboard/components/locker/LockerViewerModal";
import { ClipUploadModal } from "../../dashboard/components/locker/ClipUploadModal";
import {
  CapturedShareSheet,
  type CapturedShareTarget,
} from "../components/CapturedShareSheet";
import {
  getCapturedClips,
  deleteCapturedClip,
  type CapturedClip,
} from "./CaptureScreen";
import { floatingTabBarBottomInset } from "../../../navigation/FloatingTabBar";
import { colors, radii, space, typography } from "../../../theme";

const SHARE_MY_CLIPS = "My Clips";
const SHARE_FRIENDS = "Friends";
const SHARE_EMAIL = "Email";

export function CapturedLibraryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [clips, setClips] = useState<CapturedClip[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewerClip, setViewerClip] = useState<CapturedClip | null>(null);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [uploadVisible, setUploadVisible] = useState(false);
  const [uploadClip, setUploadClip] = useState<CapturedClip | null>(null);
  const [uploadShareTarget, setUploadShareTarget] = useState<
    typeof SHARE_MY_CLIPS | typeof SHARE_FRIENDS | typeof SHARE_EMAIL
  >(SHARE_MY_CLIPS);

  const load = useCallback(async () => {
    const c = await getCapturedClips();
    setClips(c);
    setViewerClip((prev) => {
      if (prev && c.some((clip) => clip.id === prev.id)) return prev;
      return null;
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const canGoBack = navigation.canGoBack();
  const fabBottom = floatingTabBarBottomInset(insets.bottom) + 8;
  const startRecording = () => navigation.navigate("CaptureCamera");

  const selectedClips = useMemo(
    () => clips.filter((c) => selected.has(c.id)),
    [clips, selected]
  );

  const toggleSelect = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const confirmDelete = (ids: string[]) => {
    if (ids.length === 0) return;
    Alert.alert(
      "Delete clips",
      ids.length === 1
        ? "Delete this clip from your device? This cannot be undone."
        : `Delete ${ids.length} clips from your device? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            for (const id of ids) {
              await deleteCapturedClip(id);
            }
            if (viewerClip && ids.includes(viewerClip.id)) setViewerClip(null);
            exitSelectMode();
            void load();
            Alert.alert("Deleted", ids.length === 1 ? "Clip removed." : `${ids.length} clips removed.`);
          },
        },
      ]
    );
  };

  const pickClipForShare = (): CapturedClip | null => {
    if (selectMode && selectedClips.length > 0) {
      if (selectedClips.length > 1) {
        Alert.alert(
          "One at a time",
          "Select a single clip to upload or share. You can repeat for additional clips."
        );
        return null;
      }
      return selectedClips[0] ?? null;
    }
    return viewerClip;
  };

  const openShareTarget = (target: CapturedShareTarget) => {
    const clip = pickClipForShare();
    if (!clip) {
      if (!selectMode && !viewerClip) {
        Alert.alert("Select a clip", "Tap a clip to preview, or use multi-select.");
      }
      return;
    }
    const map: Record<CapturedShareTarget, typeof SHARE_MY_CLIPS | typeof SHARE_FRIENDS | typeof SHARE_EMAIL> = {
      "my-clips": SHARE_MY_CLIPS,
      friends: SHARE_FRIENDS,
      email: SHARE_EMAIL,
    };
    setUploadClip(clip);
    setUploadShareTarget(map[target]);
    setUploadVisible(true);
    setShareSheetVisible(false);
  };

  const formatDuration = (secs?: number) => {
    if (!secs) return "";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `0:${s.toString().padStart(2, "0")}`;
  };

  const renderItem = ({ item }: { item: CapturedClip }) => {
    const isSelected = selected.has(item.id);
    return (
      <Pressable
        style={[styles.clipRow, isSelected && styles.clipRowSelected]}
        onPress={() => {
          if (selectMode) {
            toggleSelect(item.id);
            return;
          }
          setViewerClip(item);
        }}
        onLongPress={() => {
          if (!selectMode) setSelectMode(true);
          toggleSelect(item.id);
        }}
      >
        {selectMode ? (
          <View style={[styles.check, isSelected && styles.checkOn]}>
            {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
          </View>
        ) : (
          <View style={styles.playBadge}>
            <Ionicons name="play" size={14} color="#fff" />
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
        {!selectMode ? (
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        {canGoBack ? (
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.brandNavy} />
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}
        <Text style={styles.title}>Captured clips</Text>
        {selectMode ? (
          <Pressable style={styles.headerAction} onPress={exitSelectMode}>
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

      {selectMode && selected.size > 0 ? (
        <View style={styles.selectBar}>
          <Text style={styles.selectBarText}>{selected.size} selected</Text>
          <View style={styles.selectActions}>
            <Pressable
              style={[styles.selectAction, styles.selectActionDanger]}
              onPress={() => confirmDelete([...selected])}
            >
              <Ionicons name="trash-outline" size={16} color="#fff" />
              <Text style={styles.selectActionText}>Delete</Text>
            </Pressable>
            <Pressable
              style={styles.selectAction}
              onPress={() => openShareTarget("my-clips")}
            >
              <Ionicons name="folder-outline" size={16} color={colors.brandNavy} />
              <Text style={[styles.selectActionText, styles.selectActionTextDark]}>My clips</Text>
            </Pressable>
            <Pressable
              style={styles.selectAction}
              onPress={() => openShareTarget("friends")}
            >
              <Ionicons name="people-outline" size={16} color={colors.brandNavy} />
              <Text style={[styles.selectActionText, styles.selectActionTextDark]}>Friends</Text>
            </Pressable>
            <Pressable
              style={styles.selectAction}
              onPress={() => openShareTarget("email")}
            >
              <Ionicons name="mail-outline" size={16} color={colors.brandNavy} />
              <Text style={[styles.selectActionText, styles.selectActionTextDark]}>Email</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {clips.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="videocam-outline" size={48} color="#9ca3af" />
          <Text style={styles.emptyTitle}>No captured clips yet</Text>
          <Text style={styles.emptySub}>Tap the camera button below to record your first clip.</Text>
        </View>
      ) : (
        <>
          <Text style={styles.listHeading}>Your recordings ({clips.length})</Text>
          <FlatList
            data={clips}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={[styles.list, { paddingBottom: fabBottom + 72 }]}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}

      <Pressable
        style={[styles.fab, { bottom: fabBottom }]}
        onPress={startRecording}
        accessibilityRole="button"
        accessibilityLabel="Record new clip"
      >
        <Ionicons name="videocam" size={28} color="#fff" />
      </Pressable>

      <LockerViewerModal
        visible={!!viewerClip && !selectMode}
        onClose={() => setViewerClip(null)}
        uri={viewerClip?.uri ?? ""}
        title="Captured clip"
        mode="video"
        onDeleteClip={
          viewerClip
            ? async () => {
                await deleteCapturedClip(viewerClip.id);
                setViewerClip(null);
                void load();
                Alert.alert("Deleted", "Clip removed from your device.");
              }
            : undefined
        }
        onShareExternal={
          viewerClip
            ? () => setShareSheetVisible(true)
            : undefined
        }
        shareAccessibilityLabel="Share captured clip"
      />

      <CapturedShareSheet
        visible={shareSheetVisible}
        onClose={() => setShareSheetVisible(false)}
        onSelect={openShareTarget}
      />

      <ClipUploadModal
        visible={uploadVisible}
        onClose={() => {
          setUploadVisible(false);
          setUploadClip(null);
        }}
        onUploaded={() => {
          void load();
          exitSelectMode();
        }}
        initialVideo={
          uploadClip
            ? {
                uri: uploadClip.uri,
                durationSecs: uploadClip.durationSecs,
                fileName: `capture_${uploadClip.id}.mp4`,
                fileSizeBytes: uploadClip.fileSizeBytes,
                mimeType: uploadClip.mimeType ?? "video/mp4",
              }
            : null
        }
        defaultShareTarget={uploadShareTarget}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  backBtn: { padding: 4, width: 32 },
  title: { flex: 1, ...typography.subtitle, marginLeft: space.sm },
  headerAction: { padding: 6 },
  cancelText: { color: colors.brandNavy, fontWeight: "600", fontSize: 15 },
  selectBar: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: "#f3f4f6",
    gap: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  selectBarText: { ...typography.bodySm, color: "#374151", fontWeight: "600" },
  selectActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  selectAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.md,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  selectActionDanger: {
    backgroundColor: "#ef4444",
    borderColor: "#ef4444",
  },
  selectActionText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  selectActionTextDark: { color: colors.brandNavy },
  listHeading: {
    marginHorizontal: space.md,
    marginTop: space.md,
    marginBottom: space.xs,
    fontSize: 13,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  list: { paddingHorizontal: space.md },
  clipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: 12,
    paddingHorizontal: space.sm,
    borderRadius: radii.md,
    marginBottom: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  clipRowSelected: {
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
  playBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.brandNavy,
    alignItems: "center",
    justifyContent: "center",
  },
  thumb: {
    width: 48,
    height: 48,
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
  fab: {
    position: "absolute",
    alignSelf: "center",
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brandNavy,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 8,
  },
});
