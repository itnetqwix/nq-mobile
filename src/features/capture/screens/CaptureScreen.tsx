import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as VideoThumbnails from "expo-video-thumbnails";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { colors, radii, space, typography } from "../../../theme";
import { useAuth } from "../../auth/context/AuthContext";
import { saveCapturedClip } from "../capturedClipsStorage";
import { CaptureQuickLabelModal } from "../components/CaptureQuickLabelModal";
import {
  ClipUploadPrepareModal,
  type PreparedClipUpload,
} from "../../dashboard/components/locker/ClipUploadPrepareModal";
import { haptics } from "../../../lib/haptics";

async function resolveFileSize(uri: string, reported?: number | null): Promise<number | undefined> {
  if (typeof reported === "number" && reported > 0) return reported;
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    if (info.exists && "size" in info && typeof info.size === "number" && info.size > 0) {
      return info.size;
    }
  } catch {
    /* size unknown */
  }
  return undefined;
}

function defaultClipLabel(): string {
  return `Clip ${new Date().toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function CaptureScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const userId = user?._id != null ? String(user._id) : null;
  const [saving, setSaving] = useState(false);
  const [labelModalVisible, setLabelModalVisible] = useState(false);
  const [prepareVisible, setPrepareVisible] = useState(false);
  const [thumbUri, setThumbUri] = useState<string | null>(null);
  const [thumbBusy, setThumbBusy] = useState(false);
  const [pendingAsset, setPendingAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [defaultLabel, setDefaultLabel] = useState(defaultClipLabel());

  const saveLabeledClip = useCallback(
    async (label: string) => {
      if (!pendingAsset?.uri) return;
      setSaving(true);
      try {
        const id = `capture_${Date.now()}`;
        const durationSecs =
          pendingAsset.duration != null ? Math.round(pendingAsset.duration) : undefined;
        const fileSizeBytes = await resolveFileSize(pendingAsset.uri, pendingAsset.fileSize);
        await saveCapturedClip(userId, {
          id,
          uri: pendingAsset.uri,
          createdAt: new Date().toISOString(),
          label,
          durationSecs,
          fileSizeBytes,
          mimeType: pendingAsset.mimeType ?? "video/mp4",
        });
        setLabelModalVisible(false);
        setPrepareVisible(false);
        setPendingAsset(null);
        setThumbUri(null);
        haptics.success();
        navigation.goBack();
      } catch {
        Alert.alert("Error", "Could not save the clip. Please try again.");
      } finally {
        setSaving(false);
      }
    },
    [navigation, pendingAsset, userId]
  );

  const recordVideo = useCallback(async () => {
    haptics.tap();
    const { status: camStatus } = await ImagePicker.requestCameraPermissionsAsync();
    if (camStatus !== "granted") {
      haptics.error();
      Alert.alert(
        "Camera Access Required",
        "Please grant camera access in Settings to record clips.",
        [{ text: "OK" }]
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["videos"],
      videoMaxDuration: 120,
      allowsEditing: Platform.OS === "ios",
      quality: 1,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    if (!asset?.uri) return;

    haptics.success();
    setPendingAsset(asset);
    setDefaultLabel(defaultClipLabel());
    setThumbUri(null);
    setThumbBusy(true);
    try {
      const durationSec = asset.duration ?? 2;
      const timeMs = Math.min(60_000, Math.max(250, Math.floor((durationSec / 2) * 1000)));
      const { uri } = await VideoThumbnails.getThumbnailAsync(asset.uri, {
        time: timeMs,
        quality: 0.85,
      });
      setThumbUri(uri);
    } catch {
      /* thumbnail optional */
    } finally {
      setThumbBusy(false);
    }
    setPrepareVisible(true);
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => { haptics.tap(); navigation.goBack(); }}>
          <Ionicons name="arrow-back" size={24} color={colors.brandNavy} />
        </Pressable>
        <Text style={styles.title}>Record clip</Text>
        <View style={styles.topSpacer} />
      </View>

      <View style={styles.body}>
        <View style={styles.iconCircle}>
          <Ionicons name="videocam" size={56} color={colors.brandNavy} />
        </View>

        <Text style={styles.heading}>Record a training clip</Text>
        <Text style={styles.sub}>
          Record up to 2 minutes, add a quick label, then keep recording more. Upload and share from your library when you are ready.
        </Text>

        <Pressable
          style={[styles.recordBtn, saving && styles.recordBtnDisabled]}
          onPress={recordVideo}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Record video"
        >
          <Ionicons name="videocam-outline" size={22} color="#fff" />
          <Text style={styles.recordBtnText}>Start recording</Text>
        </Pressable>
      </View>

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
        onReplaceVideo={recordVideo}
        onThumbChange={setThumbUri}
        onConfirm={({ video }: PreparedClipUpload) => {
          setPendingAsset(video);
          setPrepareVisible(false);
          setLabelModalVisible(true);
          haptics.success();
        }}
      />
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
  topSpacer: { width: 32 },
  title: { flex: 1, ...typography.subtitle, marginLeft: space.sm, textAlign: "center" },
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
});
