import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
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
import { fetchFriends, fetchStorageInfo, uploadLockerClip } from "../../../home/api/homeApi";
import { lockerMutated } from "../../../../store/actions/cacheInvalidation";
import { useAppDispatch } from "../../../../store/hooks";
import { MAX_CLIP_FILE_BYTES, formatStorageMb } from "../../../../lib/storageLimits";
import { queryKeys } from "../../../../lib/queryKeys";
import { getApiErrorMessage } from "../../../../lib/http/getApiErrorMessage";
import { apiClient } from "../../../../api/client";
import { API_ROUTES } from "../../../../config/apiRoutes";
import { colors, radii, space } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";

const SHARE_MY_CLIPS = "My Clips";
const SHARE_FRIENDS = "Friends";

type ShareTarget = typeof SHARE_MY_CLIPS | typeof SHARE_FRIENDS;

type Props = {
  visible: boolean;
  onClose: () => void;
  onUploaded: () => void;
};

export function ClipUploadModal({ visible, onClose, onUploaded }: Props) {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
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
  const [shareTarget, setShareTarget] = useState<ShareTarget>(SHARE_MY_CLIPS);
  const [selectedFriendEmails, setSelectedFriendEmails] = useState<string[]>([]);

  const { data: categories = [], isLoading: catLoading } = useQuery<string[]>({
    queryKey: queryKeys.master.sportCategories,
    queryFn: fetchSportCategories,
    enabled: visible,
    staleTime: 300_000,
  });

  const { data: friendsList = [] } = useQuery<any[]>({
    queryKey: queryKeys.friends.forClipShare,
    queryFn: fetchFriends,
    enabled: visible && shareTarget === SHARE_FRIENDS,
    staleTime: 60_000,
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
      setShareTarget(SHARE_MY_CLIPS);
      setSelectedFriendEmails([]);
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
      Alert.alert(t("locker.permissionTitle"), t("locker.permissionLibrary"));
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
    setTitle(base || t("locker.clipDefault"));
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
      Alert.alert(
        t("locker.previewErrorTitle"),
        getApiErrorMessage(e, t("locker.previewError"))
      );
      setVideoAsset(null);
      setTitle("");
    } finally {
      setThumbBusy(false);
    }
  };

  const toggleFriend = (email: string) => {
    setSelectedFriendEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  };

  const canSubmit =
    !!videoAsset &&
    !!thumbUri &&
    title.trim().length > 0 &&
    effectiveCategory.length > 0 &&
    !thumbBusy &&
    !uploadBusy &&
    (shareTarget === SHARE_MY_CLIPS || selectedFriendEmails.length > 0);

  const submit = async () => {
    if (!videoAsset || !thumbUri || !canSubmit) return;
    let fileBytes = videoAsset.fileSize ?? 0;
    if (fileBytes <= 0) {
      try {
        const info = await FileSystem.getInfoAsync(videoAsset.uri, { size: true });
        if (info.exists && "size" in info && typeof info.size === "number") {
          fileBytes = info.size;
        }
      } catch {
        /* size unknown */
      }
    }
    if (fileBytes <= 0) {
      Alert.alert(t("locker.uploadFailedTitle"), t("locker.clipSizeUnknown"));
      return;
    }
    if (fileBytes > MAX_CLIP_FILE_BYTES) {
      Alert.alert(
        t("locker.clipTooLargeTitle"),
        t("locker.clipTooLargeBody", { max: formatStorageMb(MAX_CLIP_FILE_BYTES) })
      );
      return;
    }

    try {
      const storage = await fetchStorageInfo();
      if (storage.usedBytes + fileBytes > storage.quotaBytes) {
        Alert.alert(
          t("locker.storageFullTitle"),
          t("locker.storageFullBody"),
          [{ text: t("common.ok") }]
        );
        return;
      }
    } catch {
      /* proceed if storage endpoint unavailable */
    }

    setUploadBusy(true);
    setVideoProgress(0);
    setThumbProgress(0);
    setUploadPhase("video");
    try {
      const { clipId } = await uploadLockerClip({
        videoUri: videoAsset.uri,
        videoMime,
        videoSizeBytes: fileBytes > 0 ? fileBytes : 1,
        thumbUri,
        title: title.trim(),
        category: effectiveCategory,
        shareOptions:
          shareTarget === SHARE_FRIENDS
            ? { type: SHARE_FRIENDS, emails: selectedFriendEmails }
            : { type: SHARE_MY_CLIPS },
        onVideoProgress: (percent) => {
          setUploadPhase("video");
          setVideoProgress(percent);
        },
        onThumbProgress: (percent) => {
          setUploadPhase("thumb");
          setThumbProgress(percent);
        },
      });
      setUploadPhase("finalize");

      if (clipId) {
        apiClient.post(API_ROUTES.ai.tagClip(String(clipId))).catch(() => {});
      }

      Alert.alert(t("locker.uploadedTitle"), t("locker.uploadedBody"));
      dispatch(lockerMutated());
      onUploaded();
      onClose();
    } catch (e) {
      Alert.alert(t("locker.uploadFailedTitle"), getApiErrorMessage(e));
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
          <Text style={styles.headerTitle}>{t("locker.uploadTitle")}</Text>
          <Pressable onPress={onClose} hitSlop={12} disabled={uploadBusy}>
            <Ionicons name="close" size={28} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.lead}>{t("locker.uploadLead")}</Text>

          <Pressable
            style={({ pressed }) => [styles.pickBtn, pressed && { opacity: 0.9 }]}
            onPress={pickVideo}
            disabled={thumbBusy || uploadBusy}
          >
            <Ionicons name="folder-open-outline" size={22} color={colors.brandNavy} />
            <Text style={styles.pickBtnText}>
              {videoAsset ? t("locker.replaceVideo") : t("locker.chooseVideo")}
            </Text>
          </Pressable>

          {thumbBusy && (
            <View style={styles.rowCenter}>
              <ActivityIndicator color={colors.brandNavy} />
              <Text style={styles.muted}>{t("locker.preparingPreview")}</Text>
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

          <Text style={styles.label}>{t("locker.titleLabel")}</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder={t("locker.titlePlaceholder")}
            placeholderTextColor={colors.textMuted}
            editable={!uploadBusy}
          />

          {isTrainer && !!profileCategory && (
            <View style={styles.categoryReadonly}>
              <Text style={styles.label}>{t("locker.sportFromProfile")}</Text>
              <Text style={styles.profileCat}>{profileCategory}</Text>
            </View>
          )}

          {showCategoryPicker && (
            <>
              <Text style={styles.label}>{t("locker.sportCategory")}</Text>
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

          <Text style={styles.label}>{t("locker.shareTo")}</Text>
          <View style={styles.shareTargetRow}>
            <Pressable
              style={[styles.shareTargetBtn, shareTarget === SHARE_MY_CLIPS && styles.shareTargetBtnOn]}
              onPress={() => setShareTarget(SHARE_MY_CLIPS)}
              disabled={uploadBusy}
            >
              <Ionicons name="folder-outline" size={16} color={shareTarget === SHARE_MY_CLIPS ? colors.brandNavy : colors.textMuted} />
              <Text style={[styles.shareTargetText, shareTarget === SHARE_MY_CLIPS && styles.shareTargetTextOn]}>
                {t("locker.shareMyClips")}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.shareTargetBtn, shareTarget === SHARE_FRIENDS && styles.shareTargetBtnOn]}
              onPress={() => setShareTarget(SHARE_FRIENDS)}
              disabled={uploadBusy}
            >
              <Ionicons name="people-outline" size={16} color={shareTarget === SHARE_FRIENDS ? colors.brandNavy : colors.textMuted} />
              <Text style={[styles.shareTargetText, shareTarget === SHARE_FRIENDS && styles.shareTargetTextOn]}>
                {t("locker.shareFriends")}
              </Text>
            </Pressable>
          </View>

          {shareTarget === SHARE_FRIENDS && (
            <View style={styles.friendPickerBox}>
              <Text style={styles.label}>{t("locker.selectFriends")}</Text>
              {friendsList.length === 0 ? (
                <Text style={styles.muted}>{t("locker.noFriendsForShare")}</Text>
              ) : (
                <View style={styles.friendChips}>
                  {friendsList.map((f: any) => {
                    const email = f?.email ?? f?.receiverId?.email ?? "";
                    const name = f?.fullname ?? f?.receiverId?.fullname ?? f?.fullName ?? email;
                    if (!email) return null;
                    const on = selectedFriendEmails.includes(email);
                    return (
                      <Pressable
                        key={email}
                        style={[styles.chip, on && styles.chipOn]}
                        onPress={() => toggleFriend(email)}
                        disabled={uploadBusy}
                      >
                        <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>{name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
              {selectedFriendEmails.length > 0 && (
                <Text style={styles.muted}>
                  {t("locker.friendsSelected", { count: selectedFriendEmails.length })}
                </Text>
              )}
            </View>
          )}

          {uploadBusy && (
            <View style={styles.progressBlock}>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>
                  {uploadPhase === "video"
                    ? t("locker.uploadingVideo")
                    : uploadPhase === "thumb"
                    ? t("locker.uploadingThumbnail")
                    : t("locker.preparingUpload")}
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
              <Text style={styles.progressHint}>{t("locker.keepAppOpen")}</Text>
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
                <Text style={styles.submitText}>{t("locker.uploadToLocker")}</Text>
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
  shareTargetRow: { flexDirection: "row", gap: 10 },
  shareTargetBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  shareTargetBtnOn: {
    borderColor: colors.brandNavy,
    backgroundColor: colors.sidebarActiveBg,
  },
  shareTargetText: { fontSize: 14, fontWeight: "600", color: colors.textMuted },
  shareTargetTextOn: { color: colors.brandNavy },
  friendPickerBox: { gap: space.sm },
  friendChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
