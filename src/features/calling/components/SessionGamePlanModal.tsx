/**
 * Post-call game plan — lists session screenshots and saves title/metadata
 * (web `reportModal.jsx` simplified; images already uploaded via screenshot API).
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import * as FileSystem from "expo-file-system/legacy";
import { apiClient } from "../../../api/client";
import { fetchStorageInfo } from "../../home/api/homeApi";
import { API_ROUTES } from "../../../config/apiRoutes";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { putFileToPresignedUrl } from "../../../lib/presignedPut";
import { fetchSessionReport } from "../meetingReportApi";
import {
  NOTIFICATION_TITLES,
  useNotifications,
} from "../../notifications/NotificationContext";

type Props = {
  visible: boolean;
  sessionId: string;
  trainerId: string;
  traineeId: string;
  onClose: () => void;
};

/** Loaded on demand so meeting screen does not require ExpoPrint in the dev build. */
async function printHtmlToPdfFile(html: string): Promise<string | null> {
  try {
    const Print = await import("expo-print");
    const pdf = await Print.printToFileAsync({ html, base64: false });
    return pdf?.uri ?? null;
  } catch {
    return null;
  }
}

export function SessionGamePlanModal({
  visible,
  sessionId,
  trainerId,
  traineeId,
  onClose,
}: Props) {
  const { emitNotification } = useNotifications();
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStep, setSaveStep] = useState<"idle" | "pdf" | "upload" | "report">("idle");

  const buildPdfHtml = useCallback(
    (imgKeys: string[], heading: string, notes: string) => {
      const imgs = imgKeys
        .map((k) => getS3ImageUrl(k))
        .filter(Boolean)
        .map(
          (src) => `
            <div class="imgWrap">
              <img src="${src}" />
            </div>
          `
        )
        .join("\n");

      const esc = (s: string) =>
        String(s)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");

      return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif; padding: 16px; }
      h1 { font-size: 20px; margin: 0 0 8px 0; color: #0b1f3a; }
      .notes { font-size: 12px; color: #444; white-space: pre-wrap; margin: 0 0 12px 0; }
      .imgWrap { margin: 10px 0; }
      img { width: 100%; height: auto; border-radius: 10px; }
    </style>
  </head>
  <body>
    <h1>${esc(heading)}</h1>
    ${notes ? `<div class="notes">${esc(notes)}</div>` : ""}
    ${imgs}
  </body>
</html>
`;
    },
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchSessionReport({
        sessions: sessionId,
        trainer: trainerId,
        trainee: traineeId,
      });
      const data = res?.data ?? res;
      const raw = data?.reportData;
      const list = Array.isArray(raw)
        ? raw.map((x: any) => (typeof x === "string" ? x : x?.name ?? x?.key ?? "")).filter(Boolean)
        : [];
      setImages(list);
      if (data?.title) setTitle(String(data.title));
      if (data?.description) setTopic(String(data.description));
    } catch {
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId, trainerId, traineeId]);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  const save = async () => {
    if (!title.trim()) {
      Alert.alert("Title required", "Add a title for this game plan.");
      return;
    }
    setSaving(true);
    setSaveStep("pdf");
    try {
      let pdfAttached = false;
      // Generate + upload PDF (web parity) when screenshots exist.
      if (images.length > 0) {
        const html = buildPdfHtml(images, title.trim(), topic.trim());
        const pdfUri = await printHtmlToPdfFile(html);
        if (pdfUri) {
          let pdfBytes = 0;
          try {
            /**
             * `expo-file-system@latest` always returns `size` on the info
             * payload — the legacy `{ size: true }` option was removed
             * (the field used to be lazy on older SDK versions). We rely
             * on the runtime check below to stay robust either way.
             */
            const info = await FileSystem.getInfoAsync(pdfUri);
            if (info.exists && "size" in info && typeof info.size === "number") {
              pdfBytes = info.size;
            }
          } catch {
            /* ignore */
          }
          if (pdfBytes > 0) {
            const storage = await fetchStorageInfo();
            if (storage.usedBytes + pdfBytes > storage.quotaBytes) {
              Alert.alert(
                "Storage full",
                "You have reached your storage limit (clips and game plans). Upgrade in Settings → Storage plan."
              );
              return;
            }
          }
          setSaveStep("upload");
          const sign = await apiClient.post(API_ROUTES.common.pdfUploadUrl, {
            session_id: sessionId,
            sizeBytes: pdfBytes,
          });
          const uploadUrl = sign?.data?.url;
          if (!uploadUrl) throw new Error("Could not prepare PDF upload.");
          await putFileToPresignedUrl(uploadUrl, pdfUri, "application/pdf");
          pdfAttached = true;
        } else {
          Alert.alert(
            "PDF not available",
            "Screenshots will still be saved. Update the app to attach a PDF to this game plan."
          );
        }
      }

      setSaveStep("report");
      await apiClient.post(API_ROUTES.report.create, {
        sessions: sessionId,
        trainer: trainerId,
        trainee: traineeId,
        title: title.trim(),
        topic: topic.trim() || title.trim(),
        reportData: images,
      });

      emitNotification({
        title: NOTIFICATION_TITLES.gamePlanReport,
        description: "Your coach shared a game plan. Open Game plans in your locker.",
        receiverId: traineeId,
        senderId: trainerId,
        bookingInfo: { sessionId },
      });

      Alert.alert(
        "Game plan saved",
        pdfAttached
          ? "PDF and screenshots are in your locker under Game plans."
          : "Screenshots are in your locker under Game plans."
      );
      onClose();
    } catch (e: any) {
      Alert.alert("Could not save", e?.message ?? "Try again.");
    } finally {
      setSaving(false);
      setSaveStep("idle");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.root}>
        <Text style={styles.heading}>Session game plan</Text>
        <Text style={styles.sub}>
          Review screenshots from this lesson, then save to your locker.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Game plan title"
          placeholderTextColor="#888"
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={[styles.input, styles.inputMulti]}
          placeholder="Notes (optional)"
          placeholderTextColor="#888"
          value={topic}
          onChangeText={setTopic}
          multiline
        />

        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} />
        ) : images.length === 0 ? (
          <Text style={styles.empty}>
            No screenshots yet. Use the camera button during the call to capture frames.
          </Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip}>
            {images.map((key) => (
              <Image
                key={key}
                source={{ uri: getS3ImageUrl(key) }}
                style={styles.thumb}
              />
            ))}
          </ScrollView>
        )}

        <View style={styles.actions}>
          <Pressable style={styles.btnSecondary} onPress={onClose}>
            <Text style={styles.btnSecondaryText}>Skip</Text>
          </Pressable>
          <Pressable
            style={[styles.btnPrimary, saving && { opacity: 0.6 }]}
            onPress={() => void save()}
            disabled={saving}
          >
            <Text style={styles.btnPrimaryText}>
              {saving
                ? saveStep === "pdf"
                  ? "Building PDF…"
                  : saveStep === "upload"
                    ? "Uploading PDF…"
                    : saveStep === "report"
                      ? "Saving plan…"
                      : "Saving…"
                : "Save game plan"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 20, paddingTop: 48, backgroundColor: "#fff" },
  heading: { fontSize: 22, fontWeight: "700", color: "#0b1f3a" },
  sub: { marginTop: 8, fontSize: 14, color: "#555", lineHeight: 20 },
  input: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111",
  },
  inputMulti: { minHeight: 72, textAlignVertical: "top" },
  empty: { marginTop: 20, color: "#666", fontSize: 14 },
  strip: { marginTop: 16, maxHeight: 120 },
  thumb: { width: 100, height: 100, borderRadius: 8, marginRight: 10, backgroundColor: "#eee" },
  actions: { flexDirection: "row", gap: 12, marginTop: "auto", paddingBottom: 24 },
  btnSecondary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    alignItems: "center",
  },
  btnSecondaryText: { color: "#333", fontWeight: "600" },
  btnPrimary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#0b1f3a",
    alignItems: "center",
  },
  btnPrimaryText: { color: "#fff", fontWeight: "600" },
});
