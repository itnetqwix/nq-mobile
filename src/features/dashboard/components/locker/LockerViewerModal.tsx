import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { colors, space } from "../../../../theme";
import { isLikelyPdf } from "../../../../lib/clipMediaUrl";

export type LockerViewerMode = "video" | "pdf" | "image";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Absolute URL (S3, R2, or https image/PDF). */
  uri: string;
  title?: string;
  mode: LockerViewerMode;
};

function buildVideoHtml(src: string): string {
  const safe = src.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <style>html,body{margin:0;padding:0;background:#000;height:100%;} video{width:100%;height:100%;object-fit:contain;background:#000;}</style>
</head>
<body>
  <video controls playsinline webkit-playsinline src="${safe}"></video>
</body>
</html>`;
}

/**
 * Try the Mozilla PDF.js CDN viewer as the primary PDF embed. It tolerates a wider range
 * of CORS configurations than `docs.google.com/gviewer` (which silently fails on private
 * or non-public-cors S3 URLs — the original "save plan can't open" symptom).
 */
function buildPdfEmbedUrl(url: string): string {
  return `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(url)}`;
}

/** Image fallback HTML — guarantees content-fit + dark background even when WebView opens raw image. */
function buildImageHtml(src: string): string {
  const safe = src.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=yes" />
  <style>html,body{margin:0;padding:0;background:#000;height:100%;display:flex;align-items:center;justify-content:center;}img{max-width:100%;max-height:100%;object-fit:contain;}</style>
</head>
<body>
  <img src="${safe}" />
</body>
</html>`;
}

export function LockerViewerModal({ visible, onClose, uri, title, mode }: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  /** Reset the error/loading state every time a new file is opened. */
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

  const source = useMemo(() => {
    if (!uri) return null;
    if (resolvedMode === "video") {
      return { html: buildVideoHtml(uri), baseUrl: undefined } as const;
    }
    if (resolvedMode === "pdf") {
      return { uri: buildPdfEmbedUrl(uri) } as const;
    }
    return { html: buildImageHtml(uri) } as const;
  }, [uri, resolvedMode]);

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

  if (!visible || !source) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.chrome, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topBar}>
          <Text style={styles.title} numberOfLines={1}>
            {title ?? "Preview"}
          </Text>

          {/* Web parity: an explicit "open externally" affordance — many PDFs and S3 videos
              render better in Safari / Chrome / a system PDF reader than embedded. */}
          <Pressable onPress={openExternally} style={styles.iconBtn} hitSlop={10}>
            <Ionicons name="open-outline" size={22} color="#fff" />
          </Pressable>
          <Pressable onPress={onClose} style={styles.iconBtn} hitSlop={12}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
        </View>
        <Text style={styles.hint}>
          {resolvedMode === "pdf"
            ? "Tap the arrow icon to open in your browser if the preview doesn't load."
            : "Opens inside the app — tap the arrow to open in your browser."}
        </Text>

        {error ? (
          <View style={styles.centerMsg}>
            <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
            <Text style={styles.errText}>Could not load this file inside the app.</Text>
            <Pressable onPress={openExternally} style={styles.openExtBtn}>
              <Ionicons name="open-outline" size={18} color="#fff" />
              <Text style={styles.openExtText}>Open in browser</Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.openExtBtnAlt}>
              <Text style={styles.openExtTextAlt}>Close</Text>
            </Pressable>
          </View>
        ) : (
          <WebView
            source={source as any}
            style={styles.web}
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
        )}

        {loading && !error && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.brandNavy} />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  chrome: { flex: 1, backgroundColor: "#000" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingBottom: 6,
    gap: space.sm,
  },
  title: { flex: 1, fontSize: 16, fontWeight: "700", color: "#fff" },
  iconBtn: { padding: 4 },
  hint: {
    fontSize: 11,
    color: "#9ca3af",
    paddingHorizontal: space.md,
    marginBottom: 4,
  },
  web: { flex: 1, backgroundColor: "#000" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  centerMsg: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: space.lg,
    gap: space.sm,
  },
  errText: { color: "#fca5a5", textAlign: "center", fontSize: 15 },
  openExtBtn: {
    marginTop: space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.brandNavy,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8,
  },
  openExtText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  openExtBtnAlt: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#374151",
  },
  openExtTextAlt: { color: "#cbd5f5", fontWeight: "600", fontSize: 13 },
});
