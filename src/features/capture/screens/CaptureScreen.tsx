import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, space } from "../../../theme";

const CAPTURED_CLIPS_KEY = "@netqwix/captured_clips";

export type CapturedClip = {
  id: string;
  uri: string;
  createdAt: string;
  durationSecs?: number;
};

export async function getCapturedClips(): Promise<CapturedClip[]> {
  try {
    const raw = await AsyncStorage.getItem(CAPTURED_CLIPS_KEY);
    return raw ? (JSON.parse(raw) as CapturedClip[]) : [];
  } catch {
    return [];
  }
}

export async function saveCapturedClip(clip: CapturedClip): Promise<void> {
  const existing = await getCapturedClips();
  existing.unshift(clip);
  await AsyncStorage.setItem(CAPTURED_CLIPS_KEY, JSON.stringify(existing));
}

export async function deleteCapturedClip(id: string): Promise<void> {
  const existing = await getCapturedClips();
  const updated = existing.filter((c) => c.id !== id);
  await AsyncStorage.setItem(CAPTURED_CLIPS_KEY, JSON.stringify(updated));
}

export function CaptureScreen() {
  const navigation = useNavigation<any>();
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [facing, setFacing] = useState<"front" | "back">("back");
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasPermissions = cameraPermission?.granted && micPermission?.granted;

  const requestPermissions = useCallback(async () => {
    if (!cameraPermission?.granted) await requestCameraPermission();
    if (!micPermission?.granted) await requestMicPermission();
  }, [cameraPermission, micPermission, requestCameraPermission, requestMicPermission]);

  const startRecording = useCallback(async () => {
    if (!cameraRef.current || recording) return;
    try {
      setRecording(true);
      setElapsedSecs(0);
      timerRef.current = setInterval(() => setElapsedSecs((s) => s + 1), 1000);
      const result = await cameraRef.current.recordAsync({ maxDuration: 120 });
      if (result?.uri) {
        setSaving(true);
        const id = `capture_${Date.now()}`;
        await saveCapturedClip({
          id,
          uri: result.uri,
          createdAt: new Date().toISOString(),
          durationSecs: elapsedSecs,
        });
        setSaving(false);
        Alert.alert("Saved!", "Clip saved to your Captured Library.", [
          {
            text: "View Library",
            onPress: () => navigation.navigate("CapturedLibrary"),
          },
          { text: "Record Another" },
        ]);
      }
    } catch (err) {
      Alert.alert("Recording failed", "Could not save the video.");
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecording(false);
      setSaving(false);
    }
  }, [recording, elapsedSecs, navigation]);

  const stopRecording = useCallback(() => {
    cameraRef.current?.stopRecording();
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  if (!hasPermissions) {
    return (
      <SafeAreaView style={styles.permWrap}>
        <Ionicons name="camera-outline" size={56} color={colors.brandNavy} />
        <Text style={styles.permTitle}>Camera Access Required</Text>
        <Text style={styles.permSub}>
          To record clips, Netqwix needs access to your camera and microphone.
        </Text>
        <Pressable style={styles.permBtn} onPress={requestPermissions}>
          <Text style={styles.permBtnText}>Grant Access</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        mode="video"
      />

      {/* Timer overlay */}
      {recording && (
        <View style={styles.timerBadge}>
          <View style={styles.recDot} />
          <Text style={styles.timerText}>{formatTime(elapsedSecs)}</Text>
        </View>
      )}

      {/* Top controls */}
      <SafeAreaView style={styles.topBar}>
        <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={26} color="#fff" />
        </Pressable>
        <Pressable
          style={styles.iconBtn}
          onPress={() => navigation.navigate("CapturedLibrary")}
        >
          <Ionicons name="film-outline" size={24} color="#fff" />
          <Text style={styles.iconBtnLabel}>Library</Text>
        </Pressable>
      </SafeAreaView>

      {/* Bottom controls */}
      <View style={styles.bottomBar}>
        <Pressable
          style={styles.flipBtn}
          onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))}
          disabled={recording}
        >
          <Ionicons name="camera-reverse-outline" size={26} color="#fff" />
        </Pressable>

        <Pressable
          style={[styles.recordBtn, recording && styles.recordBtnActive]}
          onPress={recording ? stopRecording : startRecording}
          disabled={saving}
        >
          <View style={recording ? styles.stopIcon : styles.recordIcon} />
        </Pressable>

        <View style={{ width: 48 }} />
      </View>

      <Text style={styles.hint}>
        {recording ? "Tap to stop" : "Tap to record • Max 2 minutes"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  camera: { ...StyleSheet.absoluteFillObject },
  permWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.lg,
    gap: space.md,
    backgroundColor: "#fff",
  },
  permTitle: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  permSub: { fontSize: 14, color: "#666", textAlign: "center", lineHeight: 20 },
  permBtn: {
    marginTop: space.sm,
    backgroundColor: colors.brandNavy,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  permBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  timerBadge: {
    position: "absolute",
    top: 100,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ef4444",
  },
  timerText: { color: "#fff", fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"] },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
  iconBtn: {
    alignItems: "center",
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 30,
  },
  iconBtnLabel: { color: "#fff", fontSize: 10, marginTop: 2 },
  bottomBar: {
    position: "absolute",
    bottom: 60,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 48,
    paddingHorizontal: space.lg,
  },
  flipBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  recordBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  recordBtnActive: {
    borderColor: "#ef4444",
  },
  recordIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#ef4444",
  },
  stopIcon: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: "#ef4444",
  },
  hint: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
  },
});
