/**
 * Post-capture screenshot details — web `screenshotDetails.jsx` parity.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
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

import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { fetchSessionReport, requestCropImageUpload } from "../meetingReportApi";
import { putFileToPresignedUrl } from "../../../lib/presignedPut";
import {
  extractPresignedFilename,
  extractPresignedPutUrl,
} from "../../../lib/http/extractPresignedUrl";
import {
  parseReportScreenshotItems,
  toReportDataPayload,
  type ReportScreenshotItem,
} from "../reportDataUtils";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { ReportImageCropModal } from "./ReportImageCropModal";

type Props = {
  visible: boolean;
  sessionId: string;
  trainerId: string;
  traineeId: string;
  imageKey: string | null;
  /** True while the frame is uploading to S3 in the background. */
  uploadPending?: boolean;
  /** Local file URI shown immediately after capture (before S3 CDN is ready). */
  previewUri?: string | null;
  reportTitle?: string;
  reportTopic?: string;
  onClose: () => void;
  onSaved?: () => void;
  /**
   * After crop (pre-upload): update preview and restart in-flight S3 upload.
   */
  onPreviewUriChange?: (uri: string) => void;
  /** After crop API replaces the S3 key on an already-uploaded frame. */
  onImageKeyUpdated?: (imageKey: string) => void;
};

export function SessionScreenshotDetailsModal({
  visible,
  sessionId,
  trainerId,
  traineeId,
  imageKey,
  uploadPending = false,
  previewUri: previewUriProp = null,
  reportTitle = "",
  reportTopic = "",
  onClose,
  onSaved,
  onPreviewUriChange,
  onImageKeyUpdated,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [existingItems, setExistingItems] = useState<ReportScreenshotItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [queuedSave, setQueuedSave] = useState<{ title: string; description: string } | null>(
    null
  );

  const persistScreenshot = useCallback(
    async (key: string, frameTitle: string, frameDescription: string) => {
      const reportData = [...existingItems];
      const lastIdx = reportData.length - 1;
      if (lastIdx >= 0 && reportData[lastIdx]?.imageUrl === key) {
        reportData[lastIdx] = {
          ...reportData[lastIdx],
          title: frameTitle.trim(),
          description: frameDescription.trim(),
        };
      } else {
        reportData.push({
          title: frameTitle.trim(),
          description: frameDescription.trim(),
          imageUrl: key,
        });
      }
      await apiClient.post(API_ROUTES.report.create, {
        sessions: sessionId,
        trainer: trainerId,
        trainee: traineeId,
        title: reportTitle || "Session notes",
        topic: reportTopic || reportTitle || "Session notes",
        reportData: toReportDataPayload(reportData),
      });
      setDescription("");
      setTitle("");
      onSaved?.();
      Keyboard.dismiss();
      onClose();
    },
    [
      existingItems,
      onClose,
      onSaved,
      reportTitle,
      reportTopic,
      sessionId,
      trainerId,
      traineeId,
    ]
  );

  useEffect(() => {
    if (!imageKey || !queuedSave) return;
    void (async () => {
      setSaving(true);
      try {
        await persistScreenshot(imageKey, queuedSave.title, queuedSave.description);
        setQueuedSave(null);
      } catch (e: unknown) {
        const msg = getApiErrorMessage(e, "Could not save screenshot.");
        Alert.alert("Could not save", msg);
      } finally {
        setSaving(false);
      }
    })();
  }, [imageKey, persistScreenshot, queuedSave]);

  useEffect(() => {
    if (!visible) {
      setDescription("");
      setTitle("");
      setLocalPreview(null);
      setQueuedSave(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetchSessionReport({
          sessions: sessionId,
          trainer: trainerId,
          trainee: traineeId,
        });
        const data = res?.data ?? res;
        if (!cancelled) {
          setExistingItems(parseReportScreenshotItems(data?.reportData));
        }
      } catch {
        if (!cancelled) setExistingItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, sessionId, trainerId, traineeId]);

  const previewUri =
    localPreview ||
    previewUriProp ||
    (imageKey ? getS3ImageUrl(imageKey) : null);

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  const handleAdd = async () => {
    if (!previewUri && !imageKey) return;
    Keyboard.dismiss();
    if (uploadPending || !imageKey) {
      setQueuedSave({ title, description });
      return;
    }
    setSaving(true);
    try {
      await persistScreenshot(imageKey, title, description);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      const msg =
        err?.response?.data?.message ?? err?.message ?? "Could not save screenshot.";
      Alert.alert("Could not save", msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.root}>
            <Pressable style={styles.closeBtn} onPress={handleClose} hitSlop={12}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}
            >
              <View style={styles.body}>
                {previewUri ? (
                  <>
                    <Image
                      source={{ uri: previewUri }}
                      style={styles.preview}
                      resizeMode="cover"
                    />
                    <View style={styles.toolRow}>
                      <Pressable
                        style={styles.toolBtn}
                        onPress={() => setCropOpen(true)}
                        disabled={!previewUri}
                      >
                        <Ionicons name="crop-outline" size={18} color="#000080" />
                        <Text style={styles.toolBtnText}>Crop</Text>
                      </Pressable>
                    </View>
                  </>
                ) : loading ? (
                  <ActivityIndicator size="large" color="#000080" />
                ) : (
                  <Text style={styles.loadingText}>Loading preview…</Text>
                )}

                <TextInput
                  style={styles.input}
                  placeholder="Frame title (optional)"
                  placeholderTextColor="#888"
                  value={title}
                  onChangeText={setTitle}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Description"
                  placeholderTextColor="#888"
                  multiline
                  numberOfLines={3}
                  value={description}
                  onChangeText={setDescription}
                  blurOnSubmit
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />

                {uploadPending && !imageKey ? (
                  <View style={styles.uploadRow}>
                    <ActivityIndicator color="#000080" size="small" />
                    <Text style={styles.uploadHint}>
                      {queuedSave
                        ? "Uploading photo — will save when ready…"
                        : "Uploading photo…"}
                    </Text>
                  </View>
                ) : null}
                <Pressable
                  style={[
                    styles.addBtn,
                    (saving || (!previewUri && !imageKey)) && styles.addBtnDisabled,
                  ]}
                  onPress={() => void handleAdd()}
                  disabled={saving || (!previewUri && !imageKey)}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.addBtnText}>
                      {uploadPending && !imageKey
                        ? queuedSave
                          ? "Queued — waiting for upload"
                          : "Save when upload finishes"
                        : "Add"}
                    </Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      <ReportImageCropModal
        visible={cropOpen && !!previewUri}
        imageUri={previewUri ?? ""}
        onClose={() => setCropOpen(false)}
        onCropped={(uri) => {
          setLocalPreview(uri);
          void (async () => {
            if (imageKey) {
              try {
                const presignBody = await requestCropImageUpload({
                  sessions: sessionId,
                  trainer: trainerId,
                  trainee: traineeId,
                  oldFile: imageKey,
                });
                const uploadUrl = extractPresignedPutUrl(presignBody);
                if (!uploadUrl) throw new Error("Could not prepare crop upload.");
                await putFileToPresignedUrl(uploadUrl, uri, "image/jpeg");
                const newKey =
                  extractPresignedFilename(presignBody) ??
                  extractPresignedFilename(
                    (presignBody as { data?: unknown })?.data
                  ) ??
                  imageKey;
                onImageKeyUpdated?.(newKey);
                if (newKey !== imageKey) {
                  Alert.alert(
                    "Crop saved",
                    "The cropped frame was uploaded to your game plan."
                  );
                }
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Crop upload failed.";
                Alert.alert("Crop failed", msg);
              }
            } else {
              onPreviewUriChange?.(uri);
            }
          })();
          setCropOpen(false);
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 16,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  closeBtn: {
    position: "absolute",
    top: 48,
    right: 24,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#000080",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    maxHeight: "85%",
    alignSelf: "center",
    width: "100%",
    maxWidth: 420,
  },
  preview: {
    width: "100%",
    height: 340,
    backgroundColor: "#000",
    borderRadius: 8,
  },
  toolRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
    marginBottom: 4,
  },
  toolBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#000080",
  },
  toolBtnText: { fontSize: 13, fontWeight: "600", color: "#000080" },
  loadingText: {
    textAlign: "center",
    padding: 40,
    color: "#666",
  },
  input: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#000080",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    minHeight: 44,
    textAlignVertical: "top",
  },
  addBtn: {
    marginTop: 12,
    backgroundColor: "#000080",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  addBtnDisabled: { opacity: 0.6 },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  uploadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  uploadHint: { fontSize: 13, color: "#666" },
});
