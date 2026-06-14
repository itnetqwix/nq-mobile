import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import {
  MediaLoadingOverlay,
  MediaViewerChrome,
  NativeMediaSurface,
} from "../../../../components/media";
import { isLikelyAudio, isLikelyPdf } from "../../../../lib/clipMediaUrl";
import { downloadVideoToLibrary } from "../../../../lib/media/downloadVideoToLibrary";
import { LockerAudioPlayer } from "./LockerAudioPlayer";
import { colors, space } from "../../../../theme";

export type LockerViewerMode = "video" | "pdf" | "image" | "audio";

type Props = {
  visible: boolean;
  onClose: () => void;
  uri: string;
  title?: string;
  mode: LockerViewerMode;
  sharedBy?: string;
  clipId?: string;
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

function buildPdfEmbedUrl(url: string): string {
  return `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(url)}`;
}

export function LockerViewerModal({
  visible,
  onClose,
  uri,
  title,
  mode,
  sharedBy,
  clipId,
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
  const [mediaHeight, setMediaHeight] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (visible) {
      setError(false);
      setLoading(mode !== "audio" && !isLikelyAudio(uri));
    }
  }, [visible, uri, mode]);

  const resolvedMode: LockerViewerMode = useMemo(() => {
    if (mode === "audio" || isLikelyAudio(uri)) return "audio";
    if (mode === "pdf") return "pdf";
    if (mode === "image" && isLikelyPdf(uri)) return "pdf";
    if (mode === "video") return "video";
    if (isLikelyPdf(uri)) return "pdf";
    return mode;
  }, [mode, uri]);

  const nativeMode = resolvedMode === "video" ? "video" : "image";

  const openExternally = useCallback(async () => {
    const webUrl = clipId
      ? `https://netqwix.com/clips/${encodeURIComponent(clipId)}`
      : uri;
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
  }, [uri, clipId]);

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
              uri,
              title,
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
  }, [uri, title]);

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

  if (!visible || !uri) return null;

  const subtitle = sharedBy ? `Shared by ${sharedBy}` : undefined;

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
          title={title ?? "Preview"}
          subtitle={subtitle}
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
              <LockerAudioPlayer uri={uri} title={title} />
            </View>
          ) : resolvedMode === "pdf" ? (
            <View style={styles.fill}>
              <WebView
                source={{ uri: buildPdfEmbedUrl(uri) }}
                style={styles.fill}
                onLoadStart={() => {
                  setLoading(true);
                  setError(false);
                }}
                onLoadEnd={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setError(true);
                }}
                onHttpError={() => {
                  setLoading(false);
                  setError(true);
                }}
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                originWhitelist={["*"]}
                javaScriptEnabled
                domStorageEnabled
              />
            </View>
          ) : mediaHeight > 0 ? (
            <NativeMediaSurface
              uri={uri}
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
});
