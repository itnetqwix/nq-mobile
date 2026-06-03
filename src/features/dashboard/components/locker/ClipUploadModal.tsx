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
import { fetchClipTaxonomy } from "../../../clips/api/clipsApi";
import { useAuth } from "../../../auth/context/AuthContext";
import { fetchFriends, fetchStorageInfo, uploadLockerClip } from "../../../home/api/homeApi";
import { lockerMutated } from "../../../../store/actions/cacheInvalidation";
import { useAppDispatch } from "../../../../store/hooks";
import { MAX_CLIP_FILE_BYTES, formatStorageMb } from "../../../../lib/storageLimits";
import { queryKeys } from "../../../../lib/queryKeys";
import { getApiErrorMessage } from "../../../../lib/http/getApiErrorMessage";
import { apiClient } from "../../../../api/client";
import { API_ROUTES } from "../../../../config/apiRoutes";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { ClipUploadPrepareModal } from "./ClipUploadPrepareModal";

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
  const c = useThemeColors();
  const styles = useStyles();
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
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [thumbBusy, setThumbBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [thumbProgress, setThumbProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<"idle" | "video" | "thumb" | "finalize">("idle");
  const [shareTarget, setShareTarget] = useState<ShareTarget>(SHARE_MY_CLIPS);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [prepareVisible, setPrepareVisible] = useState(false);

  const { data: taxonomy, isLoading: catLoading } = useQuery({
    queryKey: queryKeys.clips.taxonomy,
    queryFn: fetchClipTaxonomy,
    enabled: visible,
    staleTime: 300_000,
  });

  const categories = taxonomy?.categories ?? [];
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const subcategories = selectedCategory?.subcategories ?? [];

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
      setCategoryId("");
      setSubcategoryId("");
      setThumbBusy(false);
      setUploadBusy(false);
      setVideoProgress(0);
      setThumbProgress(0);
      setUploadPhase("idle");
      setShareTarget(SHARE_MY_CLIPS);
      setSelectedFriendIds([]);
      setPrepareVisible(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !isTrainer || !profileCategory || !taxonomy) return;
    const match = taxonomy.categories.find(
      (c) => c.name.toLowerCase() === profileCategory.toLowerCase()
    );
    if (match) setCategoryId(match.id);
  }, [visible, isTrainer, profileCategory, taxonomy]);

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
      allowsEditing: Platform.OS === "ios",
      videoMaxDuration: 300,
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
      setPrepareVisible(true);
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

  const toggleFriend = (friendId: string) => {
    setSelectedFriendIds((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
    );
  };

  const canSubmit =
    !!videoAsset &&
    !!thumbUri &&
    title.trim().length > 0 &&
    categoryId.length > 0 &&
    subcategoryId.length > 0 &&
    !thumbBusy &&
    !uploadBusy &&
    (shareTarget === SHARE_MY_CLIPS || selectedFriendIds.length > 0);

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
        category: selectedCategory?.name ?? profileCategory,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        shareOptions:
          shareTarget === SHARE_FRIENDS
            ? { type: SHARE_FRIENDS, friends: selectedFriendIds }
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

      Alert.alert(
        t("locker.uploadedTitle"),
        shareTarget === SHARE_FRIENDS ? t("locker.uploadSharedBody") : t("locker.uploadedBody")
      );
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
        <View style={[styles.header, { paddingTop: Math.max(insets.top, space.md) }]}>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>{t("locker.uploadTitle")}</Text>
            <Text style={styles.headerSub}>{t("locker.uploadLead")}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} disabled={uploadBusy}>
            <Ionicons name="close" size={26} color={c.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 100 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            style={({ pressed }) => [styles.pickBtn, pressed && { opacity: 0.9 }]}
            onPress={pickVideo}
            disabled={thumbBusy || uploadBusy}
          >
            <Ionicons name="folder-open-outline" size={22} color={c.brandNavy} />
            <Text style={styles.pickBtnText}>
              {videoAsset ? t("locker.replaceVideo") : t("locker.chooseVideo")}
            </Text>
          </Pressable>

          {thumbBusy && (
            <View style={styles.rowCenter}>
              <ActivityIndicator color={c.brandNavy} />
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

          <View style={styles.formCard}>
          <Text style={styles.label}>{t("locker.titleLabel")}</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder={t("locker.titlePlaceholder")}
            placeholderTextColor={c.textMuted}
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
                <ActivityIndicator color={c.brandNavy} style={{ marginVertical: space.sm }} />
              ) : (
                <View style={styles.chips}>
                  {categories.map((cat) => {
                    const on = categoryId === cat.id;
                    return (
                      <Pressable
                        key={cat.id}
                        style={[styles.chip, on && styles.chipOn]}
                        onPress={() => {
                          setCategoryId(cat.id);
                          setSubcategoryId("");
                        }}
                        disabled={uploadBusy}
                      >
                        <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
                          {cat.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </>
          )}

          <Text style={styles.label}>{t("locker.subcategory")}</Text>
          {catLoading ? (
            <ActivityIndicator color={c.brandNavy} style={{ marginVertical: space.sm }} />
          ) : subcategories.length === 0 ? (
            <Text style={styles.muted}>{t("locker.selectCategoryFirst")}</Text>
          ) : (
            <View style={styles.chips}>
              {subcategories.map((s) => {
                const on = subcategoryId === s.id;
                return (
                  <Pressable
                    key={s.id}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() => setSubcategoryId(s.id)}
                    disabled={uploadBusy}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
                      {s.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Text style={styles.label}>{t("locker.shareTo")}</Text>
          <View style={styles.shareTargetRow}>
            <Pressable
              style={[styles.shareTargetBtn, shareTarget === SHARE_MY_CLIPS && styles.shareTargetBtnOn]}
              onPress={() => setShareTarget(SHARE_MY_CLIPS)}
              disabled={uploadBusy}
            >
              <Ionicons name="folder-outline" size={16} color={shareTarget === SHARE_MY_CLIPS ? c.brandNavy : c.textMuted} />
              <Text style={[styles.shareTargetText, shareTarget === SHARE_MY_CLIPS && styles.shareTargetTextOn]}>
                {t("locker.shareMyClips")}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.shareTargetBtn, shareTarget === SHARE_FRIENDS && styles.shareTargetBtnOn]}
              onPress={() => setShareTarget(SHARE_FRIENDS)}
              disabled={uploadBusy}
            >
              <Ionicons name="people-outline" size={16} color={shareTarget === SHARE_FRIENDS ? c.brandNavy : c.textMuted} />
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
                    const id = String(f?._id ?? f?.id ?? f?.user_id ?? "");
                    const name =
                      f?.fullname ?? f?.receiverId?.fullname ?? f?.fullName ?? f?.email ?? "";
                    if (!id) return null;
                    const on = selectedFriendIds.includes(id);
                    return (
                      <Pressable
                        key={id}
                        style={[styles.chip, on && styles.chipOn]}
                        onPress={() => toggleFriend(id)}
                        disabled={uploadBusy}
                      >
                        <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>{name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
              {selectedFriendIds.length > 0 && (
                <>
                  <Text style={styles.muted}>
                    {t("locker.friendsSelected", { count: selectedFriendIds.length })}
                  </Text>
                  <Text style={styles.muted}>{t("locker.uploadSharedHint")}</Text>
                </>
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
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
          <Pressable
            style={({ pressed }) => [
              styles.submit,
              (!canSubmit || pressed) && { opacity: canSubmit ? 0.9 : 0.45 },
            ]}
            onPress={submit}
            disabled={!canSubmit}
          >
            {uploadBusy ? (
              <ActivityIndicator color={c.brandTextOn} />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={20} color={c.brandTextOn} />
                <Text style={styles.submitText}>{t("locker.uploadToLocker")}</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <ClipUploadPrepareModal
        visible={prepareVisible && visible}
        video={videoAsset}
        thumbUri={thumbUri}
        thumbBusy={thumbBusy}
        onClose={() => setPrepareVisible(false)}
        onReplaceVideo={() => {
          setPrepareVisible(false);
          void pickVideo();
        }}
        onThumbChange={setThumbUri}
        onConfirm={() => setPrepareVisible(false)}
      />
    </Modal>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      flex: { flex: 1, backgroundColor: palette.background },
      header: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        paddingHorizontal: space.lg,
        paddingBottom: space.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: palette.border,
        backgroundColor: palette.surfaceElevated,
      },
      headerText: { flex: 1, minWidth: 0 },
      headerTitle: { ...typography.titleSm, color: palette.text, fontWeight: "700" },
      headerSub: { ...typography.caption, color: palette.textMuted, marginTop: 2, lineHeight: 18 },
      body: { padding: space.lg, gap: space.md },
      formCard: {
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: palette.border,
        padding: space.md,
        gap: space.sm,
      },
      pickBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: space.sm,
        paddingVertical: 16,
        borderRadius: radii.lg,
        borderWidth: 1.5,
        borderStyle: "dashed",
        borderColor: palette.brandNavy,
        backgroundColor: palette.brandSubtle,
      },
      pickBtnText: { ...typography.bodyMd, fontWeight: "700", color: palette.brandNavy },
      rowCenter: { flexDirection: "row", alignItems: "center", gap: space.sm },
      muted: { ...typography.caption, color: palette.textMuted },
      previewBox: { alignItems: "center", gap: space.sm },
      previewImg: {
        width: "100%",
        height: 180,
        borderRadius: radii.md,
        backgroundColor: palette.surfaceMuted,
      },
      fileMeta: { ...typography.caption, color: palette.textMuted },
      label: { ...typography.caption, fontWeight: "700", color: palette.text },
      input: {
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: radii.md,
        paddingHorizontal: space.md,
        paddingVertical: 12,
        fontSize: 16,
        color: palette.text,
        backgroundColor: palette.background,
      },
      categoryReadonly: { gap: 4 },
      profileCat: { ...typography.bodyMd, fontWeight: "600", color: palette.text },
      chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
      chip: {
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.background,
        maxWidth: "100%",
      },
      chipOn: { borderColor: palette.brandNavy, backgroundColor: palette.brandSubtle },
      chipText: { ...typography.caption, fontWeight: "600", color: palette.text },
      chipTextOn: { color: palette.brandNavy },
      footer: {
        paddingHorizontal: space.lg,
        paddingTop: space.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: palette.border,
        backgroundColor: palette.surfaceElevated,
      },
      submit: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: palette.brandNavy,
        paddingVertical: 14,
        borderRadius: radii.md,
      },
      submitText: { ...typography.bodyMd, fontWeight: "700", color: palette.brandTextOn },
      progressBlock: {
        backgroundColor: palette.surfaceMuted,
        borderRadius: radii.md,
        padding: space.md,
        gap: 8,
        borderWidth: 1,
        borderColor: palette.border,
      },
      progressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
      progressLabel: { ...typography.caption, fontWeight: "600", color: palette.text },
      progressPercent: {
        ...typography.caption,
        fontWeight: "700",
        color: palette.brandNavy,
        minWidth: 44,
        textAlign: "right",
      },
      progressTrack: {
        width: "100%",
        height: 8,
        backgroundColor: palette.border,
        borderRadius: 4,
        overflow: "hidden",
      },
      progressFill: { height: "100%", backgroundColor: palette.brandNavy, borderRadius: 4 },
      progressHint: { ...typography.caption, color: palette.textMuted, fontStyle: "italic" },
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
        borderColor: palette.border,
        backgroundColor: palette.background,
      },
      shareTargetBtnOn: {
        borderColor: palette.brandNavy,
        backgroundColor: palette.brandSubtle,
      },
      shareTargetText: { ...typography.bodySm, fontWeight: "600", color: palette.textMuted },
      shareTargetTextOn: { color: palette.brandNavy },
      friendPickerBox: { gap: space.sm },
      friendChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    })
  );
}
