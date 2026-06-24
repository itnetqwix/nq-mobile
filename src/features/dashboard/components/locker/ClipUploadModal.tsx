import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as VideoThumbnails from "expo-video-thumbnails";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
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
import {
  enqueueCaptureClipUpload,
  isNetworkRequestError,
} from "../../../capture/captureUploadQueue";
import { apiClient } from "../../../../api/client";
import { API_ROUTES } from "../../../../config/apiRoutes";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { Button } from "../../../../components/ui";
import { floatingTabBarBottomInset } from "../../../../navigation/FloatingTabBar";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { haptics } from "../../../../lib/haptics";
import {
  SHARE_BACKEND_NEW_USERS,
  SHARE_EMAIL,
  SHARE_FRIENDS,
  SHARE_MY_CLIPS,
  shareTargetTitleKey,
  shareTargetSubtitleKey,
  type ClipShareTargetWire,
} from "../../../capture/clipUploadShareTarget";
import {
  uploadCapturedClipsBatch,
  parseShareEmails,
  normalizeCaptureVideoMime,
  resolveVideoSizeBytes,
  type BatchUploadProgress,
} from "../../../capture/uploadCapturedClipsBatch";
import { deleteCapturedClip } from "../../../capture/capturedClipsStorage";
import {
  ClipUploadPrepareModal,
  type PreparedClipUpload,
} from "./ClipUploadPrepareModal";

async function generateVideoThumbUri(
  videoUri: string,
  durationSecs?: number | null
): Promise<string | null> {
  try {
    const durationSec = durationSecs ?? 2;
    const timeMs = Math.min(60_000, Math.max(250, Math.floor((durationSec / 2) * 1000)));
    const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
      time: timeMs,
      quality: 0.85,
    });
    return uri;
  } catch {
    return null;
  }
}

async function ensureThumbForAsset(
  asset: ImagePicker.ImagePickerAsset,
  existing?: string | null
): Promise<string | null> {
  if (existing) return existing;
  return generateVideoThumbUri(asset.uri, asset.duration ?? undefined);
}

type ShareTarget = ClipShareTargetWire;

export type ClipUploadInitialVideo = {
  uri: string;
  durationSecs?: number;
  fileName?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  title?: string;
  captureClipId?: string;
  thumbUri?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onUploaded: () => void;
  initialVideo?: ClipUploadInitialVideo | null;
  /** Batch upload from captured library multi-select. */
  initialVideos?: ClipUploadInitialVideo[];
  defaultShareTarget?: ShareTarget;
  /** When uploading from Capture library, delete local draft after success. */
  captureClipId?: string | null;
  /** Pre-select friends when share target is Friends. */
  initialSelectedFriendIds?: string[];
  /** Full-screen page (navigator) instead of modal sheet. */
  renderAsScreen?: boolean;
  onBack?: () => void;
  /** Open trim/thumbnail prepare step before details. */
  showPrepareStep?: boolean;
};

export function ClipUploadModal({
  visible,
  onClose,
  onUploaded,
  initialVideo = null,
  initialVideos = [],
  defaultShareTarget = SHARE_MY_CLIPS,
  captureClipId = null,
  initialSelectedFriendIds,
  renderAsScreen = false,
  onBack,
  showPrepareStep = false,
}: Props) {
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
  const [shareTarget, setShareTarget] = useState<ShareTarget>(defaultShareTarget);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [shareEmail, setShareEmail] = useState("");
  const [initializingVideo, setInitializingVideo] = useState(false);
  const [activeBatchIndex, setActiveBatchIndex] = useState(0);
  const [batchTitles, setBatchTitles] = useState<Record<string, string>>({});
  const [batchThumbs, setBatchThumbs] = useState<Record<string, string>>({});
  const [prepareOpen, setPrepareOpen] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchUploadProgress | null>(null);
  const [categoryAccordionOpen, setCategoryAccordionOpen] = useState(true);
  const [subcategoryAccordionOpen, setSubcategoryAccordionOpen] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const batchVideos = useMemo(() => {
    if (initialVideos.length > 0) return initialVideos;
    if (initialVideo?.uri) return [initialVideo];
    return [];
  }, [initialVideo, initialVideos]);

  const isBatch = batchVideos.length > 1;
  const activeBatchVideo = batchVideos[activeBatchIndex] ?? null;

  const shareTargetKey = useMemo(() => {
    if (shareTarget === SHARE_FRIENDS) return "friends" as const;
    if (shareTarget === SHARE_EMAIL) return "email" as const;
    return "my-clips" as const;
  }, [shareTarget]);

  const headerTitle = t(shareTargetTitleKey(shareTargetKey), {
    defaultValue:
      shareTarget === SHARE_FRIENDS
        ? "Share with friends"
        : shareTarget === SHARE_EMAIL
          ? "Share by email"
          : "Upload to My Clips",
  });
  const headerSub = t(shareTargetSubtitleKey(shareTargetKey), {
    defaultValue:
      shareTarget === SHARE_FRIENDS
        ? "Choose sport, subcategory, and friends for your clip(s)."
        : shareTarget === SHARE_EMAIL
          ? "Invite new users by email — add multiple addresses separated by commas."
          : "Add title, sport, and subcategory to save in your locker.",
  });

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
      setShareTarget(defaultShareTarget);
      setSelectedFriendIds([]);
      setShareEmail("");
      setInitializingVideo(false);
      setActiveBatchIndex(0);
      setBatchTitles({});
      setBatchThumbs({});
      setPrepareOpen(false);
      setBatchProgress(null);
      setCategoryAccordionOpen(true);
      setSubcategoryAccordionOpen(false);
    }
  }, [visible, defaultShareTarget]);

  useEffect(() => {
    if (!visible) return;
    if (shareTarget !== SHARE_FRIENDS) return;
    if (!initialSelectedFriendIds?.length) return;
    setSelectedFriendIds(initialSelectedFriendIds);
  }, [visible, shareTarget, initialSelectedFriendIds]);

  useEffect(() => {
    if (!visible || initialVideos.length === 0) return;
    let cancelled = false;

    const loadBatch = async () => {
      setInitializingVideo(true);
      const titles: Record<string, string> = {};
      const thumbs: Record<string, string> = {};

      for (const v of batchVideos) {
        const base = (v.fileName ?? "clip").replace(/\.[^/.]+$/, "");
        titles[v.uri] = v.title?.trim() || base || t("locker.clipDefault");
        try {
          const durationSec = v.durationSecs ?? 2;
          const timeMs = Math.min(60_000, Math.max(250, Math.floor((durationSec / 2) * 1000)));
          const { uri } = await VideoThumbnails.getThumbnailAsync(v.uri, {
            time: timeMs,
            quality: 0.85,
          });
          thumbs[v.uri] = uri;
        } catch {
          /* thumb optional per clip */
        }
      }

      if (cancelled) return;
      setBatchTitles(titles);
      setBatchThumbs(thumbs);
      setActiveBatchIndex(0);
      const first = batchVideos[0]!;
      setVideoAsset({
        uri: first.uri,
        width: 0,
        height: 0,
        duration: first.durationSecs,
        fileName: first.fileName ?? `capture_${Date.now()}.mp4`,
        mimeType: first.mimeType ?? "video/mp4",
        fileSize: first.fileSizeBytes,
        assetId: null,
        type: "video",
      });
      setTitle(titles[first.uri] ?? t("locker.clipDefault"));
      setThumbUri(thumbs[first.uri] ?? null);
      setInitializingVideo(false);
    };

    void loadBatch();
    return () => {
      cancelled = true;
    };
  }, [visible, initialVideos.length, batchVideos, t]);

  useEffect(() => {
    if (!visible || !initialVideo?.uri || initialVideos.length > 0) return;
    let cancelled = false;

    const loadCapturedVideo = async () => {
      setInitializingVideo(true);
      const asset: ImagePicker.ImagePickerAsset = {
        uri: initialVideo.uri,
        width: 0,
        height: 0,
        duration: initialVideo.durationSecs,
        fileName: initialVideo.fileName ?? `capture_${Date.now()}.mp4`,
        mimeType: initialVideo.mimeType ?? "video/mp4",
        fileSize: initialVideo.fileSizeBytes,
        assetId: null,
        type: "video",
      };
      setVideoAsset(asset);
      const base = (asset.fileName ?? "clip").replace(/\.[^/.]+$/, "");
      setTitle(initialVideo.title?.trim() || base || t("locker.clipDefault"));
      if (initialVideo.thumbUri) {
        setThumbUri(initialVideo.thumbUri);
        setThumbBusy(false);
        setInitializingVideo(false);
        return;
      }
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
        if (cancelled) return;
        setThumbUri(uri);
      } catch (e) {
        if (cancelled) return;
        Alert.alert(
          t("locker.previewErrorTitle"),
          getApiErrorMessage(e, t("locker.previewError"))
        );
      } finally {
        if (!cancelled) {
          setThumbBusy(false);
          setInitializingVideo(false);
          if (showPrepareStep) setPrepareOpen(true);
        }
      }
    };

    void loadCapturedVideo();
    return () => {
      cancelled = true;
    };
  }, [visible, initialVideo?.uri, initialVideo?.durationSecs, initialVideo?.fileName, initialVideo?.fileSizeBytes, initialVideo?.mimeType, initialVideo?.title, initialVideo?.thumbUri, showPrepareStep, t]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = Keyboard.addListener(showEvent, (e) => {
      setKeyboardInset(e.endCoordinates.height);
    });
    const onHide = Keyboard.addListener(hideEvent, () => setKeyboardInset(0));
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  useEffect(() => {
    if (!visible || !isTrainer || !profileCategory || !taxonomy) return;
    const match = taxonomy.categories.find(
      (c) => c.name.toLowerCase() === profileCategory.toLowerCase()
    );
    if (match) setCategoryId(match.id);
  }, [visible, isTrainer, profileCategory, taxonomy]);

  useEffect(() => {
    if (!visible || !categoryId || subcategoryId) return;
    const subs = selectedCategory?.subcategories ?? [];
    if (subs.length > 0 && isTrainer && profileCategory) {
      setSubcategoryId(subs[0].id);
    }
  }, [visible, categoryId, subcategoryId, selectedCategory, isTrainer, profileCategory]);

  const videoMime = normalizeCaptureVideoMime(videoAsset?.mimeType);

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
    } catch (e) {
      Alert.alert(
        t("locker.previewErrorTitle"),
        getApiErrorMessage(e, t("locker.previewError"))
      );
    } finally {
      setThumbBusy(false);
    }
  };

  const toggleFriend = (friendId: string) => {
    haptics.select();
    setSelectedFriendIds((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
    );
  };

  const parsedEmails = useMemo(() => parseShareEmails(shareEmail), [shareEmail]);
  const emailValid = parsedEmails.length > 0;

  const batchReady =
    !isBatch ||
    batchVideos.every((v) => (batchTitles[v.uri]?.trim().length ?? 0) > 0);

  const hasVideoSource = isBatch ? batchVideos.length > 0 : !!videoAsset;

  const canSubmit =
    hasVideoSource &&
    (isBatch ? batchReady : title.trim().length > 0) &&
    !thumbBusy &&
    !uploadBusy &&
    !initializingVideo &&
    (shareTarget === SHARE_MY_CLIPS ||
      (shareTarget === SHARE_FRIENDS && selectedFriendIds.length > 0) ||
      (shareTarget === SHARE_EMAIL && emailValid));

  const submitAction = useMemo(() => {
    if (shareTarget === SHARE_FRIENDS) {
      return {
        label: t("locker.uploadShareFriends"),
        icon: "people" as const,
        hint: t("locker.uploadSharedHint"),
      };
    }
    if (shareTarget === SHARE_EMAIL) {
      return {
        label: t("locker.uploadShareEmail"),
        icon: "mail" as const,
        hint: t("locker.shareEmailHint"),
      };
    }
    return {
      label: t("locker.uploadToLocker"),
      icon: "cloud-upload-outline" as const,
      hint: t("locker.uploadLead"),
    };
  }, [shareTarget, t]);

  const submit = async () => {
    if (!canSubmit) return;
    haptics.tap();

    if (!categoryId) {
      Alert.alert(t("locker.uploadFailedTitle"), t("locker.selectCategoryFirst"));
      return;
    }
    if (subcategories.length > 0 && !subcategoryId) {
      Alert.alert(t("locker.uploadFailedTitle"), t("locker.selectCategoryFirst"));
      return;
    }

    const shareOptions =
      shareTarget === SHARE_FRIENDS
        ? { type: SHARE_FRIENDS, friends: selectedFriendIds }
        : shareTarget === SHARE_EMAIL
          ? { type: SHARE_BACKEND_NEW_USERS, emails: parsedEmails }
          : { type: SHARE_MY_CLIPS };

    if (isBatch) {
      setUploadBusy(true);
      setBatchProgress(null);
      type PreparedBatchItem = {
        clip: {
          id: string;
          uri: string;
          createdAt: string;
          label?: string;
          durationSecs?: number;
          fileSizeBytes?: number;
          mimeType?: string;
        };
        videoUri: string;
        thumbUri: string;
        title: string;
        captureClipId?: string;
      };
      let preparedItems: PreparedBatchItem[] | null = null;
      try {
        let totalBytes = 0;
        for (const v of batchVideos) {
          totalBytes += await resolveVideoSizeBytes(v.uri, v.fileSizeBytes);
        }
        if (shareTarget === SHARE_MY_CLIPS && totalBytes > 0) {
          try {
            const storage = await fetchStorageInfo();
            if (storage.usedBytes + totalBytes > storage.quotaBytes) {
              Alert.alert(
                t("locker.storageFullTitle"),
                t("locker.storageFullBody"),
                [{ text: t("common.ok") }]
              );
              setUploadBusy(false);
              return;
            }
          } catch {
            /* proceed */
          }
        }

        const items = await Promise.all(
          batchVideos.map(async (v) => {
            const fileBytes = await resolveVideoSizeBytes(v.uri, v.fileSizeBytes);
            if (fileBytes > MAX_CLIP_FILE_BYTES) {
              throw new Error(
                t("locker.clipTooLargeBody", { max: formatStorageMb(MAX_CLIP_FILE_BYTES) })
              );
            }
            const thumb =
              batchThumbs[v.uri] ??
              (await generateVideoThumbUri(v.uri, v.durationSecs));
            if (!thumb) {
              throw new Error(
                t("capture.thumbRequired", {
                  defaultValue: "Could not generate a preview for one of the videos.",
                })
              );
            }
            return {
              clip: {
                id: v.captureClipId ?? v.uri,
                uri: v.uri,
                createdAt: new Date().toISOString(),
                label: batchTitles[v.uri],
                durationSecs: v.durationSecs,
                fileSizeBytes: fileBytes > 0 ? fileBytes : v.fileSizeBytes,
                mimeType: v.mimeType,
              },
              videoUri: v.uri,
              thumbUri: thumb,
              title: batchTitles[v.uri] ?? t("locker.clipDefault"),
              captureClipId: v.captureClipId,
            };
          })
        );
        preparedItems = items;

        const { clipIds } = await uploadCapturedClipsBatch({
          items,
          videoMime,
          category: selectedCategory?.name ?? profileCategory,
          category_id: categoryId,
          subcategory_id: subcategoryId,
          shareOptions,
          userId: user?._id != null ? String(user._id) : null,
          onProgress: setBatchProgress,
        });

        for (const id of clipIds) {
          apiClient.post(API_ROUTES.ai.tagClip(String(id))).catch(() => {});
        }

        haptics.success();
        Alert.alert(
          t("capture.batchUploadedTitle", { defaultValue: "Upload complete" }),
          t("capture.batchUploadedBody", {
            defaultValue: "{{count}} clip(s) uploaded successfully.",
            count: batchVideos.length,
          })
        );
        dispatch(lockerMutated());
        onUploaded();
        onClose();
      } catch (e) {
        haptics.error();
        if (isNetworkRequestError(e) && preparedItems?.length) {
          for (const item of preparedItems) {
            const fileBytes = item.clip.fileSizeBytes ?? 1;
            await enqueueCaptureClipUpload({
              videoUri: item.videoUri,
              videoMime,
              videoSizeBytes: fileBytes > 0 ? fileBytes : 1,
              thumbUri: item.thumbUri,
              title: item.title,
              category: selectedCategory?.name ?? profileCategory,
              category_id: categoryId,
              subcategory_id: subcategoryId,
              shareOptions,
              captureClipId: item.captureClipId,
              userId: user?._id != null ? String(user._id) : null,
            });
          }
          Alert.alert(
            t("capture.uploadQueuedTitle", { defaultValue: "Upload queued" }),
            t("capture.batchUploadQueuedBody", {
              defaultValue:
                "{{count}} clip(s) will upload when you're back online.",
              count: preparedItems.length,
            })
          );
          dispatch(lockerMutated());
          onUploaded();
          onClose();
        } else {
          Alert.alert(t("locker.uploadFailedTitle"), getApiErrorMessage(e));
        }
      } finally {
        setUploadBusy(false);
        setBatchProgress(null);
      }
      return;
    }

    if (!videoAsset) return;
    let resolvedThumb = thumbUri;
    if (!resolvedThumb) {
      setThumbBusy(true);
      try {
        resolvedThumb = await ensureThumbForAsset(videoAsset);
        if (resolvedThumb) setThumbUri(resolvedThumb);
      } finally {
        setThumbBusy(false);
      }
    }
    if (!resolvedThumb) {
      Alert.alert(t("locker.uploadFailedTitle"), t("locker.previewError"));
      return;
    }
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
      if (shareTarget === SHARE_MY_CLIPS) {
        const storage = await fetchStorageInfo();
        if (storage.usedBytes + fileBytes > storage.quotaBytes) {
          Alert.alert(
            t("locker.storageFullTitle"),
            t("locker.storageFullBody"),
            [{ text: t("common.ok") }]
          );
          return;
        }
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
        thumbUri: resolvedThumb,
        title: title.trim(),
        category: selectedCategory?.name ?? profileCategory,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        shareOptions,
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

      haptics.success();
      if (captureClipId) {
        await deleteCapturedClip(
          user?._id != null ? String(user._id) : null,
          captureClipId
        ).catch(() => {});
      }
      Alert.alert(
        t("locker.uploadedTitle"),
        shareTarget === SHARE_FRIENDS
          ? t("locker.uploadSharedBody")
          : shareTarget === SHARE_EMAIL
            ? t("locker.uploadEmailBody")
            : t("locker.uploadedBody")
      );
      dispatch(lockerMutated());
      onUploaded();
      onClose();
    } catch (e) {
      if (isNetworkRequestError(e) && videoAsset && resolvedThumb) {
        const shareOptions =
          shareTarget === SHARE_FRIENDS
            ? { type: SHARE_FRIENDS as const, friends: selectedFriendIds }
            : shareTarget === SHARE_EMAIL
              ? {
                  type: SHARE_BACKEND_NEW_USERS as const,
                  emails: parsedEmails,
                }
              : { type: SHARE_MY_CLIPS as const };
        await enqueueCaptureClipUpload({
          videoUri: videoAsset.uri,
          videoMime,
          videoSizeBytes: fileBytes > 0 ? fileBytes : 1,
          thumbUri: resolvedThumb,
          title: title.trim(),
          category: selectedCategory?.name ?? profileCategory,
          category_id: categoryId,
          subcategory_id: subcategoryId,
          shareOptions,
          captureClipId: captureClipId ?? undefined,
          userId: user?._id != null ? String(user._id) : null,
        });
        Alert.alert(
          t("capture.uploadQueuedTitle", { defaultValue: "Upload queued" }),
          t("capture.uploadQueuedBody", {
            defaultValue:
              "You're offline or the connection dropped. We'll upload this clip when you're back online.",
          })
        );
        onClose();
        onUploaded();
      } else {
        Alert.alert(t("locker.uploadFailedTitle"), getApiErrorMessage(e));
      }
    } finally {
      setUploadBusy(false);
      setUploadPhase("idle");
    }
  };

  const showCategoryPicker = !isTrainer || !profileCategory || !categoryId;

  const handleClose = () => {
    haptics.tap();
    if (onBack) onBack();
    else onClose();
  };

  const footerBottomPad = renderAsScreen
    ? floatingTabBarBottomInset(insets.bottom) + space.sm
    : Math.max(insets.bottom, space.md);
  const scrollBottomPad = footerBottomPad + 100 + (keyboardInset > 0 ? keyboardInset : 0);

  const shell = (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={renderAsScreen ? insets.top + 64 : insets.top + 8}
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top, space.md) }]}>
          {renderAsScreen ? (
            <Pressable onPress={handleClose} hitSlop={12} disabled={uploadBusy} style={styles.backIcon}>
              <Ionicons name="arrow-back" size={24} color={c.text} />
            </Pressable>
          ) : null}
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>{headerTitle}</Text>
            <Text style={styles.headerSub}>{headerSub}</Text>
            {isBatch ? (
              <Text style={styles.headerBatch}>
                {t("capture.batchCount", {
                  defaultValue: "{{count}} clips",
                  count: batchVideos.length,
                })}
              </Text>
            ) : null}
          </View>
          <Pressable onPress={handleClose} hitSlop={12} disabled={uploadBusy}>
            <Ionicons name={renderAsScreen ? "close" : "close"} size={26} color={c.text} />
          </Pressable>
        </View>

        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={[styles.body, { paddingBottom: scrollBottomPad }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
          {!initialVideo && initialVideos.length === 0 && (
            <Pressable
              style={({ pressed }) => [styles.pickBtn, pressed && { opacity: 0.9 }]}
              onPress={() => {
                haptics.tap();
                void pickVideo();
              }}
              disabled={thumbBusy || uploadBusy || initializingVideo}
            >
              <Ionicons name="folder-open-outline" size={22} color={c.brandNavy} />
              <Text style={styles.pickBtnText}>
                {videoAsset ? t("locker.replaceVideo") : t("locker.chooseVideo")}
              </Text>
            </Pressable>
          )}

          {(initialVideo || initialVideos.length > 0) && !isBatch ? (
            <Pressable
              style={styles.editVideoBtn}
              onPress={() => {
                haptics.select();
                setPrepareOpen(true);
              }}
              disabled={uploadBusy || !videoAsset}
            >
              <Ionicons name="cut-outline" size={18} color={c.brandNavy} />
              <Text style={styles.editVideoBtnText}>
                {t("capture.editVideo", { defaultValue: "Edit video & thumbnail" })}
              </Text>
            </Pressable>
          ) : null}

          {(thumbBusy || initializingVideo) && (
            <View style={styles.rowCenter}>
              <ActivityIndicator color={c.brandNavy} />
              <Text style={styles.muted}>{t("locker.preparingPreview")}</Text>
            </View>
          )}

          {(!!thumbUri || !!videoAsset) && !isBatch && (
            <View style={styles.previewRow}>
              {thumbUri ? (
                <Image source={{ uri: thumbUri }} style={styles.previewThumb} resizeMode="cover" />
              ) : (
                <View style={[styles.previewThumb, styles.previewThumbPlaceholder]}>
                  <Ionicons name="videocam-outline" size={22} color={c.textMuted} />
                </View>
              )}
              <View style={styles.previewMeta}>
                <Text style={styles.fileMeta} numberOfLines={1}>
                  {videoAsset?.fileName ?? "Video"}
                </Text>
                <Text style={styles.muted} numberOfLines={1}>
                  {videoMime}
                </Text>
                <Pressable
                  style={styles.thumbPickBtn}
                  onPress={() => {
                    haptics.select();
                    setPrepareOpen(true);
                  }}
                  disabled={uploadBusy || !videoAsset}
                >
                  <Ionicons name="image-outline" size={14} color={c.brandNavy} />
                  <Text style={styles.thumbPickText}>
                    {t("capture.changeThumbnail", { defaultValue: "Change thumbnail" })}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          <View style={styles.formCard}>
          {isBatch ? (
            <>
              <Text style={styles.label}>
                {t("capture.clipTitles", { defaultValue: "Titles for each clip" })}
              </Text>
              {batchVideos.map((v, idx) => (
                <View key={v.uri} style={styles.batchRow}>
                  <Text style={styles.batchIndex}>{idx + 1}</Text>
                  <TextInput
                    style={[styles.input, styles.batchInput]}
                    value={batchTitles[v.uri] ?? ""}
                    onChangeText={(text) =>
                      setBatchTitles((prev) => ({ ...prev, [v.uri]: text }))
                    }
                    placeholder={t("locker.titlePlaceholder")}
                    placeholderTextColor={c.textMuted}
                    editable={!uploadBusy}
                  />
                </View>
              ))}
            </>
          ) : (
            <>
          <Text style={styles.label}>{t("locker.titleLabel")}</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder={t("locker.titlePlaceholder")}
            placeholderTextColor={c.textMuted}
            editable={!uploadBusy}
          />
            </>
          )}

          {isTrainer && !!profileCategory && categoryId && (
            <View style={styles.categoryReadonly}>
              <Text style={styles.label}>{t("locker.sportFromProfile")}</Text>
              <Text style={styles.profileCat}>{profileCategory}</Text>
            </View>
          )}

          {showCategoryPicker && (
            <>
              <Pressable
                style={styles.accordionHeader}
                onPress={() => setCategoryAccordionOpen((v) => !v)}
                disabled={uploadBusy}
              >
                <Text style={styles.label}>{t("locker.sportCategory")}</Text>
                <Ionicons
                  name={categoryAccordionOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={c.textMuted}
                />
              </Pressable>
              {categoryAccordionOpen ? (
                catLoading ? (
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
                            setCategoryAccordionOpen(false);
                            setSubcategoryAccordionOpen(true);
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
                )
              ) : selectedCategory ? (
                <Text style={styles.accordionValue}>{selectedCategory.name}</Text>
              ) : null}
            </>
          )}

          <Pressable
            style={styles.accordionHeader}
            onPress={() => setSubcategoryAccordionOpen((v) => !v)}
            disabled={uploadBusy || subcategories.length === 0}
          >
            <Text style={styles.label}>{t("locker.subcategory")}</Text>
            <Ionicons
              name={subcategoryAccordionOpen ? "chevron-up" : "chevron-down"}
              size={18}
              color={c.textMuted}
            />
          </Pressable>
          {subcategoryAccordionOpen ? (
            catLoading ? (
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
                      onPress={() => {
                        setSubcategoryId(s.id);
                        setSubcategoryAccordionOpen(false);
                      }}
                      disabled={uploadBusy}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
                        {s.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )
          ) : subcategoryId ? (
            <Text style={styles.accordionValue}>
              {subcategories.find((s) => s.id === subcategoryId)?.name ?? ""}
            </Text>
          ) : null}

          <Text style={styles.sectionHeading}>{t("locker.shareTo")}</Text>
          <View style={styles.shareSegment}>
            {[
              { key: SHARE_MY_CLIPS, icon: "folder-outline" as keyof typeof Ionicons.glyphMap, label: t("locker.shareMyClips") },
              { key: SHARE_FRIENDS, icon: "people-outline" as keyof typeof Ionicons.glyphMap, label: t("locker.shareFriends") },
              { key: SHARE_EMAIL, icon: "mail-outline" as keyof typeof Ionicons.glyphMap, label: t("locker.shareEmail") },
            ].map((opt) => {
              const on = shareTarget === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  style={[styles.shareSegmentBtn, on && styles.shareSegmentBtnOn]}
                  onPress={() => setShareTarget(opt.key)}
                  disabled={uploadBusy}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Ionicons name={opt.icon} size={18} color={on ? c.brandNavy : c.textMuted} />
                  <Text style={[styles.shareSegmentLabel, on && styles.shareSegmentLabelOn]} numberOfLines={2}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {shareTarget === SHARE_FRIENDS && (
            <View style={styles.sharePanel}>
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

          {shareTarget === SHARE_EMAIL && (
            <View style={styles.sharePanel}>
              <Text style={styles.label}>{t("locker.shareEmailLabel")}</Text>
              <TextInput
                style={[styles.input, styles.emailInput]}
                value={shareEmail}
                onChangeText={setShareEmail}
                placeholder={t("capture.shareEmailsPlaceholder", {
                  defaultValue: "email1@example.com, email2@example.com",
                })}
                placeholderTextColor={c.textMuted}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={Keyboard.dismiss}
                onFocus={() => {
                  requestAnimationFrame(() => {
                    scrollRef.current?.scrollToEnd({ animated: true });
                  });
                }}
                editable={!uploadBusy}
              />
              {parsedEmails.length > 0 ? (
                <Text style={styles.muted}>
                  {t("capture.emailsParsed", {
                    defaultValue: "{{count}} valid email(s)",
                    count: parsedEmails.length,
                  })}
                </Text>
              ) : null}
              <Text style={styles.muted}>{t("locker.shareEmailHint")}</Text>
            </View>
          )}

          {uploadBusy && batchProgress ? (
            <View style={styles.progressBlock}>
              <Text style={styles.progressLabel}>
                {t("capture.uploadingBatch", {
                  defaultValue: "Uploading {{index}} of {{total}}: {{title}}",
                  index: batchProgress.index,
                  total: batchProgress.total,
                  title: batchProgress.clipTitle,
                })}
              </Text>
            </View>
          ) : null}

          {uploadBusy && !batchProgress && (
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
        </TouchableWithoutFeedback>

        <View
          style={[
            styles.footer,
            { paddingBottom: footerBottomPad },
          ]}
        >
          <Text style={styles.footerHint} numberOfLines={2}>
            {!canSubmit && hasVideoSource && !(isBatch || title.trim().length > 0)
              ? t("locker.titleLabel")
              : submitAction.hint}
          </Text>
          <Button
            label={submitAction.label}
            leftIcon={submitAction.icon}
            size="lg"
            loading={uploadBusy}
            disabled={!canSubmit}
            onPress={() => void submit()}
          />
        </View>
      </KeyboardAvoidingView>
  );

  return (
    <>
      {renderAsScreen ? (
        visible ? <View style={styles.flex}>{shell}</View> : null
      ) : (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
          {shell}
        </Modal>
      )}

      <ClipUploadPrepareModal
        visible={prepareOpen && !!videoAsset}
        video={videoAsset}
        thumbUri={thumbUri}
        thumbBusy={thumbBusy}
        onClose={() => setPrepareOpen(false)}
        onReplaceVideo={async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) return;
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["videos"],
            allowsEditing: Platform.OS === "ios",
            videoMaxDuration: 300,
            quality: 1,
          });
          if (result.canceled || !result.assets?.[0]) return;
          const asset = result.assets[0];
          setVideoAsset(asset);
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
          } finally {
            setThumbBusy(false);
          }
        }}
        onThumbChange={setThumbUri}
        onConfirm={({ video, thumbUri: nextThumb }: PreparedClipUpload) => {
          setVideoAsset(video);
          setThumbUri(nextThumb);
          setPrepareOpen(false);
          haptics.success();
        }}
      />
    </>
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
      backIcon: { padding: 4 },
      headerTitle: { ...typography.titleSm, color: palette.text, fontWeight: "700" },
      headerSub: { ...typography.caption, color: palette.textMuted, marginTop: 2, lineHeight: 18 },
      headerBatch: { ...typography.caption, color: palette.brandNavy, marginTop: 4, fontWeight: "700" },
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
      previewRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        padding: space.sm,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surfaceMuted,
      },
      previewThumb: {
        width: 88,
        height: 56,
        borderRadius: radii.sm,
        backgroundColor: palette.surfaceElevated,
      },
      previewThumbPlaceholder: {
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: palette.surfaceMuted,
      },
      previewMeta: { flex: 1, gap: 2, minWidth: 0 },
      thumbPickBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
      thumbPickText: { ...typography.caption, color: palette.brandNavy, fontWeight: "600" },
      accordionHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 4,
      },
      accordionValue: {
        ...typography.bodySm,
        color: palette.textSecondary,
        marginBottom: space.xs,
        fontWeight: "600",
      },
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
        gap: space.sm,
        zIndex: 2,
        elevation: 4,
      },
      footerHint: { ...typography.caption, color: palette.textMuted, lineHeight: 18 },
      submit: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: palette.brandNavy,
        paddingVertical: 14,
        borderRadius: radii.md,
      },
      submitDisabled: { opacity: 0.45 },
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
      sectionHeading: {
        ...typography.label,
        color: palette.text,
        marginTop: space.xs,
      },
      shareSegment: {
        flexDirection: "row",
        gap: space.sm,
        marginBottom: space.xs,
      },
      shareSegmentBtn: {
        flex: 1,
        minHeight: 72,
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingHorizontal: space.sm,
        paddingVertical: space.sm,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.background,
      },
      shareSegmentBtnOn: {
        borderColor: palette.brandNavy,
        backgroundColor: palette.brandSubtle,
      },
      shareSegmentLabel: {
        ...typography.caption,
        fontWeight: "600",
        color: palette.textMuted,
        textAlign: "center",
      },
      shareSegmentLabelOn: { color: palette.brandNavy, fontWeight: "700" },
      sharePanel: {
        gap: space.sm,
        padding: space.md,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surfaceMuted,
      },
      friendChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
      editVideoBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingVertical: 12,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surfaceElevated,
      },
      editVideoBtnText: { ...typography.bodySm, fontWeight: "700", color: palette.brandNavy },
      batchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
      batchIndex: {
        width: 24,
        textAlign: "center",
        fontWeight: "700",
        color: palette.textMuted,
      },
      batchInput: { flex: 1 },
      emailInput: { paddingVertical: 12 },
    })
  );
}
