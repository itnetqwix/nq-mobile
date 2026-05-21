/**
 * Post-capture screenshot details — web `screenshotDetails.jsx` parity.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { fetchSessionReport } from "../meetingReportApi";

export type ScreenshotReportItem = {
  title?: string;
  description?: string;
  imageUrl: string;
};

type Props = {
  visible: boolean;
  sessionId: string;
  trainerId: string;
  traineeId: string;
  imageKey: string | null;
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
  previewUri: previewUriProp = null,
  reportTitle = "",
  reportTopic = "",
  onClose,
  onSaved,
}: Props) {
  const [description, setDescription] = useState("");
  const [existingItems, setExistingItems] = useState<ScreenshotReportItem[]>([]);
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
        const raw = data?.reportData;
        if (!cancelled && Array.isArray(raw)) {
          setExistingItems(
            raw.filter((x: ScreenshotReportItem) => x && typeof x.imageUrl === "string")
          );
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
    previewUriProp ||
    (imageKey ? getS3ImageUrl(imageKey) : null);

  const handleAdd = async () => {
    if (!imageKey) return;
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
        reportData,
      });
      setDescription("");
      onSaved?.();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Could not save screenshot.";
      Alert.alert("Could not save", msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.root}>
        <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>

        <View style={styles.body}>
          {previewUri ? (
            <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="contain" />
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
          />

          <Pressable
            style={[styles.addBtn, saving && styles.addBtnDisabled]}
            onPress={() => void handleAdd()}
            disabled={saving || !imageKey}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.addBtnText}>Add</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 16,
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
});
