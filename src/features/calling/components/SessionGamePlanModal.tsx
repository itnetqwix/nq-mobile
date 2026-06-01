/**
 * Post-call game plan — web `reportModal.jsx` parity with improved mobile UX.
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
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as FileSystem from "expo-file-system/legacy";
import { apiClient } from "../../../api/client";
import { fetchStorageInfo } from "../../home/api/homeApi";
import { API_ROUTES } from "../../../config/apiRoutes";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { putFileToPresignedUrl } from "../../../lib/presignedPut";
import { fetchSessionReport } from "../meetingReportApi";
import {
  parseReportScreenshotItems,
  requireBase64DataUrlsForPdf,
  type ReportScreenshotItem,
  toReportDataPayload,
} from "../reportDataUtils";
import { buildGamePlanPdfHtml } from "../gamePlanPdfHtml";
import { isPdfPrintAvailable, printHtmlToPdfFile } from "../pdfPrint";
import { sendChatTextMessage } from "../../chats/lib/sendChatText";
import {
  NOTIFICATION_TITLES,
  useNotifications,
} from "../../notifications/NotificationContext";
import { meetingTheme } from "../meetingTheme";

type Props = {
  visible: boolean;
  sessionId: string;
  trainerId: string;
  traineeId: string;
  trainerName?: string;
  onClose: () => void;
};

export function SessionGamePlanModal({
  visible,
  sessionId,
  trainerId,
  traineeId,
  trainerName,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const { emitNotification } = useNotifications();
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [reportItems, setReportItems] = useState<ReportScreenshotItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStep, setSaveStep] = useState<"idle" | "pdf" | "upload" | "report">("idle");

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

  const updateItemDescription = (index: number, description: string) => {
    setReportItems((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index], description };
      return next;
    });
  };

  const sendSummaryToChat = useCallback(
    async (heading: string, notes: string) => {
      const lines = [
        `📋 Game plan: ${heading}`,
        notes.trim() ? notes.trim() : null,
        reportItems.length > 0
          ? `${reportItems.length} screenshot(s) saved to your locker.`
          : null,
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
      Alert.alert("Title required", "Add a topic title for this game plan.");
      return;
    }
    setSaving(true);
    setSaveStep("pdf");
    try {
      let pdfAttached = false;
      const payloadItems = toReportDataPayload(reportItems);

      if (payloadItems.length > 0) {
        if (!isPdfPrintAvailable()) {
          Alert.alert(
            "Rebuild required for PDF",
            "This app build does not include PDF export. Run npm run ios:device or android:install-dev after pulling latest code, then try again. Screenshots will still be saved."
          );
        } else {
          try {
            const keys = payloadItems.map((i) => i.imageUrl);
            const dataUrls = await requireBase64DataUrlsForPdf(keys);
            const html = buildGamePlanPdfHtml(
              dataUrls,
              title.trim(),
              topic.trim(),
              payloadItems,
              { trainerName }
            );
            const { uri: pdfUri } = await printHtmlToPdfFile(html);
            let pdfBytes = 0;
            try {
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
                  "You have reached your storage limit. Upgrade in Settings → Storage plan."
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
          } catch (e) {
            const msg = e instanceof Error ? e.message : "PDF export failed.";
            Alert.alert("PDF export failed", `${msg} Screenshots will still be saved.`);
          }
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
            "Game plan was saved but could not be sent in chat."
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
            : payloadItems.length > 0
              ? "Screenshots are in your locker under Game plans."
              : "Plan saved. Add screenshots during your next lesson for a richer PDF."
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

  const saveLabel = saving
    ? saveStep === "pdf"
      ? "Building PDF…"
      : saveStep === "upload"
        ? "Uploading PDF…"
        : saveStep === "report"
          ? "Saving…"
          : "Saving…"
    : null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.heading}>Game plan</Text>
                <Text style={styles.sub}>
                  Add a title and notes for each screenshot. We build one PDF for your trainee.
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                style={styles.closeBtn}
                hitSlop={8}
                disabled={saving}
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={26} color={meetingTheme.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.sectionLabel}>Plan details</Text>
              <TextInput
                style={styles.input}
                placeholder="Topic (e.g. Forehand contact point)"
                placeholderTextColor={meetingTheme.textMuted}
                value={title}
                onChangeText={setTitle}
              />
              <TextInput
                style={[styles.input, styles.inputMulti]}
                placeholder="Session notes (optional)"
                placeholderTextColor={meetingTheme.textMuted}
                value={topic}
                onChangeText={setTopic}
                multiline
              />

              <Text style={[styles.sectionLabel, { marginTop: 20 }]}>
                Screenshots ({reportItems.length})
              </Text>

              {loading ? (
                <ActivityIndicator style={{ marginVertical: 24 }} color={meetingTheme.navy} />
              ) : reportItems.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="camera-outline" size={32} color={meetingTheme.textMuted} />
                  <Text style={styles.emptyTitle}>No screenshots yet</Text>
                  <Text style={styles.emptyBody}>
                    During the lesson, open ⋮ More → Screenshot and choose which clip(s) to
                    capture.
                  </Text>
                </View>
              ) : (
                reportItems.map((item, index) => (
                  <View key={`${item.imageUrl}-${index}`} style={styles.shotCard}>
                    <Image
                      source={{ uri: getS3ImageUrl(item.imageUrl) }}
                      style={styles.shotImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.shotIndex}>Frame {index + 1}</Text>
                    <TextInput
                      style={[styles.input, styles.shotNotes]}
                      placeholder="Notes for this frame (shown in PDF)"
                      placeholderTextColor={meetingTheme.textMuted}
                      value={item.description ?? ""}
                      onChangeText={(t) => updateItemDescription(index, t)}
                      multiline
                    />
                  </View>
                ))
              )}
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
              <Pressable
                style={[styles.btnPrimary, saving && styles.btnDisabled]}
                onPress={() => void save(true)}
                disabled={saving}
              >
                <Text style={styles.btnPrimaryText}>
                  {saveLabel ?? "Save & notify trainee"}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.btnSecondary, saving && styles.btnDisabled]}
                onPress={() => void save(false)}
                disabled={saving}
              >
                <Text style={styles.btnSecondaryText}>
                  {saveLabel ?? "Save to locker only"}
                </Text>
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
  root: { flex: 1, backgroundColor: "#f4f6f9" },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  headerText: { flex: 1 },
  closeBtn: { padding: 4 },
  heading: { fontSize: 24, fontWeight: "800", color: meetingTheme.navy },
  sub: { marginTop: 6, fontSize: 14, color: meetingTheme.textMuted, lineHeight: 20 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 24 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: meetingTheme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: meetingTheme.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: meetingTheme.text,
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  inputMulti: { minHeight: 88, textAlignVertical: "top" },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: meetingTheme.border,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "700",
    color: meetingTheme.text,
  },
  emptyBody: {
    marginTop: 8,
    fontSize: 13,
    color: meetingTheme.textMuted,
    textAlign: "center",
    lineHeight: 19,
  },
  shotCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: meetingTheme.border,
  },
  shotImage: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    backgroundColor: "#eee",
  },
  shotIndex: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "700",
    color: meetingTheme.navy,
  },
  shotNotes: { marginTop: 6, minHeight: 64 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: meetingTheme.border,
    backgroundColor: "#fff",
  },
  btnPrimary: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: meetingTheme.navy,
    alignItems: "center",
  },
  btnPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  btnSecondary: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: meetingTheme.border,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  btnSecondaryText: { color: meetingTheme.text, fontWeight: "600", fontSize: 15 },
  btnDisabled: { opacity: 0.55 },
});
