import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import {
  MediaLoadingOverlay,
  MediaViewerChrome,
  NativeMediaSurface,
} from "../../../../components/media";
import { useMediaViewport } from "../../../../components/media/useMediaViewport";
import { isLikelyPdf } from "../../../../lib/clipMediaUrl";
import { colors, space } from "../../../../theme";

export type LockerViewerMode = "video" | "pdf" | "image";

type Props = {
  visible: boolean;
  onClose: () => void;
  uri: string;
  title?: string;
  mode: LockerViewerMode;
  sharedBy?: string;
};

function buildPdfEmbedUrl(url: string): string {
  return `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(url)}`;
}

const HEADER_BLOCK = 72;
const FOOTER_BLOCK = 36;

export function LockerViewerModal({ visible, onClose, uri, title, mode, sharedBy }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height: mediaHeight } = useMediaViewport({
    headerHeight: HEADER_BLOCK + insets.top,
    footerHeight: FOOTER_BLOCK + insets.bottom,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      setError(false);
    }
  }, [visible, uri, mode]);

  const resolvedMode: LockerViewerMode = useMemo(() => {
    if (mode === "pdf") return "pdf";
    if (mode === "image" && isLikelyPdf(uri)) return "pdf";
    if (mode === "video") return "video";
    if (isLikelyPdf(uri)) return "pdf";
    return mode;
  }, [mode, uri]);

  const nativeMode = resolvedMode === "video" ? "video" : "image";

  const openExternally = useCallback(async () => {
    try {
      const can = await Linking.canOpenURL(uri);
      if (!can) {
        Alert.alert("Cannot open link", "No app on the device can open this file.");
        return;
      }
      await Linking.openURL(uri);
    } catch {
      Alert.alert("Failed to open", "Could not launch the system browser for this file.");
    }
  }, [uri]);

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
          onOpenExternal={openExternally}
        />

        {error ? (
          <View style={[styles.center, { width, height: mediaHeight }]}>
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
        ) : resolvedMode === "pdf" ? (
          <View style={{ width, height: mediaHeight }}>
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
        ) : (
          <NativeMediaSurface
            uri={uri}
            mode={nativeMode}
            width={width}
            height={mediaHeight}
            isActive={visible}
            loadingMode="parent"
            onLoadingChange={setLoading}
            useNativeVideoControls={false}
            showCustomControls={nativeMode === "video"}
            onReady={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
          />
        )}

        {loading && !error ? (
          <MediaLoadingOverlay
            message={resolvedMode === "video" ? "Loading video" : "Loading preview"}
          />
        ) : null}

        <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
          <Text style={styles.footerText}>
            {resolvedMode === "video"
              ? "Use player controls to scrub · Pinch-friendly fullscreen"
              : resolvedMode === "pdf"
                ? "PDF preview · Open externally if it doesn’t render"
                : "Pinch to zoom in system viewer when opened externally"}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  fill: { flex: 1, backgroundColor: "#000" },
  center: {
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
  footer: {
    paddingHorizontal: space.md,
    paddingTop: space.xs,
    backgroundColor: "rgba(0,0,0,0.85)",
  },
  footerText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
    textAlign: "center",
  },
});
