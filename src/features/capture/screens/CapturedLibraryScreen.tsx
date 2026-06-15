import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import { FlashList } from "@shopify/flash-list";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../auth/context/AuthContext";
import { LockerViewerModal } from "../../dashboard/components/locker/LockerViewerModal";
import {
  ClipUploadPrepareModal,
  type PreparedClipUpload,
} from "../../dashboard/components/locker/ClipUploadPrepareModal";
import {
  CapturedShareSheet,
  type CapturedShareTarget,
} from "../components/CapturedShareSheet";
import { CaptureQuickLabelModal } from "../components/CaptureQuickLabelModal";
import { useInlineClipRecording } from "../useInlineClipRecording";
import {
  getCapturedClips,
  deleteCapturedClip,
  saveCapturedClip,
  type CapturedClip,
} from "../capturedClipsStorage";
import type * as ImagePicker from "expo-image-picker";
import { floatingTabBarBottomInset } from "../../../navigation/FloatingTabBar";
import type { CaptureStackParamList } from "../../../navigation/CaptureNavigator";
import { FLASHLIST_PERF_DEFAULTS } from "../../../lib/lists/flatListPerf";
import { haptics } from "../../../lib/haptics";
import { colors, radii, space, typography } from "../../../theme";

function defaultClipLabel(): string {
  return `Clip ${new Date().toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function CapturedLibraryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<CaptureStackParamList>>();
  const { user } = useAuth();
  const userId = user?._id != null ? String(user._id) : null;
  const [clips, setClips] = useState<CapturedClip[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewerClip, setViewerClip] = useState<CapturedClip | null>(null);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [prepareVisible, setPrepareVisible] = useState(false);
  const [labelModalVisible, setLabelModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [thumbUri, setThumbUri] = useState<string | null>(null);
  const [thumbBusy, setThumbBusy] = useState(false);
  const [pendingAsset, setPendingAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [defaultLabel, setDefaultLabel] = useState(defaultClipLabel());

  const load = useCallback(async () => {
    const c = await getCapturedClips(userId);
    setClips(c);
    setViewerClip((prev) => {
      if (prev && c.some((clip) => clip.id === prev.id)) return prev;
      return null;
    });
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const canGoBack = navigation.canGoBack();
  const fabBottom = floatingTabBarBottomInset(insets.bottom) + 8;

  const onInlineCaptured = useCallback(
    (capture: { asset: ImagePicker.ImagePickerAsset; thumbUri: string | null }) => {
      setPendingAsset(capture.asset);
      setThumbUri(capture.thumbUri);
      setThumbBusy(false);
      setDefaultLabel(defaultClipLabel());
      setPrepareVisible(true);
    },
    []
  );

  const { startRecording, busy: recordingBusy } = useInlineClipRecording({
    onCaptured: onInlineCaptured,
  });

  const saveLabeledClip = useCallback(
    async (label: string) => {
      if (!pendingAsset?.uri) return;
      setSaving(true);
      try {
        const id = `capture_${Date.now()}`;
        const durationSecs =
          pendingAsset.duration != null ? Math.round(pendingAsset.duration) : undefined;
        await saveCapturedClip(userId, {
          id,
          uri: pendingAsset.uri,
          createdAt: new Date().toISOString(),
          label,
          durationSecs,
          fileSizeBytes: pendingAsset.fileSize,
          mimeType: pendingAsset.mimeType ?? "video/mp4",
        });
        setLabelModalVisible(false);
        setPrepareVisible(false);
        setPendingAsset(null);
        setThumbUri(null);
        haptics.success();
        void load();
      } catch {
        Alert.alert("Error", "Could not save the clip. Please try again.");
      } finally {
        setSaving(false);
      }
    },
    [load, pendingAsset, userId]
  );

  const selectedClips = useMemo(
    () => clips.filter((c) => selected.has(c.id)),
    [clips, selected]
  );

  const toggleSelect = (id: string) => {
    haptics.select();
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    haptics.tap();
    setSelectMode(false);
    setSelected(new Set());
  };

  const confirmDelete = (ids: string[]) => {
    if (ids.length === 0) return;
    haptics.warning();
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
              await deleteCapturedClip(userId, id);
            }
            if (viewerClip && ids.includes(viewerClip.id)) setViewerClip(null);
            exitSelectMode();
            void load();
            haptics.success();
            Alert.alert("Deleted", ids.length === 1 ? "Clip removed." : `${ids.length} clips removed.`);
          },
        },
      ]
    );
  };

  const pickClipsForShare = (): CapturedClip[] => {
    if (selectMode && selectedClips.length > 0) return selectedClips;
    if (viewerClip) return [viewerClip];
    return [];
  };

  const navigateToUpload = (target: CapturedShareTarget, clipList: CapturedClip[]) => {
    if (clipList.length === 0) {
      Alert.alert("Select a clip", "Tap a clip to preview, or use multi-select.");
      return;
    }
    haptics.tap();
    navigation.navigate("CapturedClipUpload", {
      clips: clipList,
      shareTarget: target,
      showPrepareStep: clipList.length === 1,
    });
    setShareSheetVisible(false);
    exitSelectMode();
  };

  const openShareTarget = (target: CapturedShareTarget) => {
    navigateToUpload(target, pickClipsForShare());
  };

  const openUploadForClip = (clip: CapturedClip) => {
    haptics.tap();
    navigation.navigate("CapturedClipUpload", {
      clips: [clip],
      shareTarget: "my-clips",
      showPrepareStep: true,
    });
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
          haptics.tap();
          setViewerClip(item);
        }}
        onLongPress={() => {
          haptics.impact();
          if (!selectMode) setSelectMode(true);
          toggleSelect(item.id);
        }}
      >
        {selectMode ? (
          <View style={[styles.check, isSelected && styles.checkOn]}>
            {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
          </View>
        ) : (
          <Pressable
            style={styles.recordIconBtn}
            onPress={(e) => {
              e.stopPropagation?.();
              void startRecording();
            }}
            disabled={recordingBusy}
            accessibilityRole="button"
            accessibilityLabel="Record new clip"
          >
            <Ionicons name="videocam" size={18} color={colors.brandNavy} />
          </Pressable>
        )}
        <Pressable
          style={styles.thumb}
          onPress={() => {
            if (selectMode) return;
            haptics.tap();
            setViewerClip(item);
          }}
          disabled={selectMode}
        >
          <Ionicons name="play" size={16} color="#fff" />
        </Pressable>
        <View style={styles.clipMeta}>
          <Text style={styles.clipDate} numberOfLines={1}>
            {item.label?.trim() ||
              new Date(item.createdAt).toLocaleDateString(undefined, {
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
          <Pressable
            hitSlop={10}
            onPress={() => openUploadForClip(item)}
            accessibilityLabel="Upload clip"
          >
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </Pressable>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        {canGoBack ? (
          <Pressable
            style={styles.backBtn}
            onPress={() => {
              haptics.tap();
              navigation.goBack();
            }}
          >
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
            onPress={() => {
              haptics.tap();
              setSelectMode(true);
            }}
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
          <Pressable
            style={styles.emptyRecordBtn}
            onPress={() => void startRecording()}
            disabled={recordingBusy}
            accessibilityRole="button"
            accessibilityLabel="Record your first clip"
          >
            <Ionicons name="videocam-outline" size={32} color={colors.brandNavy} />
          </Pressable>
          <Text style={styles.emptyTitle}>No captured clips yet</Text>
          <Text style={styles.emptySub}>
            Tap the camera on the left or the record button below to capture your first clip.
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.listHeading}>Your recordings ({clips.length})</Text>
          <FlashList
            data={clips}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={[styles.list, { paddingBottom: fabBottom + 72 }]}
            showsVerticalScrollIndicator={false}
            {...FLASHLIST_PERF_DEFAULTS}
          />
        </>
      )}

      <Pressable
        style={[styles.fab, { bottom: fabBottom, left: space.lg }]}
        onPress={() => void startRecording()}
        disabled={recordingBusy}
        accessibilityRole="button"
        accessibilityLabel="Record new clip"
      >
        <Ionicons name="videocam" size={28} color="#fff" />
      </Pressable>

      <ClipUploadPrepareModal
        visible={prepareVisible && !!pendingAsset}
        video={pendingAsset}
        thumbUri={thumbUri}
        thumbBusy={thumbBusy}
        onClose={() => {
          setPrepareVisible(false);
          setPendingAsset(null);
          setThumbUri(null);
        }}
        onReplaceVideo={() => void startRecording()}
        onThumbChange={setThumbUri}
        onConfirm={({ video }: PreparedClipUpload) => {
          setPendingAsset(video);
          setPrepareVisible(false);
          setLabelModalVisible(true);
          haptics.success();
        }}
      />

      <CaptureQuickLabelModal
        visible={labelModalVisible}
        defaultLabel={defaultLabel}
        busy={saving}
        onCancel={() => {
          if (saving) return;
          setLabelModalVisible(false);
          setPendingAsset(null);
          setThumbUri(null);
        }}
        onSave={(label) => void saveLabeledClip(label)}
      />

      <LockerViewerModal
        visible={!!viewerClip && !selectMode}
        onClose={() => setViewerClip(null)}
        uri={viewerClip?.uri ?? ""}
        title={viewerClip?.label?.trim() || "Captured clip"}
        mode="video"
        onDeleteClip={
          viewerClip
            ? async () => {
                await deleteCapturedClip(userId, viewerClip.id);
                setViewerClip(null);
                void load();
                haptics.success();
                Alert.alert("Deleted", "Clip removed from your device.");
              }
            : undefined
        }
        onShareExternal={
          viewerClip
            ? () => {
                haptics.tap();
                setShareSheetVisible(true);
              }
            : undefined
        }
        shareAccessibilityLabel="Share captured clip"
      />

      <CapturedShareSheet
        visible={shareSheetVisible}
        onClose={() => setShareSheetVisible(false)}
        onSelect={openShareTarget}
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
  recordIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
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
    alignItems: "flex-start",
    justifyContent: "center",
    gap: space.md,
    padding: space.xl,
  },
  emptyRecordBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#eff6ff",
    borderWidth: 2,
    borderColor: "#bfdbfe",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  emptySub: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20 },
  fab: {
    position: "absolute",
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
