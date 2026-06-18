import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import PagerView from "react-native-pager-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import {
  MediaLoadingOverlay,
  MediaViewerChrome,
  NativeMediaSurface,
} from "../../../../components/media";
import { isLikelyAudio, isLikelyPdf } from "../../../../lib/clipMediaUrl";
import { downloadVideoToLibrary } from "../../../../lib/media/downloadVideoToLibrary";
import { openPdfWithSystemFallback } from "../../../../lib/openPdfExternally";
import { resolvePdfForViewing } from "../../../../lib/resolvePdfForViewing";
import { LockerAudioPlayer } from "./LockerAudioPlayer";
import { colors, space } from "../../../../theme";

export type LockerViewerMode = "video" | "pdf" | "image" | "audio";

export type LockerViewerPlaylistItem = {
  uri: string;
  title?: string;
  clipId?: string;
  sharedBy?: string;
  canRemove?: boolean;
  mode?: LockerViewerMode;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  uri: string;
  title?: string;
  mode: LockerViewerMode;
  sharedBy?: string;
  clipId?: string;
  playlist?: LockerViewerPlaylistItem[];
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
  onDeleteClip?: () => void;
  deleteBusy?: boolean;
  deleteAccessibilityLabel?: string;
  onRemoveFromLocker?: () => void;
  removeBusy?: boolean;
  removeAccessibilityLabel?: string;
  onShareExternal?: () => void;
  shareAccessibilityLabel?: string;
  onShareFriends?: () => void;
  shareFriendsAccessibilityLabel?: string;
};

export function LockerViewerModal({
  visible,
  onClose,
  uri,
  title,
  mode,
  sharedBy,
  clipId,
  playlist,
  initialIndex = 0,
  onIndexChange,
  onDeleteClip,
  deleteBusy,
  deleteAccessibilityLabel = "Delete clip",
  onRemoveFromLocker,
  removeBusy,
  removeAccessibilityLabel = "Remove from locker",
  onShareExternal,
  shareAccessibilityLabel = "Share",
  onShareFriends,
  shareFriendsAccessibilityLabel = "Share with friends",
}: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const pagerRef = useRef<PagerView>(null);
  const [mediaHeight, setMediaHeight] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [pdfLocalUri, setPdfLocalUri] = useState<string | null>(null);
  const [pdfAccessUrl, setPdfAccessUrl] = useState<string | null>(null);

  const items = useMemo<LockerViewerPlaylistItem[]>(() => {
    if (playlist?.length) return playlist;
    if (!uri) return [];
    return [{ uri, title, clipId, sharedBy, mode }];
  }, [playlist, uri, title, clipId, sharedBy, mode]);

  const current = items[activeIndex] ?? items[0];
  const currentUri = current?.uri ?? uri;
  const currentTitle = current?.title ?? title;
  const currentMode = current?.mode ?? mode;
  const currentSharedBy = current?.sharedBy ?? sharedBy;
  const currentClipId = current?.clipId ?? clipId;
  const canSwipe = items.length > 1 && currentMode === "video";

  const resolvedMode: LockerViewerMode = useMemo(() => {
    if (currentMode === "audio" || isLikelyAudio(currentUri)) return "audio";
    if (currentMode === "pdf") return "pdf";
    if (currentMode === "image" && isLikelyPdf(currentUri)) return "pdf";
    if (currentMode === "video") return "video";
    if (isLikelyPdf(currentUri)) return "pdf";
    return currentMode;
  }, [currentMode, currentUri]);

  const nativeMode = resolvedMode === "video" ? "video" : "image";

  useEffect(() => {
    if (visible) {
      const next = Math.min(Math.max(0, initialIndex), Math.max(0, items.length - 1));
      setActiveIndex(next);
      pagerRef.current?.setPageWithoutAnimation?.(next);
      setError(false);
      setLoading(currentMode !== "audio" && !isLikelyAudio(currentUri));
    }
  }, [visible, initialIndex, items.length, currentUri, currentMode]);

  useEffect(() => {
    if (!visible) return;
    setError(false);
    setLoading(currentMode !== "audio" && !isLikelyAudio(currentUri));
  }, [activeIndex, visible, currentUri, currentMode]);

  useEffect(() => {
    if (!visible || resolvedMode !== "pdf" || !currentUri) {
      setPdfLocalUri(null);
      setPdfAccessUrl(null);
      return;
    }

    let cancelled = false;
    setPdfLocalUri(null);
    setPdfAccessUrl(null);
    setLoading(true);
    setError(false);

    void (async () => {
      try {
        const resolved = await resolvePdfForViewing(currentUri);
        if (cancelled) return;
        setPdfLocalUri(resolved.localUri);
        setPdfAccessUrl(resolved.accessUrl);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setLoading(false);
          setError(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, resolvedMode, currentUri]);

  const goToIndex = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(0, next), items.length - 1);
      setActiveIndex(clamped);
      onIndexChange?.(clamped);
      pagerRef.current?.setPage(clamped);
    },
    [items.length, onIndexChange]
  );

  const openExternally = useCallback(async () => {
    if (resolvedMode === "pdf") {
      const opened = await openPdfWithSystemFallback(
        pdfLocalUri,
        pdfAccessUrl,
        currentUri
      );
      if (opened) return;
      Alert.alert("Failed to open", "Could not open this PDF on your device.");
      return;
    }

    const webUrl = currentClipId
      ? `https://netqwix.com/clips/${encodeURIComponent(currentClipId)}`
      : currentUri;
    try {
      const can = await Linking.canOpenURL(webUrl);
      if (!can) {
        Alert.alert("Cannot open link", "No app on the device can open this file.");
        return;
      }
      await Linking.openURL(webUrl);
    } catch {
      Alert.alert("Failed to open", "Could not launch the system browser for this file.");
    }
  }, [resolvedMode, pdfLocalUri, pdfAccessUrl, currentUri, currentClipId]);

  const confirmDownload = useCallback(() => {
    Alert.alert(
      "Save to library",
      "Download this video to your device photo library?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Download",
          onPress: () => {
            setDownloading(true);
            void downloadVideoToLibrary({
              uri: currentUri,
              title: currentTitle,
              onSuccess: () => {
                Alert.alert("Saved", "The video was saved to your photo library.");
              },
              onError: (message) => {
                Alert.alert("Download failed", message);
              },
            }).finally(() => setDownloading(false));
          },
        },
      ]
    );
  }, [currentUri, currentTitle]);

  const confirmDelete = useCallback(() => {
    if (!onDeleteClip) return;
    Alert.alert("Delete clip", "Delete this clip? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: onDeleteClip },
    ]);
  }, [onDeleteClip]);

  const confirmRemove = useCallback(() => {
    if (!onRemoveFromLocker) return;
    Alert.alert(
      "Remove from locker",
      "Remove this shared clip from your locker?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: onRemoveFromLocker },
      ]
    );
  }, [onRemoveFromLocker]);

  const confirmShareFriends = useCallback(() => {
    if (!onShareFriends) return;
    Alert.alert(
      "Share with friends",
      "Send this clip to NetQwix friends?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Continue", onPress: onShareFriends },
      ]
    );
  }, [onShareFriends]);

  if (!visible || !currentUri) return null;

  const subtitle = currentSharedBy ? `Shared by ${currentSharedBy}` : undefined;
  const positionLabel =
    canSwipe ? `${activeIndex + 1} / ${items.length}` : undefined;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" />
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <MediaViewerChrome
          title={currentTitle ?? "Preview"}
          subtitle={positionLabel ? `${positionLabel}${subtitle ? ` · ${subtitle}` : ""}` : subtitle}
          onClose={onClose}
          onOpenExternal={resolvedMode === "pdf" ? openExternally : undefined}
          rightSlot={
            <View style={styles.actions}>
              {resolvedMode === "video" ? (
                <Pressable
                  onPress={confirmDownload}
                  style={styles.iconBtn}
                  hitSlop={10}
                  disabled={downloading}
                  accessibilityRole="button"
                  accessibilityLabel="Download video"
                >
                  {downloading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="download-outline" size={22} color="#fff" />
                  )}
                </Pressable>
              ) : null}
              {onShareFriends ? (
                <Pressable
                  onPress={confirmShareFriends}
                  style={styles.iconBtn}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={shareFriendsAccessibilityLabel}
                >
                  <Ionicons name="people-outline" size={22} color="#fff" />
                </Pressable>
              ) : null}
              {onShareExternal ? (
                <Pressable
                  onPress={onShareExternal}
                  style={styles.iconBtn}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={shareAccessibilityLabel}
                >
                  <Ionicons name="share-outline" size={22} color="#fff" />
                </Pressable>
              ) : null}
              {onDeleteClip ? (
                <Pressable
                  onPress={confirmDelete}
                  style={styles.iconBtn}
                  hitSlop={10}
                  disabled={deleteBusy}
                  accessibilityRole="button"
                  accessibilityLabel={deleteAccessibilityLabel}
                >
                  {deleteBusy ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="trash-outline" size={22} color={colors.dangerTextOn} />
                  )}
                </Pressable>
              ) : null}
              {onRemoveFromLocker ? (
                <Pressable
                  onPress={confirmRemove}
                  style={styles.iconBtn}
                  hitSlop={10}
                  disabled={removeBusy}
                  accessibilityRole="button"
                  accessibilityLabel={removeAccessibilityLabel}
                >
                  {removeBusy ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="trash-outline" size={22} color={colors.dangerTextOn} />
                  )}
                </Pressable>
              ) : null}
            </View>
          }
        />

        <View
          style={styles.mediaHost}
          onLayout={(e) => setMediaHeight(e.nativeEvent.layout.height)}
        >
          {error ? (
            <View style={styles.center}>
              <Ionicons name="alert-circle-outline" size={44} color={colors.danger} />
              <Text style={styles.errTitle}>Couldn&apos;t load preview</Text>
              <Text style={styles.errBody}>
                Try opening in your browser or check your connection.
              </Text>
              <Pressable onPress={openExternally} style={styles.primaryBtn}>
                <Ionicons name="open-outline" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Open in browser</Text>
              </Pressable>
            </View>
          ) : resolvedMode === "audio" ? (
            <View style={styles.audioWrap}>
              <LockerAudioPlayer uri={currentUri} title={currentTitle} />
            </View>
          ) : resolvedMode === "pdf" ? (
            <View style={styles.fill}>
              {pdfLocalUri ? (
                <WebView
                  source={{ uri: pdfLocalUri }}
                  style={styles.fill}
                  onLoadStart={() => {
                    setLoading(true);
                    setError(false);
                  }}
                  onLoadEnd={() => setLoading(false)}
                  onError={() => {
                    setLoading(false);
                    void openPdfWithSystemFallback(pdfLocalUri, pdfAccessUrl, currentUri).then(
                      (opened) => {
                        if (!opened) setError(true);
                      }
                    );
                  }}
                  onHttpError={() => {
                    setLoading(false);
                    void openPdfWithSystemFallback(pdfLocalUri, pdfAccessUrl, currentUri).then(
                      (opened) => {
                        if (!opened) setError(true);
                      }
                    );
                  }}
                  allowsInlineMediaPlayback
                  mediaPlaybackRequiresUserAction={false}
                  originWhitelist={["*"]}
                  javaScriptEnabled
                  domStorageEnabled
                />
              ) : null}
            </View>
          ) : canSwipe && mediaHeight > 0 ? (
            <PagerView
              ref={pagerRef}
              style={styles.fill}
              initialPage={activeIndex}
              onPageSelected={(e) => {
                const next = e.nativeEvent.position;
                setActiveIndex(next);
                onIndexChange?.(next);
              }}
            >
              {items.map((item, pageIndex) => (
                <View key={`${item.uri}-${pageIndex}`} style={styles.fill}>
                  <NativeMediaSurface
                    uri={item.uri}
                    mode="video"
                    width={screenWidth}
                    height={mediaHeight}
                    isActive={visible && activeIndex === pageIndex}
                    loadingMode="parent"
                    loadingOverlayVariant="minimal"
                    onLoadingChange={pageIndex === activeIndex ? setLoading : undefined}
                    useNativeVideoControls={false}
                    showCustomControls
                    onReady={() => {
                      if (pageIndex === activeIndex) setLoading(false);
                    }}
                    onError={() => {
                      if (pageIndex === activeIndex) {
                        setLoading(false);
                        setError(true);
                      }
                    }}
                  />
                </View>
              ))}
            </PagerView>
          ) : mediaHeight > 0 ? (
            <NativeMediaSurface
              uri={currentUri}
              mode={nativeMode}
              width={screenWidth}
              height={mediaHeight}
              isActive={visible}
              loadingMode="parent"
              loadingOverlayVariant="minimal"
              onLoadingChange={setLoading}
              useNativeVideoControls={false}
              showCustomControls={nativeMode === "video"}
              onReady={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError(true);
              }}
            />
          ) : null}

          {canSwipe ? (
            <>
              {activeIndex > 0 ? (
                <Pressable
                  style={[styles.navBtn, styles.navBtnLeft]}
                  onPress={() => goToIndex(activeIndex - 1)}
                  accessibilityRole="button"
                  accessibilityLabel="Previous video"
                >
                  <Ionicons name="chevron-back" size={28} color="#fff" />
                </Pressable>
              ) : null}
              {activeIndex < items.length - 1 ? (
                <Pressable
                  style={[styles.navBtn, styles.navBtnRight]}
                  onPress={() => goToIndex(activeIndex + 1)}
                  accessibilityRole="button"
                  accessibilityLabel="Next video"
                >
                  <Ionicons name="chevron-forward" size={28} color="#fff" />
                </Pressable>
              ) : null}
            </>
          ) : null}

          {loading && !error && resolvedMode !== "audio" ? (
            <MediaLoadingOverlay
              message={resolvedMode === "video" ? "Loading video…" : "Loading preview"}
              variant={resolvedMode === "video" ? "minimal" : "branded"}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  fill: { flex: 1, backgroundColor: "#000" },
  mediaHost: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#000",
  },
  audioWrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: space.lg,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: space.lg,
    gap: space.sm,
  },
  errTitle: { color: "#fff", fontSize: 17, fontWeight: "700", textAlign: "center" },
  errBody: { color: "#9ca3af", fontSize: 14, textAlign: "center", lineHeight: 20 },
  primaryBtn: {
    marginTop: space.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.brandNavy,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  actions: { flexDirection: "row", gap: 2, alignItems: "center" },
  iconBtn: { padding: 4 },
  navBtn: {
    position: "absolute",
    top: "45%",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  navBtnLeft: { left: space.sm },
  navBtnRight: { right: space.sm },
});
