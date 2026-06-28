import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import { FlashList } from "@shopify/flash-list";
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../auth/context/AuthContext";
import { useGuestMode } from "../../auth/hooks/useGuestMode";
import { useRequireAuth } from "../../auth/hooks/useRequireAuth";
import { LockerViewerModal } from "../../dashboard/components/locker/LockerViewerModal";
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
  backfillCapturedClipThumbnails,
  type CapturedClip,
  capturedClipFileExists,
} from "../capturedClipsStorage";
import type * as ImagePicker from "expo-image-picker";
import { promptImportCapturedVideo } from "../pickCapturedVideo";
import * as VideoThumbnails from "expo-video-thumbnails";
import { floatingTabBarBottomInset } from "../../../navigation/FloatingTabBar";
import type { CaptureStackParamList } from "../../../navigation/CaptureNavigator";
import { FLASHLIST_PERF_DEFAULTS } from "../../../lib/lists/flatListPerf";
import { haptics } from "../../../lib/haptics";
import { colors, radii, space, typography } from "../../../theme";

export function CapturedLibraryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<CaptureStackParamList>>();
  const route = useRoute<RouteProp<CaptureStackParamList, "CapturedLibrary">>();
  const uploadForFriend = route.params?.uploadForFriend;
  const { user } = useAuth();
  const isGuest = useGuestMode();
  const { requireAuth } = useRequireAuth();
  const userId = user?._id != null ? String(user._id) : null;
  const [clips, setClips] = useState<CapturedClip[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewerClip, setViewerClip] = useState<CapturedClip | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [shareClip, setShareClip] = useState<CapturedClip | null>(null);
  const [labelModalVisible, setLabelModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingThumbUri, setPendingThumbUri] = useState<string | null>(null);
  const [pendingAsset, setPendingAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [defaultLabel, setDefaultLabel] = useState("");

  const load = useCallback(async () => {
    const c = await backfillCapturedClipThumbnails(userId);
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
      setPendingThumbUri(capture.thumbUri);
      setDefaultLabel("");
      setLabelModalVisible(true);
    },
    []
  );

  const onImportVideo = useCallback(() => {
    promptImportCapturedVideo((asset) => {
      void (async () => {
        let thumbUri: string | null = null;
        try {
          const thumb = await VideoThumbnails.getThumbnailAsync(asset.uri, { time: 500 });
          thumbUri = thumb.uri;
        } catch {
          /* no thumb */
        }
        setPendingAsset(asset);
        setPendingThumbUri(thumbUri);
        setDefaultLabel("");
        setLabelModalVisible(true);
      })();
    });
  }, []);

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
          thumbUri: pendingThumbUri ?? undefined,
        });
        setLabelModalVisible(false);
        setPendingAsset(null);
        setPendingThumbUri(null);
        haptics.success();
        void load();
      } catch {
        Alert.alert("Error", "Could not save the clip. Please try again.");
      } finally {
        setSaving(false);
      }
    },
    [load, pendingAsset, pendingThumbUri, userId]
  );

  const selectedClips = useMemo(
    () => clips.filter((c) => selected.has(c.id)),
    [clips, selected]
  );

  const capturePlaylist = useMemo(
    () =>
      clips.map((clip) => ({
        uri: clip.uri,
        title: clip.label?.trim() || "Captured clip",
        mode: "video" as const,
      })),
    [clips]
  );

  const openViewer = useCallback((clip: CapturedClip) => {
    void (async () => {
      const exists = await capturedClipFileExists(clip.uri);
      if (!exists) {
        Alert.alert(
          "Clip unavailable",
          "This recording is no longer on your device. Remove it from the list and capture again."
        );
        return;
      }
      const idx = clips.findIndex((row) => row.id === clip.id);
      setViewerIndex(idx >= 0 ? idx : 0);
      setViewerClip(clip);
    })();
  }, [clips]);

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
    if (shareClip) return [shareClip];
    if (viewerClip) return [viewerClip];
    return [];
  };

  const navigateToUpload = (target: CapturedShareTarget, clipList: CapturedClip[]) => {
    if (clipList.length === 0) {
      Alert.alert("Select a clip", "Tap a clip to preview, or long-press to select multiple.");
      return;
    }
    if (isGuest) {
      requireAuth(undefined, {
        intent: "capture_upload",
        messageKey: "guest.signInToContinue",
        screen: "SignUp",
      });
      return;
    }
    haptics.tap();
    navigation.navigate("CapturedClipUpload", {
      clips: clipList,
      shareTarget: target,
      showPrepareStep: clipList.length === 1,
      uploadForFriend,
    });
    setShareSheetVisible(false);
    setShareClip(null);
    exitSelectMode();
  };

  const openShareTarget = (target: CapturedShareTarget) => {
    navigateToUpload(target, pickClipsForShare());
  };

  const openUploadForClip = (clip: CapturedClip) => {
    haptics.tap();
    if (uploadForFriend) {
      navigateToUpload("my-clips", [clip]);
      return;
    }
    setShareClip(clip);
    setShareSheetVisible(true);
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
          openViewer(item);
        }}
        onLongPress={() => {
          haptics.impact();
          if (!selectMode) setSelectMode(true);
          toggleSelect(item.id);
        }}
        accessibilityRole="button"
        accessibilityLabel={selectMode ? "Toggle selection" : "Play clip"}
      >
        {selectMode ? (
          <View style={[styles.check, isSelected && styles.checkOn]}>
            {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.shareArrow, pressed && styles.shareArrowPressed]}
            onPress={() => openUploadForClip(item)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Open sharing options"
          >
            <Ionicons name="chevron-forward" size={18} color={colors.brandNavy} />
          </Pressable>
        )}
        <View style={styles.thumb}>
          {item.thumbUri ? (
            <Image source={{ uri: item.thumbUri }} style={styles.thumbImage} resizeMode="cover" />
          ) : null}
          <View style={styles.thumbPlay}>
            <Ionicons name="play" size={16} color="#fff" />
          </View>
        </View>
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
          <Ionicons name="play-circle-outline" size={22} color="#cbd5e1" />
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
          <View style={styles.headerActions}>
            <Pressable
              style={styles.headerAction}
              onPress={onImportVideo}
              accessibilityRole="button"
              accessibilityLabel="Import video"
            >
              <Ionicons name="cloud-upload-outline" size={22} color={colors.brandNavy} />
            </Pressable>
            <Pressable
              style={styles.headerAction}
              onPress={() => {
                haptics.tap();
                setSelectMode(true);
              }}
              disabled={clips.length === 0}
              accessibilityRole="button"
              accessibilityLabel="Select clips"
            >
              <Ionicons name="checkbox-outline" size={22} color={colors.brandNavy} />
            </Pressable>
          </View>
        )}
      </View>

      {selectMode && selected.size === 0 ? (
        <View style={styles.selectHintBar}>
          <Text style={styles.selectHintText}>
            Long-press clips to select, then share or delete.
          </Text>
        </View>
      ) : null}

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
          <View style={styles.emptyIconWrap}>
            <Ionicons name="videocam" size={44} color={colors.brandNavy} />
          </View>
          <Text style={styles.emptyTitle}>Capture your first clip</Text>
          <Text style={styles.emptySub}>
            Record technique, drills, or progress — then keep them private or share with
            friends and coaches in a tap.
          </Text>
          <View style={styles.emptyFeatures}>
            <View style={styles.emptyFeatureRow}>
              <Ionicons name="lock-closed-outline" size={16} color="#16a34a" />
              <Text style={styles.emptyFeatureText}>Saved privately on your device</Text>
            </View>
            <View style={styles.emptyFeatureRow}>
              <Ionicons name="cloud-upload-outline" size={16} color={colors.brandNavy} />
              <Text style={styles.emptyFeatureText}>Import existing videos anytime</Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [styles.emptyPrimaryBtn, pressed && { opacity: 0.9 }]}
            onPress={() => void startRecording()}
            disabled={recordingBusy}
            accessibilityRole="button"
            accessibilityLabel="Record your first clip"
          >
            <Ionicons name="videocam" size={20} color="#fff" />
            <Text style={styles.emptyPrimaryText}>
              {recordingBusy ? "Opening camera…" : "Record a clip"}
            </Text>
          </Pressable>
          <Pressable style={styles.emptyImportBtn} onPress={onImportVideo}>
            <Ionicons name="cloud-upload-outline" size={18} color={colors.brandNavy} />
            <Text style={styles.emptyImportText}>Import from gallery</Text>
          </Pressable>
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

      {clips.length > 0 ? (
        <Pressable
          style={[styles.fab, { bottom: fabBottom, left: space.lg }]}
          onPress={() => void startRecording()}
          disabled={recordingBusy}
          accessibilityRole="button"
          accessibilityLabel="Record new clip"
        >
          <Ionicons name="videocam" size={28} color="#fff" />
        </Pressable>
      ) : null}

      <CaptureQuickLabelModal
        visible={labelModalVisible}
        defaultLabel={defaultLabel}
        busy={saving}
        onCancel={() => {
          if (saving) return;
          setLabelModalVisible(false);
          setPendingAsset(null);
          setPendingThumbUri(null);
        }}
        onSave={(label) => void saveLabeledClip(label)}
      />

      <LockerViewerModal
        visible={!!viewerClip && !selectMode}
        videoStartPaused
        onClose={() => setViewerClip(null)}
        uri={viewerClip?.uri ?? ""}
        title={viewerClip?.label?.trim() || "Captured clip"}
        mode="video"
        playlist={capturePlaylist}
        initialIndex={viewerIndex}
        onIndexChange={(idx) => {
          setViewerIndex(idx);
          const next = clips[idx];
          if (next) setViewerClip(next);
        }}
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
        onClose={() => {
          setShareSheetVisible(false);
          setShareClip(null);
        }}
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
  headerActions: { flexDirection: "row", alignItems: "center" },
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
  shareArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  shareArrowPressed: { backgroundColor: "#dbeafe" },
  selectHintBar: {
    marginHorizontal: space.md,
    marginBottom: space.sm,
    padding: space.sm,
    borderRadius: radii.md,
    backgroundColor: "#eff6ff",
  },
  selectHintText: { ...typography.bodySm, color: colors.brandNavy },
  thumb: {
    width: 56,
    height: 56,
    marginLeft: space.xs,
    borderRadius: radii.md,
    backgroundColor: "#1e293b",
    overflow: "hidden",
    position: "relative",
  },
  thumbImage: {
    ...StyleSheet.absoluteFillObject,
  },
  thumbPlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  clipMeta: { flex: 1 },
  clipDate: { fontSize: 14, fontWeight: "600", color: "#111827" },
  clipDur: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingHorizontal: space.xl,
  },
  emptyIconWrap: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "#eff6ff",
    borderWidth: 2,
    borderColor: "#bfdbfe",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.sm,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  emptySub: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 320,
  },
  emptyFeatures: {
    gap: 8,
    marginTop: space.sm,
    marginBottom: space.md,
    alignItems: "center",
  },
  emptyFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyFeatureText: { fontSize: 13, color: "#475569", fontWeight: "500" },
  emptyPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "stretch",
    maxWidth: 320,
    paddingVertical: 15,
    borderRadius: radii.pill,
    backgroundColor: colors.brandNavy,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyPrimaryText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  emptyImportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: space.xs,
    alignSelf: "stretch",
    maxWidth: 320,
    paddingHorizontal: space.md,
    paddingVertical: 13,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.brandNavy,
  },
  emptyImportText: { color: colors.brandNavy, fontWeight: "700" },
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
