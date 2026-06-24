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
import {
  extractPresignedFilename,
  extractPresignedPutUrl,
} from "../../../lib/http/extractPresignedUrl";
import {
  fetchSessionReport,
  removeReportImage,
  requestCropImageUpload,
  retryGamePlanPdf,
  saveSessionGamePlan,
} from "../meetingReportApi";
import { fetchSessionTimeline } from "../sessionLiveApi";
import type { GamePlanSessionMetaInput } from "../gamePlanSessionMeta";
import { getNetQwixLogoDataUrl } from "../gamePlanBrandLogo";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { LockerViewerModal } from "../../dashboard/components/locker/LockerViewerModal";
import { ReportImageCropModal } from "./ReportImageCropModal";
import {
  parseReportScreenshotItems,
  PDF_FRAME_IMAGE_MISSING_PLACEHOLDER,
  resolveBase64DataUrlsForPdf,
  type ReportScreenshotItem,
  toReportDataPayload,
} from "../reportDataUtils";
import { buildGamePlanPdfHtml } from "../gamePlanPdfHtml";
import { shouldUseServerGamePlanPdfStitch } from "../gamePlanPdfStrategy";
import { isPdfPrintAvailable, printHtmlToPdfFile } from "../pdfPrint";
import { sendChatTextMessage } from "../../chats/lib/sendChatText";
import { meetingTheme } from "../meetingTheme";

/** Light-surface palette — do not use `meetingTheme` here (dark-call colors are illegible on white). */
const gamePlanTheme = {
  navy: "#000080",
  text: "#1a1a2e",
  textMuted: "#5c6370",
  border: "#d8dce3",
  surface: "#ffffff",
  canvas: "#f4f6f9",
} as const;

type Props = {
  visible: boolean;
  sessionId: string;
  trainerId: string;
  traineeId: string;
  trainerName?: string;
  traineeName?: string;
  /** Edit an existing locker plan (no post-call chat flow). */
  lockerEdit?: boolean;
  onSaved?: () => void;
  onClose: () => void;
};

export function SessionGamePlanModal({
  visible,
  sessionId,
  trainerId,
  traineeId,
  trainerName,
  traineeName,
  lockerEdit = false,
  onSaved,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [reportItems, setReportItems] = useState<ReportScreenshotItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingAction, setSavingAction] = useState<
    null | "draft" | "publish" | "publish_notify" | "preview"
  >(null);
  const saving = savingAction != null;
  const [saveStep, setSaveStep] = useState<"idle" | "pdf" | "upload" | "report">("idle");
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [sessionMeta, setSessionMeta] = useState<GamePlanSessionMetaInput | null>(null);
  const [publishStatus, setPublishStatus] = useState<"draft" | "published" | null>(null);
  const [cropIndex, setCropIndex] = useState<number | null>(null);
  const [cropUri, setCropUri] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, timeline] = await Promise.all([
        fetchSessionReport({
          sessions: sessionId,
          trainer: trainerId,
          trainee: traineeId,
        }),
        fetchSessionTimeline(sessionId),
      ]);
      const data = res?.data ?? res;
      setReportItems(parseReportScreenshotItems(data?.reportData));
      if (data?.title) setTitle(String(data.title));
      if (data?.description) setTopic(String(data.description));
      const ps = data?.publish_status;
      setPublishStatus(ps === "draft" || ps === "published" ? ps : null);
      setSessionMeta({
        sessionId,
        startTime: timeline?.startTimeUtc ?? timeline?.bookedDate ?? null,
        endTime: timeline?.endTimeUtc ?? null,
        durationMinutes: timeline?.timer?.duration ?? null,
        totalExtendedMinutes: timeline?.extensions?.reduce(
          (n, e) => n + Number(e.minutes ?? 0),
          0
        ),
        isInstant: timeline?.isInstant,
        trainerName,
        traineeName,
        firstPublishedAt: data?.first_published_at ?? null,
        updatedAt: data?.updatedAt ?? null,
      });
    } catch {
      setReportItems([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId, trainerId, traineeId, trainerName, traineeName]);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  const updateItemField = (
    index: number,
    field: "description" | "title",
    value: string
  ) => {
    setReportItems((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const moveShot = (index: number, dir: -1 | 1) => {
    setReportItems((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      const tmp = next[index];
      next[index] = next[target];
      next[target] = tmp;
      return next;
    });
  };

  const removeShot = (index: number) => {
    const item = reportItems[index];
    if (!item?.imageUrl) return;
    Alert.alert("Remove frame?", "This screenshot will be removed from the game plan.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await removeReportImage({
                sessions: sessionId,
                trainer: trainerId,
                trainee: traineeId,
                filename: item.imageUrl,
              });
              setReportItems((prev) => prev.filter((_, i) => i !== index));
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : "Could not remove screenshot.";
              Alert.alert("Remove failed", msg);
            }
          })();
        },
      },
    ]);
  };

  const uploadCroppedFrame = async (index: number, oldFile: string, localUri: string) => {
    const presignBody = await requestCropImageUpload({
      sessions: sessionId,
      trainer: trainerId,
      trainee: traineeId,
      oldFile,
    });
    const uploadUrl = extractPresignedPutUrl(presignBody);
    if (!uploadUrl) throw new Error("Could not prepare crop upload.");
    await putFileToPresignedUrl(uploadUrl, localUri, "image/jpeg");
    const newKey =
      extractPresignedFilename(presignBody) ??
      extractPresignedFilename(presignBody?.data) ??
      oldFile;
    setReportItems((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index], imageUrl: newKey };
      return next;
    });
  };

  const buildPlanPdf = useCallback(async () => {
    const payloadItems = toReportDataPayload(reportItems);
    if (!payloadItems.length) throw new Error("Add at least one screenshot to preview the PDF.");
    const keys = payloadItems.map((i) => i.imageUrl);
    const resolved = await resolveBase64DataUrlsForPdf(keys);
    if (!resolved.some(Boolean)) {
      throw new Error("Could not load screenshots for the PDF. Check your connection and try again.");
    }
    const dataUrls = resolved.map(
      (url) => url ?? PDF_FRAME_IMAGE_MISSING_PLACEHOLDER
    );
    const logoDataUrl = await getNetQwixLogoDataUrl();
    const html = buildGamePlanPdfHtml(
      dataUrls,
      title.trim() || "Session",
      topic.trim(),
      payloadItems,
      {
        ...sessionMeta,
        sessionId,
        trainerName,
        traineeName,
        logoDataUrl,
      }
    );
    return printHtmlToPdfFile(html);
  }, [reportItems, title, topic, trainerName, traineeName, sessionMeta, sessionId]);

  const runServerPdfRetry = useCallback(async () => {
    try {
      await retryGamePlanPdf({
        sessions: sessionId,
        trainer: trainerId,
        trainee: traineeId,
      });
      Alert.alert(
        "PDF retry started",
        "Your PDF is being regenerated. It will appear in your locker shortly."
      );
    } catch (e: unknown) {
      const msg = getApiErrorMessage(
        e,
        "Could not retry PDF generation. Check your connection and try again."
      );
      Alert.alert("Retry failed", msg);
    }
  }, [sessionId, trainerId, traineeId]);

  const previewPdf = async () => {
    if (!title.trim()) {
      Alert.alert("Title required", "Add a topic title before previewing the PDF.");
      return;
    }
    setPreviewBusy(true);
    try {
      const keys = toReportDataPayload(reportItems).map((i) => i.imageUrl);
      const resolved = await resolveBase64DataUrlsForPdf(keys);
      const missing = resolved.filter((url) => !url).length;
      const { uri } = await buildPlanPdf();
      setPreviewUri(uri);
      if (missing > 0) {
        Alert.alert(
          "Partial preview",
          `${missing} screenshot${missing === 1 ? "" : "s"} could not be loaded. Placeholders are shown in the PDF.`
        );
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not build preview.";
      Alert.alert("Preview failed", msg);
    } finally {
      setPreviewBusy(false);
    }
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

  const save = async (publish: boolean, alsoSendToChat = false) => {
    if (!title.trim()) {
      Alert.alert("Title required", "Add a topic title for this game plan.");
      return;
    }
    const action: typeof savingAction =
      publish && alsoSendToChat
        ? "publish_notify"
        : publish
          ? "publish"
          : "draft";
    setSavingAction(action);
    try {
      let pdfAttached = false;
      const payloadItems = toReportDataPayload(reportItems);
      const serverStitchFallback = shouldUseServerGamePlanPdfStitch(payloadItems);

      if (publish && payloadItems.length > 0) {
        setSaveStep("pdf");
        if (!serverStitchFallback && isPdfPrintAvailable()) {
          try {
            const { uri: pdfUri } = await buildPlanPdf();
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
            const uploadUrl = extractPresignedPutUrl(sign.data);
            if (!uploadUrl) throw new Error("Could not prepare PDF upload.");
            await putFileToPresignedUrl(uploadUrl, pdfUri, "application/pdf");
            pdfAttached = true;
          } catch (e) {
            const msg = e instanceof Error ? e.message : "PDF export failed.";
            if (!serverStitchFallback) {
              Alert.alert("PDF export failed", `${msg} Screenshots will still be saved.`);
            }
          }
        } else if (!serverStitchFallback) {
          Alert.alert(
            "Rebuild required for PDF",
            "This app build does not include PDF export. Run npm run ios:device or android:install-dev after pulling latest code, then try again. Screenshots will still be saved."
          );
        }
      }

      setSaveStep("report");
      const saveRes = await saveSessionGamePlan({
        sessions: sessionId,
        trainer: trainerId,
        trainee: traineeId,
        title: title.trim(),
        topic: topic.trim() || title.trim(),
        reportData: payloadItems,
        publish,
      });
      const saveData = (saveRes as { data?: Record<string, unknown> })?.data ?? saveRes;
      const stitchPending =
        !pdfAttached &&
        serverStitchFallback &&
        Boolean(
          (saveData as { serverPdfStitchEnqueued?: boolean })?.serverPdfStitchEnqueued
        );

      if (publish && alsoSendToChat) {
        try {
          await sendSummaryToChat(title.trim(), topic.trim());
        } catch {
          Alert.alert(
            publish ? "Published" : "Draft saved",
            "Plan was saved but could not be sent in chat."
          );
          onClose();
          return;
        }
      }

      if (!publish) {
        Alert.alert(
          "Draft saved",
          "Your changes are saved privately. Publish when you're ready to share with your trainee."
        );
      } else if (
        payloadItems.length > 0 &&
        !pdfAttached &&
        !stitchPending
      ) {
        Alert.alert(
          "Game plan published",
          "Screenshots are saved, but PDF generation failed. You can retry from here or rebuild the PDF later.",
          [
            { text: "OK", style: "cancel" },
            { text: "Retry PDF", onPress: () => void runServerPdfRetry() },
          ]
        );
      } else {
        Alert.alert(
          alsoSendToChat ? "Game plan published & sent" : "Game plan published",
          alsoSendToChat
            ? "Your trainee received a chat message and can open Game plans in their locker."
            : stitchPending
              ? "Screenshots saved. PDF is being generated and will appear in locker shortly."
              : pdfAttached
                ? "PDF and screenshots are in your locker under Game plans."
                : payloadItems.length > 0
                  ? "Screenshots are in your trainee's locker under Game plans."
                  : "Plan published. Add screenshots during your next lesson for a richer PDF."
        );
      }
      onSaved?.();
      onClose();
    } catch (e: unknown) {
      const msg = getApiErrorMessage(
        e,
        "Could not save your game plan. Check your connection and try again."
      );
      Alert.alert("Could not save", msg);
    } finally {
      setSavingAction(null);
      setSaveStep("idle");
    }
  };

  const labelForAction = (action: typeof savingAction) => {
    if (!action || action === "preview") return null;
    if (saveStep === "pdf") return "Building PDF…";
    if (saveStep === "upload") return "Uploading PDF…";
    if (saveStep === "report") return "Saving…";
    if (action === "draft") return "Saving draft…";
    if (action === "publish_notify") return "Publishing…";
    if (action === "publish") return "Publishing…";
    return "Saving…";
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={[styles.root, { paddingTop: insets.top }]}>
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
                <Ionicons name="close" size={26} color={gamePlanTheme.textMuted} />
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
                placeholderTextColor={gamePlanTheme.textMuted}
                value={title}
                onChangeText={setTitle}
              />
              <TextInput
                style={[styles.input, styles.inputMulti]}
                placeholder="Session notes (optional)"
                placeholderTextColor={gamePlanTheme.textMuted}
                value={topic}
                onChangeText={setTopic}
                multiline
              />

              <Text style={[styles.sectionLabel, { marginTop: 20 }]}>
                Screenshots ({reportItems.length})
              </Text>

              {loading ? (
                <ActivityIndicator style={{ marginVertical: 24 }} color={gamePlanTheme.navy} />
              ) : reportItems.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="camera-outline" size={32} color={gamePlanTheme.textMuted} />
                  <Text style={styles.emptyTitle}>No screenshots yet</Text>
                  <Text style={styles.emptyBody}>
                    During the lesson, open ⋮ More → Screenshot and choose which clip(s) to
                    capture.
                  </Text>
                </View>
              ) : (
                reportItems.map((item, index) => (
                  <View key={`${item.imageUrl}-${index}`} style={styles.shotCard}>
                    <View style={styles.shotToolbar}>
                      <Pressable
                        onPress={() => moveShot(index, -1)}
                        disabled={index === 0}
                        hitSlop={8}
                      >
                        <Ionicons
                          name="chevron-up"
                          size={22}
                          color={index === 0 ? gamePlanTheme.textMuted : gamePlanTheme.navy}
                        />
                      </Pressable>
                      <Pressable
                        onPress={() => moveShot(index, 1)}
                        disabled={index === reportItems.length - 1}
                        hitSlop={8}
                      >
                        <Ionicons
                          name="chevron-down"
                          size={22}
                          color={
                            index === reportItems.length - 1
                              ? gamePlanTheme.textMuted
                              : gamePlanTheme.navy
                          }
                        />
                      </Pressable>
                      <View style={styles.shotToolbarSpacer} />
                      <Pressable
                        onPress={() => {
                          setCropIndex(index);
                          setCropUri(getS3ImageUrl(item.imageUrl));
                        }}
                        hitSlop={8}
                      >
                        <Ionicons name="crop-outline" size={22} color={gamePlanTheme.navy} />
                      </Pressable>
                      <Pressable onPress={() => removeShot(index)} hitSlop={8}>
                        <Ionicons name="trash-outline" size={22} color="#c0392b" />
                      </Pressable>
                    </View>
                    <Image
                      source={{ uri: getS3ImageUrl(item.imageUrl) }}
                      style={styles.shotImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.shotIndex}>Frame {index + 1}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Frame title (optional, shown in PDF)"
                      placeholderTextColor={gamePlanTheme.textMuted}
                      value={item.title ?? ""}
                      onChangeText={(t) => updateItemField(index, "title", t)}
                    />
                    <TextInput
                      style={[styles.input, styles.shotNotes]}
                      placeholder="Notes for this frame (shown in PDF)"
                      placeholderTextColor={gamePlanTheme.textMuted}
                      value={item.description ?? ""}
                      onChangeText={(t) => updateItemField(index, "description", t)}
                      multiline
                    />
                  </View>
                ))
              )}
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
              <Pressable
                style={[styles.btnPreview, (saving || previewBusy) && styles.btnDisabled]}
                onPress={() => void previewPdf()}
                disabled={saving || previewBusy || reportItems.length === 0}
              >
                <Text style={styles.btnPreviewText}>
                  {previewBusy ? "Building preview…" : "Preview PDF"}
                </Text>
              </Pressable>
              {lockerEdit ? (
                <>
                  {publishStatus === "draft" ? (
                    <View style={styles.draftBanner}>
                      <Text style={styles.draftBannerText}>Draft — not visible to trainee</Text>
                    </View>
                  ) : null}
                  <Pressable
                    style={[styles.btnSecondary, saving && styles.btnDisabled]}
                    onPress={() => void save(false)}
                    disabled={saving}
                  >
                    <Text style={styles.btnSecondaryText}>
                      {labelForAction(savingAction === "draft" ? "draft" : null) ?? "Save draft"}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btnPrimary, saving && styles.btnDisabled]}
                    onPress={() => void save(true)}
                    disabled={saving}
                  >
                    <Text style={styles.btnPrimaryText}>
                      {labelForAction(savingAction === "publish" ? "publish" : null) ??
                        "Publish update"}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    style={[styles.btnPrimary, saving && styles.btnDisabled]}
                    onPress={() => void save(true, true)}
                    disabled={saving}
                  >
                    <Text style={styles.btnPrimaryText}>
                      {labelForAction(
                        savingAction === "publish_notify" ? "publish_notify" : null
                      ) ?? "Publish & notify trainee"}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btnSecondary, saving && styles.btnDisabled]}
                    onPress={() => void save(true, false)}
                    disabled={saving}
                  >
                    <Text style={styles.btnSecondaryText}>
                      {labelForAction(savingAction === "publish" ? "publish" : null) ??
                        "Publish to locker"}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btnSecondary, saving && styles.btnDisabled]}
                    onPress={() => void save(false)}
                    disabled={saving}
                  >
                    <Text style={styles.btnSecondaryText}>
                      {labelForAction(savingAction === "draft" ? "draft" : null) ?? "Save draft"}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      <ReportImageCropModal
        visible={cropIndex !== null && !!cropUri}
        imageUri={cropUri ?? ""}
        onClose={() => {
          setCropIndex(null);
          setCropUri(null);
        }}
        onCropped={(uri) => {
          const idx = cropIndex;
          const oldFile = idx !== null ? reportItems[idx]?.imageUrl : null;
          if (idx === null || !oldFile) return;
          void (async () => {
            try {
              await uploadCroppedFrame(idx, oldFile, uri);
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : "Crop upload failed.";
              Alert.alert("Crop failed", msg);
            } finally {
              setCropIndex(null);
              setCropUri(null);
            }
          })();
        }}
      />

      <LockerViewerModal
        visible={!!previewUri}
        uri={previewUri ?? ""}
        title="Game plan preview"
        mode="pdf"
        onClose={() => setPreviewUri(null)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: gamePlanTheme.canvas },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  headerText: { flex: 1 },
  closeBtn: { padding: 4 },
  heading: { fontSize: 24, fontWeight: "800", color: gamePlanTheme.text },
  sub: { marginTop: 6, fontSize: 14, color: gamePlanTheme.textMuted, lineHeight: 20 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 200 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: gamePlanTheme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: gamePlanTheme.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: gamePlanTheme.text,
    backgroundColor: gamePlanTheme.surface,
    marginBottom: 10,
  },
  inputMulti: { minHeight: 88, textAlignVertical: "top" },
  emptyCard: {
    backgroundColor: gamePlanTheme.surface,
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: gamePlanTheme.border,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "700",
    color: gamePlanTheme.text,
  },
  emptyBody: {
    marginTop: 8,
    fontSize: 13,
    color: gamePlanTheme.textMuted,
    textAlign: "center",
    lineHeight: 19,
  },
  shotCard: {
    backgroundColor: gamePlanTheme.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: gamePlanTheme.border,
  },
  shotImage: {
    width: "100%",
    height: 220,
    borderRadius: 10,
    backgroundColor: "#0a0a12",
  },
  shotIndex: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "700",
    color: gamePlanTheme.navy,
  },
  shotNotes: { marginTop: 6, minHeight: 64 },
  shotToolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  shotToolbarSpacer: { flex: 1 },
  btnPreview: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: gamePlanTheme.navy,
    alignItems: "center",
    backgroundColor: gamePlanTheme.surface,
  },
  btnPreviewText: { color: gamePlanTheme.navy, fontWeight: "700", fontSize: 15 },
  draftBanner: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#fff8e6",
    borderWidth: 1,
    borderColor: "#f0c040",
  },
  draftBannerText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8a6d00",
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
    backgroundColor: gamePlanTheme.canvas,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: gamePlanTheme.border,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  btnPrimary: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: gamePlanTheme.navy,
    alignItems: "center",
  },
  btnPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  btnSecondary: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: gamePlanTheme.border,
    alignItems: "center",
    backgroundColor: gamePlanTheme.surface,
  },
  btnSecondaryText: { color: gamePlanTheme.text, fontWeight: "600", fontSize: 15 },
  btnDisabled: { opacity: 0.55 },
});
