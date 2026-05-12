import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { colors, space } from "../../../../theme/tokens";
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

function googlePdfEmbed(url: string): string {
  return `https://docs.google.com/gviewer?embedded=true&url=${encodeURIComponent(url)}`;
}

export function LockerViewerModal({ visible, onClose, uri, title, mode }: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const source = useMemo(() => {
    if (!uri) return null;
    if (mode === "video") {
      return { html: buildVideoHtml(uri), baseUrl: undefined } as const;
    }
    if (mode === "pdf" || (mode === "image" && isLikelyPdf(uri))) {
      return { uri: googlePdfEmbed(uri) } as const;
    }
    return { uri } as const;
  }, [uri, mode]);

  if (!visible || !source) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.chrome, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topBar}>
          <Text style={styles.title} numberOfLines={1}>
            {title ?? "Preview"}
          </Text>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Ionicons name="close" size={28} color={colors.text} />
          </Pressable>
        </View>
        <Text style={styles.hint}>Opens inside the app — not the external browser.</Text>

        {error ? (
          <View style={styles.centerMsg}>
            <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
            <Text style={styles.errText}>Could not load this file. Try again later.</Text>
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
  closeBtn: { padding: 4 },
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
});
