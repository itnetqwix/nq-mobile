import React, { useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../navigation/types";
import { getAccessToken, getAccountType } from "../../auth/session/tokenStorage";

const NAVY = "#000080";
const WEB_ORIGIN = "https://www.netqwix.com";

type Props = NativeStackScreenProps<RootStackParamList, "Meeting">;

export function MeetingScreen({ navigation, route }: Props) {
  const { lessonId } = route.params;
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);

  React.useEffect(() => {
    (async () => {
      const [t, at] = await Promise.all([getAccessToken(), getAccountType()]);
      setToken(t);
      setAccountType(at);
    })();
  }, []);

  const meetingUrl = `${WEB_ORIGIN}/meeting?lessonId=${lessonId}`;

  const injectedJS = token
    ? `
      try {
        localStorage.setItem('token', ${JSON.stringify(token)});
        localStorage.setItem('acc_type', ${JSON.stringify(accountType ?? "")});
      } catch(e) {}
      true;
    `
    : "true;";

  if (!token) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={NAVY} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.leaveBtn}>
          <Ionicons name="exit-outline" size={20} color="#dc2626" />
          <Text style={styles.leaveBtnText}>Leave</Text>
        </Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>Live Session</Text>
        <View style={{ width: 72 }} />
      </View>

      <WebView
        ref={webViewRef}
        source={{ uri: meetingUrl }}
        injectedJavaScriptBeforeContentLoaded={injectedJS}
        style={styles.webview}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        javaScriptEnabled
        domStorageEnabled
        allowsFullscreenVideo
        mediaCapturePermissionGrantType={
          Platform.OS === "ios" ? "grantIfSameHostElsePrompt" : undefined
        }
        onError={(e) => console.warn("[Meeting] WebView error", e.nativeEvent)}
      />

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={NAVY} />
          <Text style={styles.loadingText}>Connecting to session…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  leaveBtn: { flexDirection: "row", alignItems: "center", gap: 4, width: 72 },
  leaveBtnText: { fontSize: 14, fontWeight: "700", color: "#dc2626" },
  topBarTitle: { fontSize: 15, fontWeight: "700", color: "#fff", flex: 1, textAlign: "center" },
  webview: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: { fontSize: 15, color: "#fff" },
});
