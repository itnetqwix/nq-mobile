/**
 * Post-capture screenshot details — web `screenshotDetails.jsx` parity.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
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
import { fetchSessionReport } from "../meetingReportApi";
import {
  parseReportScreenshotItems,
  toReportDataPayload,
  type ReportScreenshotItem,
} from "../reportDataUtils";

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
}: Props) {
  const [description, setDescription] = useState("");
  const [existingItems, setExistingItems] = useState<ReportScreenshotItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      setDescription("");
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
    previewUriProp || (imageKey ? getS3ImageUrl(imageKey) : null);

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  const handleAdd = async () => {
    if (!imageKey || uploadPending) return;
    Keyboard.dismiss();
    setSaving(true);
    try {
      const reportData = [...existingItems];
      const lastIdx = reportData.length - 1;
      if (lastIdx >= 0 && reportData[lastIdx]?.imageUrl === imageKey) {
        reportData[lastIdx] = {
          ...reportData[lastIdx],
          description: description.trim(),
        };
      } else {
        reportData.push({
          title: "",
          description: description.trim(),
          imageUrl: imageKey,
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
      onSaved?.();
      handleClose();
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
                  <Image
                    source={{ uri: previewUri }}
                    style={styles.preview}
                    resizeMode="contain"
                  />
                ) : loading ? (
                  <ActivityIndicator size="large" color="#000080" />
                ) : (
                  <Text style={styles.loadingText}>Loading preview…</Text>
                )}

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
                    <Text style={styles.uploadHint}>Uploading photo…</Text>
                  </View>
                ) : null}
                <Pressable
                  style={[styles.addBtn, (saving || !imageKey || uploadPending) && styles.addBtnDisabled]}
                  onPress={() => void handleAdd()}
                  disabled={saving || !imageKey || uploadPending}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.addBtnText}>
                      {imageKey ? "Add" : "Waiting for upload…"}
                    </Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
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
    height: 280,
    backgroundColor: "#fff",
    borderRadius: 8,
  },
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
    minHeight: 72,
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
