import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { colors, radii, space, typography } from "../../../theme";

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
  const [saving, setSaving] = useState(false);

  const recordVideo = useCallback(async () => {
    // Request camera + mic permissions via expo-image-picker
    const { status: camStatus } = await ImagePicker.requestCameraPermissionsAsync();
    if (camStatus !== "granted") {
      Alert.alert(
        "Camera Access Required",
        "Please grant camera access in Settings to record clips.",
        [{ text: "OK" }]
      );
      return;
    }

    // Launch native camera in video mode (max 2 minutes)
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["videos"],
      videoMaxDuration: 120,
      allowsEditing: false,
      quality: 1,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    if (!asset?.uri) return;

    setSaving(true);
    try {
      const id = `capture_${Date.now()}`;
      const durationSecs = asset.duration != null ? Math.round(asset.duration) : undefined;
      await saveCapturedClip({
        id,
        uri: asset.uri,
        createdAt: new Date().toISOString(),
        durationSecs,
      });
      Alert.alert("Saved!", "Clip saved to your Captured Library.", [
        {
          text: "View Library",
          onPress: () => navigation.navigate("CapturedLibrary"),
        },
        { text: "Record Another" },
      ]);
    } catch {
      Alert.alert("Error", "Could not save the clip. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [navigation]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.brandNavy} />
        </Pressable>
        <Text style={styles.title}>Capture</Text>
        <Pressable
          style={styles.libraryBtn}
          onPress={() => navigation.navigate("CapturedLibrary")}
        >
          <Ionicons name="film-outline" size={20} color={colors.brandNavy} />
          <Text style={styles.libraryBtnText}>Library</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.iconCircle}>
          <Ionicons name="videocam" size={56} color={colors.brandNavy} />
        </View>

        <Text style={styles.heading}>Record a Training Clip</Text>
        <Text style={styles.sub}>
          Your device camera opens in video mode. Record up to 2 minutes and the clip is saved to your Captured Library.
        </Text>

        <Pressable
          style={[styles.recordBtn, saving && styles.recordBtnDisabled]}
          onPress={recordVideo}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Record video"
        >
          {saving ? (
            <Ionicons name="cloud-upload-outline" size={22} color="#fff" />
          ) : (
            <Ionicons name="videocam-outline" size={22} color="#fff" />
          )}
          <Text style={styles.recordBtnText}>
            {saving ? "Saving…" : "Start Recording"}
          </Text>
        </Pressable>

        <Pressable
          style={styles.libraryLink}
          onPress={() => navigation.navigate("CapturedLibrary")}
        >
          <Text style={styles.libraryLinkText}>View Captured Library</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.brandNavy} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  backBtn: { padding: 4 },
  title: { flex: 1, ...typography.subtitle, marginLeft: space.sm },
  libraryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brandNavy,
  },
  libraryBtnText: { fontSize: 13, fontWeight: "600", color: colors.brandNavy },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
    gap: space.md,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#eff6ff",
    borderWidth: 2,
    borderColor: "#bfdbfe",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.sm,
  },
  heading: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  sub: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 300,
  },
  recordBtn: {
    marginTop: space.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.brandNavy,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: radii.pill,
  },
  recordBtnDisabled: { opacity: 0.6 },
  recordBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  libraryLink: {
    marginTop: space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  libraryLinkText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.brandNavy,
  },
});
