/**
 * Post-call game plan — lists session screenshots and saves title/metadata
 * (web `reportModal.jsx` simplified; images already uploaded via screenshot API).
 */

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

import * as FileSystem from "expo-file-system/legacy";
import { apiClient } from "../../../api/client";
import { fetchStorageInfo } from "../../home/api/homeApi";
import { API_ROUTES } from "../../../config/apiRoutes";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { putFileToPresignedUrl } from "../../../lib/presignedPut";
import { fetchSessionReport } from "../meetingReportApi";
import {
  fetchImageKeysAsBase64DataUrls,
  parseReportScreenshotItems,
  type ReportScreenshotItem,
  toReportDataPayload,
} from "../reportDataUtils";
import { sendChatTextMessage } from "../../chats/lib/sendChatText";
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

function buildPdfHtmlFromDataUrls(
  imgDataUrls: string[],
  heading: string,
  notes: string,
  items: ReportScreenshotItem[]
): string {
  const esc = (s: string) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const imgs = imgDataUrls
    .map((src, i) => {
      const desc = items[i]?.description?.trim();
      return `
        <div class="imgWrap">
          <img src="${src}" />
          ${desc ? `<p class="caption">${esc(desc)}</p>` : ""}
        </div>
      `;
    })
    .join("\n");

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
      .imgWrap { margin: 10px 0; page-break-inside: avoid; }
      .caption { font-size: 11px; color: #333; margin: 6px 0 0 0; }
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
  const [reportItems, setReportItems] = useState<ReportScreenshotItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStep, setSaveStep] = useState<"idle" | "pdf" | "upload" | "report">("idle");

  const buildPdfHtml = useCallback(
    async (items: ReportScreenshotItem[], heading: string, notes: string) => {
      const keys = items.map((i) => i.imageUrl);
      const dataUrls = await fetchImageKeysAsBase64DataUrls(keys);
      const srcs =
        dataUrls.length > 0 ? dataUrls : keys.map((k) => getS3ImageUrl(k));
      return buildPdfHtmlFromDataUrls(srcs, heading, notes, items);
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
      setReportItems(parseReportScreenshotItems(data?.reportData));
      if (data?.title) setTitle(String(data.title));
      if (data?.description) setTopic(String(data.description));
    } catch {
      setReportItems([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId, trainerId, traineeId]);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  const sendSummaryToChat = useCallback(
    async (heading: string, notes: string) => {
      const lines = [
        `📋 Game plan: ${heading}`,
        notes.trim() ? notes.trim() : null,
        reportItems.length > 0 ? `${reportItems.length} screenshot(s) saved to your locker.` : null,
      ].filter(Boolean);
      await sendChatTextMessage({
        receiverId: traineeId,
        content: lines.join("\n\n"),
      });
    },
    [traineeId, reportItems.length]
  );

  const save = async (alsoSendToChat: boolean) => {
    if (!title.trim()) {
      Alert.alert("Title required", "Add a title for this game plan.");
      return;
    }
    setSaving(true);
    setSaveStep("pdf");
    try {
      let pdfAttached = false;
      // Generate + upload PDF (web parity) when screenshots exist.
      const payloadItems = toReportDataPayload(reportItems);

      if (payloadItems.length > 0) {
        const html = await buildPdfHtml(payloadItems, title.trim(), topic.trim());
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
        reportData: payloadItems,
      });

      emitNotification({
        title: NOTIFICATION_TITLES.gamePlanReport,
        description: "Your coach shared a game plan. Open Game plans in your locker.",
        receiverId: traineeId,
        senderId: trainerId,
        bookingInfo: { sessionId },
      });

      if (alsoSendToChat) {
        try {
          await sendSummaryToChat(title.trim(), topic.trim());
        } catch {
          Alert.alert(
            "Saved to locker",
            "Game plan was saved but could not be sent in chat. You can paste a link from Game plans in Chats."
          );
          onClose();
          return;
        }
      }

      Alert.alert(
        alsoSendToChat ? "Game plan saved & sent" : "Game plan saved",
        alsoSendToChat
          ? "Your trainee received a chat message and can open Game plans in their locker."
          : pdfAttached
            ? "PDF and screenshots are in your locker under Game plans."
            : "Screenshots are in your locker under Game plans."
      );
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Try again.";
      Alert.alert("Could not save", msg);
    } finally {
      setSaving(false);
      setSaveStep("idle");
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
        ) : reportItems.length === 0 ? (
          <Text style={styles.empty}>
            No screenshots yet. Use the camera button during the call to capture frames.
          </Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip}>
            {reportItems.map((item) => (
              <View key={item.imageUrl} style={styles.thumbWrap}>
                <Image
                  source={{ uri: getS3ImageUrl(item.imageUrl) }}
                  style={styles.thumb}
                />
                {item.description ? (
                  <Text style={styles.thumbCaption} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        )}

        <View style={styles.actionsCol}>
          <Pressable
            style={[styles.btnPrimary, saving && { opacity: 0.6 }]}
            onPress={() => void save(true)}
            disabled={saving}
          >
            <Text style={styles.btnPrimaryText}>
              {saving ? "Saving…" : "Save & send to chat"}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.btnSecondary, saving && { opacity: 0.6 }]}
            onPress={() => void save(false)}
            disabled={saving}
          >
            <Text style={styles.btnSecondaryText}>
              {saving
                ? saveStep === "pdf"
                  ? "Building PDF…"
                  : saveStep === "upload"
                    ? "Uploading PDF…"
                    : saveStep === "report"
                      ? "Saving plan…"
                      : "Saving…"
                : "Save to locker only"}
            </Text>
          </Pressable>
          <Pressable style={styles.btnGhost} onPress={onClose} disabled={saving}>
            <Text style={styles.btnGhostText}>Skip</Text>
          </Pressable>
        </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  strip: { marginTop: 16, maxHeight: 140 },
  thumbWrap: { marginRight: 10, maxWidth: 100 },
  thumb: { width: 100, height: 100, borderRadius: 8, backgroundColor: "#eee" },
  thumbCaption: { fontSize: 10, color: "#555", marginTop: 4 },
  actionsCol: { gap: 10, marginTop: "auto", paddingBottom: 24 },
  btnGhost: { paddingVertical: 12, alignItems: "center" },
  btnGhostText: { color: "#666", fontWeight: "600" },
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
