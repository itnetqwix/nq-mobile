import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as VideoThumbnails from "expo-video-thumbnails";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccountType } from "../../../../constants/accountType";
import { fetchSportCategories } from "../../../auth/api/masterApi";
import { useAuth } from "../../../auth/context/AuthContext";
import { postClipUploadSignUrls } from "../../../home/api/homeApi";
import { getApiErrorMessage } from "../../../../lib/http/getApiErrorMessage";
import { putFileToPresignedUrl } from "../../../../lib/presignedPut";
import { colors, radii, space } from "../../../../theme";

const SHARE_MY_CLIPS = "My Clips";

type Props = {
  visible: boolean;
  onClose: () => void;
  onUploaded: () => void;
};

export function ClipUploadModal({ visible, onClose, onUploaded }: Props) {
  const insets = useSafeAreaInsets();
  const { user, accountType } = useAuth();
  const isTrainer = accountType === AccountType.TRAINER;

  const profileCategory = useMemo(() => {
    const c = user?.category ?? (user as any)?.Category;
    return typeof c === "string" ? c.trim() : "";
  }, [user]);

  const [videoAsset, setVideoAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [thumbUri, setThumbUri] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [categorySel, setCategorySel] = useState("");
  const [thumbBusy, setThumbBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [thumbProgress, setThumbProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<"idle" | "video" | "thumb" | "finalize">("idle");

  const { data: categories = [], isLoading: catLoading } = useQuery<string[]>({
    queryKey: ["sportCategories"],
    queryFn: fetchSportCategories,
    enabled: visible,
    staleTime: 300_000,
  });

  useEffect(() => {
    if (!visible) {
      setVideoAsset(null);
      setThumbUri(null);
      setTitle("");
      setCategorySel("");
      setThumbBusy(false);
      setUploadBusy(false);
      setVideoProgress(0);
      setThumbProgress(0);
      setUploadPhase("idle");
    }
  }, [visible]);

  useEffect(() => {
    if (visible && isTrainer && profileCategory) {
      setCategorySel(profileCategory);
    }
  }, [visible, isTrainer, profileCategory]);

  const effectiveCategory = useMemo(() => {
    if (isTrainer && profileCategory) return profileCategory;
    return categorySel.trim();
  }, [isTrainer, profileCategory, categorySel]);

  const videoMime = videoAsset?.mimeType ?? "video/mp4";

  const pickVideo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow access to your photo library to choose a video.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      allowsMultipleSelection: false,
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setVideoAsset(asset);
    const base = (asset.fileName ?? "clip").replace(/\.[^/.]+$/, "");
    setTitle(base || "Clip");
    setThumbUri(null);
    setThumbBusy(true);
    try {
      const durationSec = asset.duration ?? 2;
      const timeMs = Math.min(
        60_000,
        Math.max(250, Math.floor((durationSec / 2) * 1000))
      );
      const { uri } = await VideoThumbnails.getThumbnailAsync(asset.uri, {
        time: timeMs,
        quality: 0.85,
      });
      setThumbUri(uri);
    } catch (e) {
      Alert.alert("Preview", getApiErrorMessage(e, "Could not create a thumbnail for this video."));
      setVideoAsset(null);
      setTitle("");
    } finally {
      setThumbBusy(false);
    }
  };

  const canSubmit =
    !!videoAsset &&
    !!thumbUri &&
    title.trim().length > 0 &&
    effectiveCategory.length > 0 &&
    !thumbBusy &&
    !uploadBusy;

  const submit = async () => {
    if (!videoAsset || !thumbUri || !canSubmit) return;
    setUploadBusy(true);
    setVideoProgress(0);
    setThumbProgress(0);
    setUploadPhase("finalize");
    try {
      const data = await postClipUploadSignUrls({
        clips: [
          {
            filename: videoAsset.fileName ?? "clip.mp4",
            fileType: videoMime,
            thumbnail: "image/jpeg",
            title: title.trim(),
            category: effectiveCategory,
          },
        ],
        shareOptions: { type: SHARE_MY_CLIPS },
      });
      const row = data.results?.[0];
      if (!row?.url || !row.thumbnailURL) {
        throw new Error(data.message ?? "Server did not return upload URLs.");
      }
      setUploadPhase("video");
      await putFileToPresignedUrl(row.url, videoAsset.uri, videoMime, ({ percent }) => {
        setVideoProgress(percent);
      });
      setUploadPhase("thumb");
      await putFileToPresignedUrl(row.thumbnailURL, thumbUri, "image/jpeg", ({ percent }) => {
        setThumbProgress(percent);
      });
      setUploadPhase("finalize");
      Alert.alert("Uploaded", "Your clip is in your locker. It may take a moment to appear in the list.");
      onUploaded();
      onClose();
    } catch (e) {
      Alert.alert("Upload failed", getApiErrorMessage(e));
    } finally {
      setUploadBusy(false);
      setUploadPhase("idle");
    }
  };

  const showCategoryPicker = !isTrainer || !profileCategory;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top + 8}
      >
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.headerTitle}>Upload clip</Text>
          <Pressable onPress={onClose} hitSlop={12} disabled={uploadBusy}>
            <Ionicons name="close" size={28} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.lead}>
            Same flow as the website: pick a video from your device, add a title and sport, then we upload the file and
            a thumbnail to your locker.
          </Text>

          <Pressable
            style={({ pressed }) => [styles.pickBtn, pressed && { opacity: 0.9 }]}
            onPress={pickVideo}
            disabled={thumbBusy || uploadBusy}
          >
            <Ionicons name="folder-open-outline" size={22} color={colors.brandNavy} />
            <Text style={styles.pickBtnText}>{videoAsset ? "Replace video" : "Choose video"}</Text>
          </Pressable>

          {thumbBusy && (
            <View style={styles.rowCenter}>
              <ActivityIndicator color={colors.brandNavy} />
              <Text style={styles.muted}>Preparing preview…</Text>
            </View>
          )}

          {!!thumbUri && (
            <View style={styles.previewBox}>
              <Image source={{ uri: thumbUri }} style={styles.previewImg} resizeMode="cover" />
              <Text style={styles.fileMeta} numberOfLines={1}>
                {videoAsset?.fileName ?? "Video"} · {videoMime}
              </Text>
            </View>
          )}

          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Clip title"
            placeholderTextColor={colors.textMuted}
            editable={!uploadBusy}
          />

          {isTrainer && !!profileCategory && (
            <View style={styles.categoryReadonly}>
              <Text style={styles.label}>Sport (from your profile)</Text>
              <Text style={styles.profileCat}>{profileCategory}</Text>
            </View>
          )}

          {showCategoryPicker && (
            <>
              <Text style={styles.label}>Sport / category</Text>
              {catLoading ? (
                <ActivityIndicator color={colors.brandNavy} style={{ marginVertical: space.sm }} />
              ) : (
                <View style={styles.chips}>
                  {categories.map((c) => {
                    const on = categorySel === c;
                    return (
                      <Pressable
                        key={c}
                        style={[styles.chip, on && styles.chipOn]}
                        onPress={() => setCategorySel(c)}
                        disabled={uploadBusy}
                      >
                        <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
                          {c}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </>
          )}

          {uploadBusy && (
            <View style={styles.progressBlock}>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>
                  {uploadPhase === "video"
                    ? "Uploading video…"
                    : uploadPhase === "thumb"
                    ? "Uploading thumbnail…"
                    : "Preparing upload…"}
                </Text>
                <Text style={styles.progressPercent}>
                  {uploadPhase === "video"
                    ? `${videoProgress}%`
                    : uploadPhase === "thumb"
                    ? `${thumbProgress}%`
                    : ""}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${
                        uploadPhase === "video"
                          ? videoProgress
                          : uploadPhase === "thumb"
                          ? thumbProgress
                          : 4
                      }%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressHint}>
                Keep the app open until the upload completes.
              </Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.submit,
              (!canSubmit || pressed) && { opacity: canSubmit ? 0.9 : 0.45 },
            ]}
            onPress={submit}
            disabled={!canSubmit}
          >
            {uploadBusy ? (
              <ActivityIndicator color={colors.brandTextOn} />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={20} color={colors.brandTextOn} />
                <Text style={styles.submitText}>Upload to locker</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: colors.brandNavy },
  body: { padding: space.md, paddingBottom: space.xl * 2, gap: space.md },
  lead: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  pickBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingVertical: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brandNavy,
    backgroundColor: colors.sidebarActiveBg,
  },
  pickBtnText: { fontSize: 16, fontWeight: "700", color: colors.brandNavy },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: space.sm },
  muted: { fontSize: 13, color: colors.textMuted },
  previewBox: { alignItems: "center", gap: space.sm },
  previewImg: {
    width: "100%",
    height: 160,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  fileMeta: { fontSize: 12, color: colors.textMuted },
  label: { fontSize: 13, fontWeight: "700", color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  categoryReadonly: { gap: 4 },
  profileCat: { fontSize: 16, fontWeight: "600", color: colors.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    maxWidth: "100%",
  },
  chipOn: { borderColor: colors.brandNavy, backgroundColor: colors.sidebarActiveBg },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.text },
  chipTextOn: { color: colors.brandNavy },
  submit: {
    marginTop: space.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brandNavy,
    paddingVertical: 14,
    borderRadius: radii.md,
  },
  submitText: { fontSize: 16, fontWeight: "700", color: colors.brandTextOn },
  progressBlock: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: space.md,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressLabel: { fontSize: 13, fontWeight: "600", color: colors.text },
  progressPercent: { fontSize: 13, fontWeight: "700", color: colors.brandNavy, minWidth: 44, textAlign: "right" },
  progressTrack: {
    width: "100%",
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: colors.brandNavy, borderRadius: 4 },
  progressHint: { fontSize: 11, color: colors.textMuted, fontStyle: "italic" },
});
