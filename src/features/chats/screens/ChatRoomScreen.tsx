import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Animated,
  SectionList,
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
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { queryKeys } from "../../../lib/queryKeys";
import { flatListKeyExtractor } from "../../../lib/lists/trainerListUtils";
import { useAuth } from "../../auth/context/AuthContext";
import { useSocket } from "../../socket/SocketContext";
import { useOnlinePresence } from "../../socket/useOnlinePresence";
import { ChatMediaViewerModal } from "../components/ChatMediaViewerModal";
import { ChatVideoThumbnail } from "../components/ChatVideoThumbnail";
import {
  buildChatMediaList,
  inferChatMediaKind,
  resolveChatMediaUri,
} from "../lib/chatMediaUtils";
import { ChatDaySeparator } from "../components/ChatDaySeparator";
import {
  deleteChatMessage,
  editChatMessage,
  fetchGroupMembers,
  pinChatMessage,
  reactToMessage,
  transcribeVoiceMessage,
  setConversationDisappearingTtl,
} from "../api/chatActionsApi";
import { GroupMembersSheet } from "../components/GroupMembersSheet";
import {
  findMessageSectionLocation,
  formatChatDayLabel,
  groupMessagesByDayAsc,
  sortMessagesAsc,
} from "../lib/chatDateUtils";
import {
  getSearchableText,
  groupMessagesByDay,
  highlightQueryParts,
  messageMatchesQuery,
} from "../lib/chatSearchUtils";
import { useChatE2E } from "../hooks/useChatE2E";
import { isEncryptedChatContent } from "../crypto/chatEncryption";
import { haptics } from "../../../lib/haptics";
import { PinnedTraineeNoteCard } from "../components/PinnedTraineeNoteCard";
import { TrainerNudgePickerSheet } from "../components/TrainerNudgePickerSheet";
import { MessageActionsSheet } from "../components/MessageActionsSheet";
import type { MessageAction } from "../components/MessageActionsSheet";
import { ForwardPickerSheet } from "../components/ForwardPickerSheet";
import { PinnedMessageBanner } from "../components/PinnedMessageBanner";
import { DisappearingMessagesSheet } from "../components/DisappearingMessagesSheet";
import { ScheduledMessageComposer } from "../components/ScheduledMessageComposer";
import { ScheduledMessagesSheet } from "../components/ScheduledMessagesSheet";
import {
  enqueueChatMessage,
  flushOfflineChatQueue,
  subscribeOfflineChatQueueEvents,
  type QueuedChatMessage,
} from "../lib/offlineChatQueue";
import {
  getPresignedUploadUrl,
  isNetworkSendError,
  uploadToS3,
} from "../lib/mediaSendUtils";
import { ImageWithSkeleton } from "../../../components/ui";

type Props = {
  conversationId: string;
  partner: {
    _id: string;
    fullname?: string;
    profile_picture?: string;
    isGroup?: boolean;
  };
  isGroup?: boolean;
  memberCount?: number;
  groupAdminId?: string;
  groupDescription?: string;
  onGoBack: () => void;
  /**
   * Auto-jump & highlight this message id and pre-seed the in-chat
   * search. Used by the global message search on the chat list.
   */
  targetMessageId?: string;
  searchSeed?: string;
};

type SenderRef = string | { _id?: string; fullname?: string; profile_picture?: string };

type Message = {
  _id: string;
  senderId: SenderRef;
  receiverId: string;
  content: string;
  type: string;
  mediaUrl?: string | null;
  status?: "sent" | "delivered" | "read" | "sending" | "failed";
  pending?: boolean;
  createdAt: string;
  replyToMessageId?: string | null;
  editedAt?: string | null;
  reactions?: Array<{ user_id: string; emoji: string }>;
  forwardedFromMessageId?: string | null;
  transcript?: string | null;
  transcriptStatus?: "idle" | "pending" | "done" | "failed";
  /** Local media retry metadata (not sent to server). */
  localFileUri?: string | null;
  uploadFileName?: string | null;
  uploadMimeType?: string | null;
};

const EMOJI_LIST = [
  "😀","😂","🥰","😍","😎","🤩","😢","😡","👍","👎",
  "❤️","🔥","🎉","💪","🙏","👏","🤝","💯","✅","⭐",
  "😊","🤗","😇","🤔","😏","🥳","😱","💀","👀","🙌",
];

const REPORT_REASONS = [
  "Harassment or bullying",
  "Spam or scam",
  "Inappropriate content",
  "Fake account",
  "Other",
];

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatLastSeen(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Status checkmarks ──────────────────────────────────────────────────────

function MessageStatus({
  status,
  pending,
  failed,
}: {
  status?: string;
  pending?: boolean;
  failed?: boolean;
}) {
  if (failed || status === "failed") {
    return (
      <View style={statusStyles.row}>
        <Ionicons name="alert-circle" size={14} color="#ef4444" />
      </View>
    );
  }
  if (pending || status === "sending") {
    return (
      <View style={statusStyles.row}>
        <ActivityIndicator size={10} color="rgba(255,255,255,0.75)" />
      </View>
    );
  }
  if (!status || status === "sent") {
    return (
      <View style={statusStyles.row}>
        <Ionicons name="checkmark" size={15} color="#9CA3AF" />
      </View>
    );
  }
  if (status === "delivered") {
    return (
      <View style={statusStyles.row}>
        <Ionicons name="checkmark-done" size={15} color="#54656F" />
      </View>
    );
  }
  if (status === "read") {
    return (
      <View style={statusStyles.row}>
        <Ionicons name="checkmark-done" size={15} color="#FFFFFF" />
      </View>
    );
  }
  return null;
}

const statusStyles = StyleSheet.create({
  row: { marginLeft: 4 },
});

// ─── Animated typing dots ──────────────────────────────────────────────────

function TypingDots({ color = "#4CAF50" }: { color?: string }) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bounce = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 350, useNativeDriver: true }),
        ])
      );
    const a1 = bounce(dot1, 0);
    const a2 = bounce(dot2, 120);
    const a3 = bounce(dot3, 240);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  const dotStyle = (v: Animated.Value) => ({
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: color,
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }],
  });

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
      <Animated.View style={dotStyle(dot1)} />
      <Animated.View style={dotStyle(dot2)} />
      <Animated.View style={dotStyle(dot3)} />
    </View>
  );
}

function useChatRoomStyles() {
  return useThemedStyles((themeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: themeColors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    paddingBottom: 10,
    backgroundColor: themeColors.surfaceElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: themeColors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  keyboardWrap: { flex: 1 },
  backBtn: { marginRight: -2 },
  headerProfileTap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  headerAvatar: { width: 36, height: 36, borderRadius: 18 },
  headerAvatarFb: { backgroundColor: themeColors.brandNavy, alignItems: "center", justifyContent: "center" },
  headerAvatarInitial: { color: "#fff", fontWeight: "700", fontSize: 14 },
  onlineDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: "#4CAF50",
    position: "absolute", bottom: 0, right: -1, borderWidth: 2, borderColor: themeColors.surfaceElevated,
  },
  headerInfo: { flex: 1, minWidth: 0 },
  headerName: { ...typography.titleSm, color: themeColors.text, fontSize: 16, flexShrink: 1 },
  headerSub: { fontSize: 12, color: themeColors.textMuted, marginTop: 1, flexShrink: 1 },
  headerSubTyping: { color: "#4CAF50", fontStyle: "italic" },
  headerMore: { padding: 6 },
  messageArea: { flex: 1 },
  messageList: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.md,
    flexGrow: 1,
  },
  messageListEmpty: {
    flexGrow: 1,
    paddingTop: space.lg,
  },
  /**
   * Two-level layout:
   *   `messageRow` is a horizontal flex row that aligns the *column*
   *   (mine = right, theirs = left). The column then stacks the optional
   *   sender label on top of the bubble. Previously the sender label
   *   rendered as a sibling of the bubble inside a row, which made it
   *   appear *next to* the bubble in group chats.
   */
  messageRow: {
    width: "100%",
    flexDirection: "row",
    paddingVertical: 2,
  },
  messageRowMine: { justifyContent: "flex-end" },
  messageRowTheirs: { justifyContent: "flex-start" },
  messageColumn: {
    maxWidth: "82%",
    flexDirection: "column",
  },
  messageColumnMine: { alignItems: "flex-end" },
  messageColumnTheirs: { alignItems: "flex-start" },
  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 1.5,
    elevation: 1,
  },
  bubbleMine: {
    backgroundColor: themeColors.chatBubbleOutgoing,
    borderBottomRightRadius: 6,
  },
  bubbleTheirs: {
    backgroundColor: themeColors.chatBubbleIncoming,
    borderBottomLeftRadius: 6,
  },
  composer: {
    backgroundColor: themeColors.surfaceElevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: themeColors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 4,
  },
  /** Pin-to-bottom FAB shown when the user has scrolled away. Bottom
      offset clears the composer; tweak if the composer height changes. */
  scrollToBottomFab: {
    position: "absolute",
    right: space.md,
    bottom: 80,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: themeColors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: themeColors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 5,
  },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: themeColors.border,
    backgroundColor: themeColors.surfaceMuted,
  },
  replyBarLabel: { fontSize: 11, fontWeight: "700", color: themeColors.brandNavy },
  replyBarText: { fontSize: 13, color: themeColors.textMuted, marginTop: 2, flexShrink: 1 },
  replyQuote: {
    borderLeftWidth: 3,
    borderLeftColor: themeColors.brandNavy,
    paddingLeft: 8,
    marginBottom: 6,
    opacity: 0.85,
  },
  replyQuoteText: { fontSize: 12, color: themeColors.textMuted },
  /**
   * Sender label that renders ABOVE the bubble in group chats. With the
   * column-based message layout we rely on the parent column for
   * alignment; the label just contributes its own colour + leading.
   */
  senderName: {
    fontSize: 12,
    fontWeight: "700",
    color: themeColors.brandAccent,
    marginBottom: 4,
    marginHorizontal: 4,
  },
  senderNameMine: {
    color: themeColors.textMuted,
  },
  bubbleText: { ...typography.bodyMd, color: themeColors.text, lineHeight: 20 },
  bubbleTextMine: { color: themeColors.chatBubbleOutgoingText },
  bubbleFooter: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 2 },
  bubbleTime: { ...typography.caption, color: themeColors.textMuted, fontSize: 10 },
  bubbleTimeMine: { color: "rgba(255,255,255,0.6)" },
  mediaThumbnail: { width: 200, height: 200, borderRadius: radii.md, marginBottom: 4 },
  videoContainer: { position: "relative", width: 200, height: 120, borderRadius: radii.md, overflow: "hidden" },
  videoPlaceholder: { flex: 1, backgroundColor: "rgba(0,0,0,0.1)", alignItems: "center", justifyContent: "center" },
  playOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  emojiTray: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: themeColors.border,
    maxHeight: 220,
  },
  emojiScroll: { paddingHorizontal: 8, paddingVertical: 10, gap: 2 },
  emojiBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  emojiText: { fontSize: 24 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: themeColors.surfaceMuted,
    borderRadius: 24,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 4,
    minHeight: 44,
    gap: 4,
  },
  textInput: {
    flex: 1, fontSize: 15.5, lineHeight: 20, color: themeColors.text,
    paddingTop: Platform.OS === "ios" ? 10 : 6,
    paddingBottom: Platform.OS === "ios" ? 10 : 6,
    maxHeight: 120, textAlignVertical: "center",
  },
  inputAccessoryBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center", marginBottom: Platform.OS === "ios" ? 2 : 4 },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: themeColors.brandNavy,
    alignItems: "center", justifyContent: "center",
    shadowColor: themeColors.brandNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  micBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: themeColors.brandNavy,
    alignItems: "center", justifyContent: "center",
    shadowColor: themeColors.brandNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
  },
  recordBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  emptyChat: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  emptyChatIcon: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: `${themeColors.brandNavy}10`,
    alignItems: "center", justifyContent: "center",
  },
  emptyChatTitle: {
    ...typography.titleSm,
    color: themeColors.text,
    textAlign: "center",
  },
  emptyChatText: {
    ...typography.bodyMd,
    color: themeColors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  typingDots: { flexDirection: "row", alignItems: "center", gap: 3, marginRight: 6 },
  typingDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#4CAF50" },
  recordDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#F44336" },
  recordTime: { fontSize: 16, fontWeight: "600", color: themeColors.text, fontVariant: ["tabular-nums"] },
  recordLabel: { fontSize: 13, color: themeColors.textMuted },
  recordCancel: { padding: 6 },
  recordSend: { width: 40, height: 40, borderRadius: 20, backgroundColor: themeColors.brandNavy, alignItems: "center", justifyContent: "center" },
  uploadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.3)", alignItems: "center", justifyContent: "center" },
  uploadingCard: { backgroundColor: "#fff", borderRadius: 16, padding: 32, alignItems: "center", gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  editModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: space.lg,
  },
  editModalCard: {
    backgroundColor: themeColors.surfaceElevated,
    borderRadius: radii.md,
    padding: space.md,
    gap: space.sm,
  },
  editModalTitle: { ...typography.titleSm, color: themeColors.text },
  editModalInput: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: themeColors.border,
    borderRadius: radii.sm,
    padding: space.sm,
    color: themeColors.text,
    textAlignVertical: "top",
  },
  editModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: space.md,
  },
  editModalCancel: { color: themeColors.textMuted, fontWeight: "600" },
  editModalSave: { color: themeColors.brandNavy, fontWeight: "700" },

  profileTabs: {
    flexDirection: "row",
    marginTop: 24,
    marginHorizontal: 20,
    borderRadius: radii.md,
    backgroundColor: themeColors.surfaceMuted,
    padding: 4,
  },
  profileTab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: radii.sm },
  profileTabActive: { backgroundColor: themeColors.surfaceElevated },
  profileTabText: { fontSize: 13, color: themeColors.textMuted, fontWeight: "500" },
  profileTabTextActive: { color: themeColors.brandNavy, fontWeight: "700" },
  mediaSection: { paddingHorizontal: 20, paddingTop: 16 },
  mediaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  mediaGridItem: { width: 100, height: 100, borderRadius: radii.sm },
  searchSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  profileSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: themeColors.surfaceMuted,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  profileSearchInput: { flex: 1, fontSize: 15, color: themeColors.text },
  profileEmptyText: { textAlign: "center", color: themeColors.textMuted, marginTop: 20, fontSize: 14 },
  bubbleHighlight: {
    borderWidth: 2,
    borderColor: themeColors.brandAccent,
  },
  searchDayHeader: {
    ...typography.label,
    color: themeColors.brandNavy,
    fontWeight: "700",
    marginTop: space.md,
    marginBottom: space.xs,
    paddingHorizontal: 2,
  },
  searchHitHighlight: {
    backgroundColor: "#FFF59D",
    fontWeight: "700",
    color: themeColors.text,
  },
  mediaGridVideo: {
    flex: 1,
    backgroundColor: themeColors.brandNavy,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
  },
  searchHit: {
    marginTop: 12,
    padding: 12,
    backgroundColor: themeColors.surfaceMuted,
    borderRadius: radii.md,
  },
  searchHitTime: { fontSize: 11, color: themeColors.textMuted, marginBottom: 4 },
  searchHitText: { fontSize: 14, color: themeColors.text, lineHeight: 20 },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheetCard: { backgroundColor: themeColors.surfaceElevated, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 24 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: themeColors.border, alignSelf: "center", marginBottom: 16 },
  sheetTitle: { ...typography.titleSm, color: themeColors.text, marginBottom: 20, fontSize: 18 },
  sheetGrid: { flexDirection: "row", justifyContent: "space-around" },
  sheetOption: { alignItems: "center", gap: 8, width: 72 },
  sheetIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  sheetLabel: { fontSize: 13, color: themeColors.text, fontWeight: "500" },
  policyBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: "#fef3c7",
  },
  policyText: { flex: 1, fontSize: 12, color: "#92400e", lineHeight: 16 },
  limitedBar: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 10,
  },
  limitedText: { fontSize: 14, color: themeColors.textMuted, fontWeight: "500", flexShrink: 1 },
  previewBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" },
  previewClose: { position: "absolute", right: 16, zIndex: 10 },
  profileBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  profileCard: { flex: 1, backgroundColor: themeColors.surfaceElevated },
  profileClose: { position: "absolute", top: 52, right: 16, zIndex: 10, padding: 4 },
  profileCenter: { alignItems: "center", marginTop: 40 },
  profileAvatar: { width: 100, height: 100, borderRadius: 50 },
  profileAvatarFb: { backgroundColor: themeColors.brandNavy, alignItems: "center", justifyContent: "center" },
  profileAvatarInitial: { color: "#fff", fontWeight: "700", fontSize: 40 },
  profileName: { fontSize: 22, fontWeight: "700", color: themeColors.text, marginTop: 16 },
  profileStatusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  profileDot: { width: 10, height: 10, borderRadius: 5 },
  profileDotOnline: { backgroundColor: "#4CAF50" },
  profileDotOffline: { backgroundColor: themeColors.textMuted },
  profileStatusText: { fontSize: 14, color: themeColors.textMuted },
  profileActions: { flexDirection: "row", justifyContent: "center", gap: 40, marginTop: 40 },
  profileActionBtn: { alignItems: "center", gap: 6 },
  profileActionText: { fontSize: 13, color: themeColors.textMuted, fontWeight: "500" },
}));
}

// ─── Voice note player ──────────────────────────────────────────────────────

function VoicePlayer({ uri, isMine }: { uri: string; isMine: boolean }) {
  const themeColors = useThemeColors();
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    return () => {
      sound?.setOnPlaybackStatusUpdate(null);
      sound?.unloadAsync();
    };
  }, [sound]);

  const toggle = useCallback(async () => {
    if (playing && sound) { await sound.pauseAsync(); setPlaying(false); return; }
    if (sound) { await sound.playAsync(); setPlaying(true); return; }
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound: s } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        (st) => {
          if (!st.isLoaded) return;
          setPos(st.positionMillis);
          setDur(st.durationMillis ?? 0);
          if (st.didJustFinish) { setPlaying(false); s.setPositionAsync(0); }
        }
      );
      setSound(s);
      setPlaying(true);
    } catch {
      Alert.alert("Error", "Could not play audio.");
    }
  }, [uri, sound, playing]);

  const progress = dur > 0 ? pos / dur : 0;
  const fg = isMine ? "rgba(255,255,255,0.9)" : themeColors.brandNavy;
  const barBg = isMine ? "rgba(255,255,255,0.3)" : themeColors.border;
  const barFill = isMine ? "#fff" : themeColors.brandNavy;
  const timeFg = isMine ? "rgba(255,255,255,0.7)" : themeColors.textMuted;

  return (
    <Pressable onPress={toggle} style={voiceStyles.row}>
      <Ionicons name={playing ? "pause" : "play"} size={22} color={fg} />
      <View style={[voiceStyles.bar, { backgroundColor: barBg }]}>
        <View style={[voiceStyles.fill, { flex: progress, backgroundColor: barFill }]} />
        <View style={{ flex: 1 - progress }} />
      </View>
      <Text style={[voiceStyles.time, { color: timeFg }]}>{formatDuration(playing ? pos : dur)}</Text>
    </Pressable>
  );
}

const voiceStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 180 },
  bar: { flex: 1, height: 4, borderRadius: 2, flexDirection: "row", overflow: "hidden" },
  fill: {},
  time: { fontSize: 11, minWidth: 36, textAlign: "right" },
});

// ─── Main component ─────────────────────────────────────────────────────────

export function ChatRoomScreen({
  conversationId,
  partner,
  isGroup = false,
  memberCount,
  groupDescription: groupDescriptionProp,
  onGoBack,
  targetMessageId,
  searchSeed,
}: Props) {
  const themeColors = useThemeColors();
  const styles = useChatRoomStyles();
  const insets = useSafeAreaInsets();
  const { user: authUser } = useAuth();
  const { socket } = useSocket();
  const { isOnline: isUserOnline } = useOnlinePresence();
  const queryClient = useQueryClient();
  const sectionListRef = useRef<SectionList<Message>>(null);
  /**
   * Tracks how far the user has scrolled away from the latest message.
   * `> 200` triggers the scroll-to-bottom FAB so the user can re-pin to
   * live without dragging back manually. Also drives the auto-scroll
   * behavior when a new socket message arrives (we only scroll-pin if
   * the user is already near the bottom — never yank them away).
   */
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [text, setText] = useState("");
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordSecs, setRecordSecs] = useState(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [mediaViewer, setMediaViewer] = useState<{ index: number } | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const didInitialScrollRef = useRef(false);
  const [profileSearch, setProfileSearch] = useState("");
  const [profileTab, setProfileTab] = useState<"info" | "media" | "search">("info");
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [nudgePickerOpen, setNudgePickerOpen] = useState(false);
  const isTrainerView =
    !isGroup &&
    typeof (authUser as { account_type?: string } | null)?.account_type === "string" &&
    (authUser as { account_type?: string } | null)!.account_type === "Trainer";
  const [partnerLastSeen, setPartnerLastSeen] = useState<string | null>(null);
  const currentUserId = String((authUser as any)?._id ?? (authUser as any)?.id ?? "");
  const chatE2E = useChatE2E(isGroup ? undefined : partner?._id);
  const [showGroupSheet, setShowGroupSheet] = useState(false);
  const [liveMemberCount, setLiveMemberCount] = useState(memberCount ?? 0);

  const { data: groupMembersData } = useQuery({
    queryKey: queryKeys.chats.groupMembers(conversationId),
    queryFn: () => fetchGroupMembers(conversationId),
    enabled: isGroup,
    staleTime: 30_000,
  });

  const resolveSenderId = (sender: SenderRef): string =>
    typeof sender === "object" && sender?._id ? String(sender._id) : String(sender);

  const groupAvatarUrl = isGroup
    ? getS3ImageUrl(groupMembersData?.groupAvatar ?? partner?.profile_picture)
    : null;

  useEffect(() => {
    if (groupMembersData?.members?.length) {
      setLiveMemberCount(groupMembersData.members.length);
    }
  }, [groupMembersData]);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [chatPolicy, setChatPolicy] = useState<{
    hasPaidSession: boolean;
    remainingToday: number;
    dailyLimit: number;
  } | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editTarget, setEditTarget] = useState<Message | null>(null);
  const [editDraft, setEditDraft] = useState("");
  /**
   * Long-press action sheet target — when set, the message-level
   * reactions bar + actions menu opens for that bubble.
   */
  const [actionsTarget, setActionsTarget] = useState<Message | null>(null);
  const [forwardTarget, setForwardTarget] = useState<Message | null>(null);
  /** Message ids whose transcript was just toggled visible. */
  const [transcriptVisible, setTranscriptVisible] = useState<Record<string, boolean>>({});
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  const [disappearingSheetOpen, setDisappearingSheetOpen] = useState(false);
  const [disappearingMinutes, setDisappearingMinutes] = useState(0);
  const [scheduleComposerOpen, setScheduleComposerOpen] = useState(false);
  const [scheduledListOpen, setScheduledListOpen] = useState(false);

  /**
   * Hydrate the local `disappearingMinutes` from the cached
   * conversations list — the conversation row already carries the
   * field thanks to the schema change.
   */
  useEffect(() => {
    try {
      const cached = queryClient.getQueryData(
        queryKeys.chats.conversations
      ) as any[] | undefined;
      const row = cached?.find((c: any) => String(c._id) === String(conversationId));
      if (row && typeof row.disappearingTtlMinutes === "number") {
        setDisappearingMinutes(row.disappearingTtlMinutes);
      }
    } catch {
      /* cache shape mismatch, ignore */
    }
  }, [conversationId, queryClient]);

  useEffect(() => {
    if (isGroup || !partner?._id) return;
    (async () => {
      try {
        const res = await apiClient.get(API_ROUTES.chat.policy(partner._id));
        const data = (res as any)?.data?.data ?? (res as any)?.data;
        if (data) setChatPolicy(data);
      } catch { /* non-critical */ }
    })();
  }, [partner?._id, isGroup]);

  useEffect(() => {
    didInitialScrollRef.current = false;
  }, [conversationId]);

  useEffect(() => {
    if (!isGroup && partner?._id) setPartnerOnline(isUserOnline(partner._id));
  }, [partner?._id, isUserOnline, isGroup]);

  // Fetch partner's online status / lastSeen (1:1 only)
  useEffect(() => {
    if (isGroup || !socket || !partner?._id) return;

    const handleUserStatus = (data: any) => {
      if (String(data?.userId) === partner._id) {
        setPartnerOnline(data?.status === "online");
        if (data?.status === "offline") setPartnerLastSeen(new Date().toISOString());
      }
    };
    socket.on("userStatus", handleUserStatus);

    const handleOnlineUser = (data: any) => {
      if (data?.user && data.user[partner._id]) {
        setPartnerOnline(true);
      }
    };
    socket.on("onlineUser", handleOnlineUser);

    return () => {
      socket.off("userStatus", handleUserStatus);
      socket.off("onlineUser", handleOnlineUser);
    };
  }, [socket, partner?._id, isGroup]);

  // Typing indicators
  useEffect(() => {
    if (!socket || !conversationId) return;
    const handleTyping = (data: any) => {
      if (data?.conversationId === conversationId && data?.userId !== currentUserId) {
        setPartnerTyping(true);
      }
    };
    const handleStopTyping = (data: any) => {
      if (data?.conversationId === conversationId && data?.userId !== currentUserId) {
        setPartnerTyping(false);
      }
    };
    socket.on("CHAT_TYPING", handleTyping);
    socket.on("CHAT_STOP_TYPING", handleStopTyping);
    return () => {
      socket.off("CHAT_TYPING", handleTyping);
      socket.off("CHAT_STOP_TYPING", handleStopTyping);
    };
  }, [socket, conversationId, currentUserId]);

  const emitTyping = useCallback(() => {
    if (!socket || !conversationId) return;
    socket.emit("CHAT_TYPING", { conversationId, userId: currentUserId });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("CHAT_STOP_TYPING", { conversationId, userId: currentUserId });
    }, 3000);
  }, [socket, conversationId, currentUserId]);

  const handleTextChange = useCallback((t: string) => {
    setText(t);
    emitTyping();
  }, [emitTyping]);

  /**
   * Message pagination — initial page is 30 (snappy first paint), subsequent
   * pages are 10 at a time (user's spec for "Load 10 earlier"). Backend sort
   * is DESC (newest first); page=1 returns the latest slice and the user
   * paginates BACKWARDS through history via the "Load 10 earlier" button at
   * the top of the list (and auto-load on near-top scroll).
   */
  const FIRST_PAGE_LIMIT = 30;
  const OLDER_PAGE_LIMIT = 10;
  const messagesQuery = useInfiniteQuery<
    { page: number; limit: number; rows: Message[] }
  >({
    queryKey: queryKeys.chats.messages(conversationId),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const page = (pageParam as number) ?? 1;
      const limit = page === 1 ? FIRST_PAGE_LIMIT : OLDER_PAGE_LIMIT;
      const res = await apiClient.get(API_ROUTES.chat.messages(conversationId), {
        params: { page, limit },
      });
      const body = (res as any)?.data ?? res;
      const rows: Message[] = (body?.data ?? body?.result ?? []) as Message[];
      return { page, limit, rows };
    },
    getNextPageParam: (lastPage) => {
      // No older messages left if the server returned fewer rows than asked.
      if (!lastPage?.rows || lastPage.rows.length < lastPage.limit) return undefined;
      return lastPage.page + 1;
    },
    enabled: !!conversationId,
    staleTime: 10_000,
    /**
     * Previously polled every 15s. Disabled because:
     *   1. The socket `CHAT_MESSAGE` event already invalidates this query.
     *   2. The refetch interrupted user scroll & visibly redrew bubbles.
     *   3. Pagination state (`fetchNextPage`) gets unstable under polling.
     */
  });

  const serverMessages = useMemo<Message[]>(() => {
    const pages = messagesQuery.data?.pages ?? [];
    const all: Message[] = [];
    for (const p of pages) {
      for (const m of p.rows) all.push(m);
    }
    return all;
  }, [messagesQuery.data]);

  const loadOlderMessages = useCallback(() => {
    if (messagesQuery.hasNextPage && !messagesQuery.isFetchingNextPage) {
      void messagesQuery.fetchNextPage();
    }
  }, [messagesQuery]);

  const allMessages = useMemo(() => {
    const seen = new Set<string>();
    const merged: Message[] = [];
    for (const m of serverMessages) {
      if (!seen.has(m._id)) { seen.add(m._id); merged.push(m); }
    }
    for (const m of localMessages) {
      if (!seen.has(m._id)) { seen.add(m._id); merged.push(m); }
    }
    return sortMessagesAsc(merged);
  }, [serverMessages, localMessages]);

  const senderNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of groupMembersData?.members ?? []) {
      map.set(String(m._id), m.fullname ?? "Member");
    }
    for (const m of allMessages) {
      const s = m.senderId;
      if (s && typeof s === "object" && s.fullname) {
        map.set(String(s._id), s.fullname);
      }
    }
    return map;
  }, [groupMembersData, allMessages]);

  const displayMessages = useMemo(
    () =>
      allMessages.map((m) => ({
        ...m,
        content: isGroup ? m.content : chatE2E.decryptForDisplay(m.content),
        _encrypted: !isGroup && isEncryptedChatContent(m.content),
      })),
    [allMessages, chatE2E.decryptForDisplay, isGroup]
  );

  const messageSections = useMemo(
    () => groupMessagesByDayAsc(displayMessages),
    [displayMessages]
  );

  const scrollToLatestMessage = useCallback((animated: boolean) => {
    const list = sectionListRef.current;
    if (!list || messageSections.length === 0) return;

    for (let sectionIndex = messageSections.length - 1; sectionIndex >= 0; sectionIndex--) {
      const items = messageSections[sectionIndex]?.data;
      if (!items?.length) continue;
      try {
        list.scrollToLocation({
          sectionIndex,
          itemIndex: items.length - 1,
          animated,
        });
      } catch {
        /* SectionList not laid out yet */
      }
      return;
    }
  }, [messageSections]);

  useEffect(() => {
    if (allMessages.length === 0) return;
    const isInitial = !didInitialScrollRef.current;
    const animated = !isInitial;
    if (isInitial) didInitialScrollRef.current = true;
    /**
     * Only auto-pin when the user is already near the bottom (or this
     * is the initial mount). If they've scrolled up to read history,
     * don't yank them away when a new message lands — surface the FAB
     * instead.
     */
    if (!isInitial && !isNearBottom) return;
    const t = setTimeout(() => scrollToLatestMessage(animated), 60);
    return () => clearTimeout(t);
  }, [allMessages.length, scrollToLatestMessage, isNearBottom]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const onShow = () => {
      if (allMessages.length > 0) {
        setTimeout(() => scrollToLatestMessage(true), Platform.OS === "ios" ? 60 : 140);
      }
    };
    const showSub = Keyboard.addListener(showEvent, onShow);
    return () => showSub.remove();
  }, [allMessages.length, scrollToLatestMessage]);

  // Mark messages as read when opening and receiving
  useEffect(() => {
    if (!socket || !conversationId || !currentUserId) return;
    socket.emit("CHAT_READ", { conversationId, readerId: currentUserId });
  }, [socket, conversationId, currentUserId, allMessages.length]);

  // Listen for delivered/read receipts to update message status
  useEffect(() => {
    if (!socket || !conversationId) return;

    const patchMessageStatus = (
      updater: (m: Message) => Message
    ) => {
      setLocalMessages((prev) => prev.map(updater));
      queryClient.setQueryData<Message[]>(["chatMessages", conversationId], (old) =>
        old?.map(updater) ?? old
      );
    };

    const handleDelivered = (data: any) => {
      if (data?.conversationId !== conversationId) return;
      const ids = data.messageIds ? data.messageIds : data.messageId ? [data.messageId] : [];
      if (!ids.length) return;
      patchMessageStatus((m) =>
        ids.includes(m._id) && (m.status === "sent" || m.status === "sending")
          ? { ...m, status: "delivered", pending: false }
          : m
      );
    };
    const handleRead = (data: any) => {
      if (data?.conversationId !== conversationId) return;
      patchMessageStatus((m) => {
        const senderId = resolveSenderId(m.senderId);
        return senderId === currentUserId && m.status !== "read"
          ? { ...m, status: "read" }
          : m;
      });
    };

    socket.on("CHAT_DELIVERED", handleDelivered);
    socket.on("CHAT_READ", handleRead);
    return () => {
      socket.off("CHAT_DELIVERED", handleDelivered);
      socket.off("CHAT_READ", handleRead);
    };
  }, [socket, conversationId, currentUserId, queryClient, resolveSenderId]);

  useEffect(() => {
    if (!conversationId) return;
    void flushOfflineChatQueue();
  }, [conversationId]);

  useEffect(() => {
    return subscribeOfflineChatQueueEvents((event) => {
      if (event.type === "sent") {
        const msg = event.message as Message;
        setLocalMessages((prev) =>
          prev.map((m) =>
            m._id === event.clientId
              ? {
                  ...msg,
                  _id: String(msg._id ?? event.clientId),
                  status: "sent",
                  pending: false,
                }
              : m
          )
        );
        queryClient.invalidateQueries({ queryKey: ["chatMessages", conversationId] });
      } else if (event.type === "failed") {
        setLocalMessages((prev) =>
          prev.map((m) =>
            m._id === event.clientId
              ? { ...m, status: "failed", pending: false }
              : m
          )
        );
        haptics.error();
      }
    });
  }, [conversationId, queryClient]);

  useEffect(() => {
    if (!socket || !conversationId) return;
    const handleReceive = (msg: any) => {
      if (msg?.conversationId !== conversationId) return;
      const clientId = msg?.clientMessageId ? String(msg.clientMessageId) : null;
      setLocalMessages((prev) => {
        if (prev.some((m) => m._id === msg._id)) return prev;
        if (clientId) {
          const tempIdx = prev.findIndex((m) => m._id === clientId);
          if (tempIdx >= 0) {
            const next = [...prev];
            next[tempIdx] = {
              ...msg,
              _id: String(msg._id),
              status: msg.status ?? "sent",
              pending: false,
            };
            return next;
          }
        }
        return [...prev, msg];
      });
      queryClient.invalidateQueries({ queryKey: ["chatMessages", conversationId] });
      if (msg?.senderId && String(msg.senderId) !== currentUserId && msg?._id) {
        socket.emit("CHAT_DELIVERED", {
          messageIds: [String(msg._id)],
          conversationId,
        });
      }
      socket.emit("CHAT_READ", { conversationId, readerId: currentUserId });
    };
    socket.on("CHAT_MESSAGE", handleReceive);
    socket.emit("JOIN_CHAT", { conversationId });
    return () => {
      socket.off("CHAT_MESSAGE", handleReceive);
      socket.emit("LEAVE_CHAT", { conversationId });
    };
  }, [socket, conversationId, queryClient, currentUserId]);

  /** Re-join chat room after socket reconnect so messages keep flowing. */
  useEffect(() => {
    if (!socket || !conversationId) return;
    const rejoin = () => {
      if (socket.connected) {
        socket.emit("JOIN_CHAT", { conversationId });
        queryClient.invalidateQueries({ queryKey: ["chatMessages", conversationId] });
        void flushOfflineChatQueue();
      }
    };
    socket.on("connect", rejoin);
    socket.on("reconnect", rejoin);
    return () => {
      socket.off("connect", rejoin);
      socket.off("reconnect", rejoin);
    };
  }, [socket, conversationId, queryClient]);

  /**
   * Socket sync for the new chat features (reactions, pin updates,
   * conversation-level changes like disappearing TTL, and async voice
   * transcripts). They all reduce to invalidating the relevant query.
   */
  useEffect(() => {
    if (!socket || !conversationId) return;
    const onReactionUpdated = (p: any) => {
      if (p?.conversationId !== conversationId) return;
      queryClient.invalidateQueries({
        queryKey: queryKeys.chats.messages(conversationId),
      });
    };
    const onPinned = (p: any) => {
      if (p?.conversationId !== conversationId) return;
      queryClient.invalidateQueries({
        queryKey: queryKeys.chats.pinned(conversationId),
      });
    };
    const onConvUpdated = (p: any) => {
      if (p?.conversationId !== conversationId) return;
      if (typeof p?.disappearingTtlMinutes === "number") {
        setDisappearingMinutes(p.disappearingTtlMinutes);
      }
    };
    const onTranscriptReady = (p: any) => {
      if (p?.conversationId !== conversationId) return;
      queryClient.invalidateQueries({
        queryKey: queryKeys.chats.messages(conversationId),
      });
    };
    socket.on("CHAT_REACTION_UPDATED", onReactionUpdated);
    socket.on("CHAT_PINNED", onPinned);
    socket.on("CHAT_CONVERSATION_UPDATED", onConvUpdated);
    socket.on("CHAT_TRANSCRIPT_READY", onTranscriptReady);
    return () => {
      socket.off("CHAT_REACTION_UPDATED", onReactionUpdated);
      socket.off("CHAT_PINNED", onPinned);
      socket.off("CHAT_CONVERSATION_UPDATED", onConvUpdated);
      socket.off("CHAT_TRANSCRIPT_READY", onTranscriptReady);
    };
  }, [socket, conversationId, queryClient]);

  useEffect(() => {
    setLocalMessages((prev) => {
      const serverIds = new Set(serverMessages.map((m: Message) => m._id));
      const serverClientIds = new Set(
        serverMessages
          .map((m: Message & { clientMessageId?: string }) => m.clientMessageId)
          .filter(Boolean)
          .map(String)
      );
      const remaining = prev.filter((m) => {
        if (serverIds.has(m._id)) return false;
        if (m._id.startsWith("temp_") && serverClientIds.has(m._id)) return false;
        return true;
      });
      return remaining.length === prev.length ? prev : remaining;
    });
  }, [serverMessages]);

  const resendFailedMessage = useCallback(
    async (msg: Message) => {
      if (msg.status !== "failed") return;
      haptics.press();
      setLocalMessages((prev) =>
        prev.map((m) =>
          m._id === msg._id ? { ...m, status: "sending", pending: true } : m
        )
      );

      if (msg.type === "text" && msg.content) {
        await enqueueChatMessage({
          clientId: msg._id,
          conversationId,
          receiverId: isGroup ? null : partner?._id,
          content: msg.content,
          type: "text",
          replyToMessageId: msg.replyToMessageId,
          enqueuedAt: Date.now(),
          attempts: 0,
        });
        void flushOfflineChatQueue();
        return;
      }

      const fileUri = msg.localFileUri ?? msg.mediaUrl;
      if (
        fileUri &&
        msg.uploadFileName &&
        msg.uploadMimeType &&
        (msg.type === "image" || msg.type === "video" || msg.type === "voice")
      ) {
        await enqueueChatMessage({
          clientId: msg._id,
          conversationId,
          receiverId: isGroup ? null : partner?._id,
          content: msg.content,
          type: msg.type as QueuedChatMessage["type"],
          localFileUri: fileUri,
          fileName: msg.uploadFileName,
          mimeType: msg.uploadMimeType,
          enqueuedAt: Date.now(),
          attempts: 0,
        });
        void flushOfflineChatQueue();
      }
    },
    [conversationId, isGroup, partner?._id]
  );

  // ─── Send text ──────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    const plain = text.trim();
    if (!plain || isSendingMessage) return;
    if (!isGroup && !partner?._id) return;
    haptics.press();
    const content = chatE2E.canEncrypt ? chatE2E.encryptForSend(plain) : plain;
    setText("");
    setShowEmoji(false);
    const replyId = replyTo?._id ?? null;
    setReplyTo(null);
    setIsSendingMessage(true);
    if (socket) socket.emit("CHAT_STOP_TYPING", { conversationId, userId: currentUserId });
    const tempId = `temp_${Date.now()}`;
    const tempMsg: Message = {
      _id: tempId,
      senderId: currentUserId,
      receiverId: isGroup ? "" : partner._id,
      content,
      type: "text",
      status: "sending",
      pending: true,
      createdAt: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, tempMsg]);
    try {
      const res = await apiClient.post(API_ROUTES.chat.send, {
        ...(isGroup ? {} : { receiverId: partner._id }),
        content,
        type: "text",
        conversationId,
        clientMessageId: tempId,
        ...(replyId ? { replyToMessageId: replyId } : {}),
      });
      const data = (res as any)?.data?.data ?? (res as any)?.data;
      if (data?.message) {
        setLocalMessages((prev) =>
          prev.map((m) =>
            m._id === tempId
              ? { ...data.message, _id: data.message._id, status: "sent" as const, pending: false }
              : m
          )
        );
      }
      if (socket) socket.emit("CHAT_MESSAGE", { ...data?.message, conversationId });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (chatPolicy && !chatPolicy.hasPaidSession) {
        setChatPolicy((p) => p ? { ...p, remainingToday: Math.max(0, p.remainingToday - 1) } : p);
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const isNetworkLevel =
        !e?.response &&
        (e?.code === "ERR_NETWORK" ||
          e?.code === "ECONNABORTED" ||
          e?.message === "Network Error" ||
          String(e?.message ?? "").includes("Network request failed"));

      if (isNetworkLevel) {
        // Park the message in the persistent queue and *keep* the
        // optimistic bubble — the network banner already explains why.
        await enqueueChatMessage({
          clientId: tempId,
          conversationId,
          receiverId: isGroup ? null : partner._id,
          content,
          type: "text",
          replyToMessageId: replyId,
          enqueuedAt: Date.now(),
          attempts: 0,
        });
        setLocalMessages((prev) =>
          prev.map((m) =>
            m._id === tempId
              ? { ...m, status: "sending", pending: true }
              : m
          )
        );
        haptics.warning();
      } else if (status === 429) {
        setLocalMessages((prev) => prev.filter((m) => m._id !== tempId));
        haptics.warning();
        setRateLimited(true);
        const msg = e?.response?.data?.data?.error ?? e?.response?.data?.error ?? "Message limit reached.";
        setChatPolicy((p) => (p ? { ...p, remainingToday: 0 } : p));
        Alert.alert("Limit Reached", msg);
      } else {
        setLocalMessages((prev) =>
          prev.map((m) =>
            m._id === tempId ? { ...m, status: "failed", pending: false } : m
          )
        );
        haptics.error();
      }
    } finally {
      setIsSendingMessage(false);
    }
  }, [
    text,
    partner,
    isGroup,
    currentUserId,
    socket,
    conversationId,
    queryClient,
    chatPolicy,
    isSendingMessage,
    chatE2E,
    replyTo,
  ]);

  // ─── Send media ─────────────────────────────────────────────────────────────

  const sendMediaMessage = useCallback(
    async (fileUri: string, fileName: string, mimeType: string, type: "image" | "video" | "voice") => {
      if (!isGroup && !partner?._id) return;
      setUploading(true);
      const tempId = `temp_${Date.now()}`;
      const label = type === "image" ? "📷 Photo" : type === "video" ? "🎬 Video" : "🎤 Voice note";
      setLocalMessages((prev) => [...prev, {
        _id: tempId,
        senderId: currentUserId,
        receiverId: isGroup ? "" : partner._id,
        content: label,
        type,
        mediaUrl: fileUri,
        status: "sending",
        pending: true,
        createdAt: new Date().toISOString(),
        localFileUri: fileUri,
        uploadFileName: fileName,
        uploadMimeType: mimeType,
      }]);
      try {
        const { uploadUrl, mediaUrl } = await getPresignedUploadUrl(fileName, mimeType);
        await uploadToS3(uploadUrl, fileUri, mimeType);
        const res = await apiClient.post(API_ROUTES.chat.send, {
          ...(isGroup ? {} : { receiverId: partner._id }),
          content: label,
          type,
          mediaUrl,
          conversationId,
          clientMessageId: tempId,
        });
        const data = (res as any)?.data?.data ?? (res as any)?.data;
        if (data?.message) {
          setLocalMessages((prev) =>
            prev.map((m) =>
              m._id === tempId
                ? {
                    ...data.message,
                    _id: data.message._id,
                    status: "sent" as const,
                    pending: false,
                    localFileUri: undefined,
                    uploadFileName: undefined,
                    uploadMimeType: undefined,
                  }
                : m
            )
          );
        }
        if (socket) socket.emit("CHAT_MESSAGE", { ...data?.message, conversationId });
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      } catch (e: any) {
        if (isNetworkSendError(e)) {
          await enqueueChatMessage({
            clientId: tempId,
            conversationId,
            receiverId: isGroup ? null : partner._id,
            content: label,
            type,
            localFileUri: fileUri,
            fileName,
            mimeType,
            enqueuedAt: Date.now(),
            attempts: 0,
          });
          setLocalMessages((prev) =>
            prev.map((m) =>
              m._id === tempId ? { ...m, status: "sending", pending: true } : m
            )
          );
          haptics.warning();
        } else {
          setLocalMessages((prev) =>
            prev.map((m) =>
              m._id === tempId ? { ...m, status: "failed", pending: false } : m
            )
          );
          haptics.error();
        }
      } finally {
        setUploading(false);
      }
    },
    [partner, isGroup, currentUserId, socket, conversationId, queryClient]
  );

  // ─── Pick/capture media ─────────────────────────────────────────────────────

  const pickImage = useCallback(async () => {
    setShowAttach(false);
    await delay(600);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert("Permission", "Photo library access is required."); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const ext = (asset.uri.split(".").pop() ?? "jpg").toLowerCase();
      await sendMediaMessage(asset.uri, `photo_${Date.now()}.${ext}`, asset.mimeType ?? `image/${ext}`, "image");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not pick image.");
    }
  }, [sendMediaMessage]);

  const takePhoto = useCallback(async () => {
    setShowAttach(false);
    await delay(600);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { Alert.alert("Permission", "Camera access is required."); return; }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const ext = (asset.uri.split(".").pop() ?? "jpg").toLowerCase();
      await sendMediaMessage(asset.uri, `camera_${Date.now()}.${ext}`, asset.mimeType ?? `image/${ext}`, "image");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not take photo.");
    }
  }, [sendMediaMessage]);

  const pickVideo = useCallback(async () => {
    setShowAttach(false);
    await delay(600);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert("Permission", "Photo library access is required."); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"], quality: 0.7, videoMaxDuration: 120 });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const ext = (asset.uri.split(".").pop() ?? "mp4").toLowerCase();
      await sendMediaMessage(asset.uri, `video_${Date.now()}.${ext}`, asset.mimeType ?? `video/${ext}`, "video");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not pick video.");
    }
  }, [sendMediaMessage]);

  // ─── Voice recording ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!recording) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [recording, pulseAnim]);

  const startRecording = useCallback(async () => {
    setShowAttach(false);
    await delay(400);
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) { Alert.alert("Permission", "Microphone access is required."); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      haptics.impact();
      setRecording(rec);
      setRecordSecs(0);
      recordTimerRef.current = setInterval(() => setRecordSecs((s) => s + 1), 1000);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not start recording.");
    }
  }, []);

  const cancelRecording = useCallback(async () => {
    haptics.warning();
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    try { await recording?.stopAndUnloadAsync(); } catch { /* already stopped */ }
    setRecording(null);
    setRecordSecs(0);
  }, [recording]);

  const finishRecording = useCallback(async () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      setRecording(null);
      setRecordSecs(0);
      if (!uri) return;
      haptics.press();
      await sendMediaMessage(uri, `voice_${Date.now()}.m4a`, "audio/mp4", "voice");
    } catch (e: any) {
      setRecording(null);
      setRecordSecs(0);
      haptics.error();
      Alert.alert("Error", e?.message ?? "Could not send voice note.");
    }
  }, [recording, sendMediaMessage]);

  const insertEmoji = useCallback((emoji: string) => {
    haptics.select();
    setText((prev) => prev + emoji);
  }, []);

  // ─── Profile actions ──────────────────────────────────────────────────────

  const handleProfileAction = useCallback(() => {
    if (isGroup) {
      setShowGroupSheet(true);
      return;
    }
    const options = ["Block User", "Report User", "Cancel"];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, destructiveButtonIndex: 0, cancelButtonIndex: 2, title: partner?.fullname ?? "User" },
        async (idx) => {
          if (idx === 0) {
            Alert.alert("Block User", `Block ${partner?.fullname}?`, [
              { text: "Cancel", style: "cancel" },
              {
                text: "Block", style: "destructive",
                onPress: async () => {
                  try {
                    await apiClient.post(API_ROUTES.user.blockUser, { userId: partner._id });
                    Alert.alert("Done", "User blocked.");
                    onGoBack();
                  } catch (e: any) {
                    Alert.alert("Error", e?.response?.data?.error ?? "Could not block user.");
                  }
                },
              },
            ]);
          } else if (idx === 1) {
            ActionSheetIOS.showActionSheetWithOptions(
              { options: [...REPORT_REASONS, "Cancel"], cancelButtonIndex: REPORT_REASONS.length, title: "Report reason" },
              async (rIdx) => {
                if (rIdx >= REPORT_REASONS.length) return;
                try {
                  await apiClient.post(API_ROUTES.user.reportUser, { userId: partner._id, reason: REPORT_REASONS[rIdx] });
                  Alert.alert("Report Submitted", "Thank you. We will review your report.");
                } catch (e: any) {
                  Alert.alert("Error", e?.response?.data?.error ?? "Could not submit report.");
                }
              }
            );
          }
        }
      );
    } else {
      Alert.alert(partner?.fullname ?? "User", "Choose an action", [
        {
          text: "Block User", style: "destructive",
          onPress: () => {
            Alert.alert("Block?", `Block ${partner?.fullname}?`, [
              { text: "Cancel", style: "cancel" },
              {
                text: "Block", style: "destructive",
                onPress: async () => {
                  try {
                    await apiClient.post(API_ROUTES.user.blockUser, { userId: partner._id });
                    Alert.alert("Done", "User blocked.");
                    onGoBack();
                  } catch (e: any) {
                    Alert.alert("Error", e?.response?.data?.error ?? "Could not block user.");
                  }
                },
              },
            ]);
          },
        },
        {
          text: "Report User",
          onPress: () => {
            Alert.alert("Report reason", "", [
              ...REPORT_REASONS.map((r) => ({
                text: r,
                onPress: async () => {
                  try {
                    await apiClient.post(API_ROUTES.user.reportUser, { userId: partner._id, reason: r });
                    Alert.alert("Report Submitted", "Thank you.");
                  } catch (e: any) {
                    Alert.alert("Error", e?.response?.data?.error ?? "Could not submit report.");
                  }
                },
              })),
              { text: "Cancel", style: "cancel" as const },
            ]);
          },
        },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }, [partner, onGoBack]);

  const chatMediaItems = useMemo(() => buildChatMediaList(allMessages), [allMessages]);

  const openMediaViewer = useCallback(
    (messageId: string) => {
      const index = chatMediaItems.findIndex((m) => m.id === messageId);
      if (index >= 0) setMediaViewer({ index });
    },
    [chatMediaItems]
  );

  const jumpToMessage = useCallback(
    (messageId: string) => {
      const loc = findMessageSectionLocation(messageSections, messageId);
      if (!loc) return;
      setShowProfile(false);
      setHighlightedMessageId(messageId);
      requestAnimationFrame(() => {
        try {
          sectionListRef.current?.scrollToLocation({
            sectionIndex: loc.sectionIndex,
            itemIndex: loc.itemIndex,
            animated: true,
            viewPosition: 0.5,
          });
        } catch {
          /* ignore if list not ready */
        }
      });
      setTimeout(() => setHighlightedMessageId(null), 2500);
    },
    [messageSections]
  );

  /**
   * When the chat was opened with a targetMessageId (from the global
   * search results), jump to that message as soon as the section list
   * has the relevant page loaded. We retry a few times because the
   * initial messages query may still be in flight.
   */
  const targetJumpedRef = useRef(false);
  useEffect(() => {
    if (!targetMessageId || targetJumpedRef.current) return;
    if (!messageSections?.length) return;
    const loc = findMessageSectionLocation(messageSections, targetMessageId);
    if (!loc) return;
    targetJumpedRef.current = true;
    jumpToMessage(targetMessageId);
    if (searchSeed) setProfileSearch(searchSeed);
  }, [targetMessageId, messageSections, jumpToMessage, searchSeed]);

  // ─── Render message ─────────────────────────────────────────────────────────

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => {
      const senderId = resolveSenderId(item.senderId);
      const isMine = senderId === currentUserId;
      const senderLabel = isGroup
        ? isMine
          ? "You"
          : senderNameById.get(senderId) ?? "Member"
        : null;
      const mediaUri = resolveChatMediaUri(item.mediaUrl);
      const mediaKind = inferChatMediaKind(item.type, item.mediaUrl);
      const isHighlighted = item._id === highlightedMessageId;
      const showTextFallback =
        !mediaUri ||
        (mediaKind === null && item.type !== "voice");

      const replyPreview = item.replyToMessageId
        ? displayMessages.find((m) => m._id === item.replyToMessageId)
        : null;

      const onLongPressMsg = () => {
        haptics.impact();
        setActionsTarget(item);
      };

      return (
        <View style={[styles.messageRow, isMine ? styles.messageRowMine : styles.messageRowTheirs]}>
          <View
            style={[
              styles.messageColumn,
              isMine ? styles.messageColumnMine : styles.messageColumnTheirs,
            ]}
          >
            {senderLabel ? (
              <Text style={[styles.senderName, isMine && styles.senderNameMine]}>{senderLabel}</Text>
            ) : null}
          <Pressable
            style={{ maxWidth: "100%" }}
            onLongPress={onLongPressMsg}
            onPress={
              isMine && item.status === "failed"
                ? () => void resendFailedMessage(item)
                : undefined
            }
          >
          <View
            style={[
              styles.bubble,
              isMine ? styles.bubbleMine : styles.bubbleTheirs,
              isHighlighted && styles.bubbleHighlight,
            ]}
          >
          {item.forwardedFromMessageId ? (
            <View style={chatExtrasInlineStyles.forwardedBadge}>
              <Ionicons name="arrow-redo-outline" size={11} color={isMine ? "rgba(255,255,255,0.85)" : "#6B7280"} />
              <Text
                style={[
                  chatExtrasInlineStyles.forwardedText,
                  { color: isMine ? "rgba(255,255,255,0.85)" : "#6B7280" },
                ]}
              >
                Forwarded
              </Text>
            </View>
          ) : null}
          {replyPreview ? (
            <View style={styles.replyQuote}>
              <Text style={styles.replyQuoteText} numberOfLines={2}>
                {chatE2E.decryptForDisplay(replyPreview.content)}
              </Text>
            </View>
          ) : null}
          {mediaKind === "image" && mediaUri ? (
            <Pressable onPress={() => openMediaViewer(item._id)}>
              <Image source={{ uri: mediaUri }} style={styles.mediaThumbnail} resizeMode="cover" />
            </Pressable>
          ) : mediaKind === "video" && mediaUri ? (
            <ChatVideoThumbnail
              uri={mediaUri}
              style={styles.videoContainer}
              isMine={isMine}
              onPress={() => openMediaViewer(item._id)}
            />
          ) : item.type === "voice" && mediaUri ? (
            <VoicePlayer uri={mediaUri} isMine={isMine} />
          ) : showTextFallback ? (
            <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>
              {mediaKind === "video" && !mediaUri ? "Video" : item.content}
            </Text>
          ) : null}
          {item.type === "voice" && transcriptVisible[item._id] && item.transcript ? (
            <View style={chatExtrasInlineStyles.transcriptBox}>
              <Text style={chatExtrasInlineStyles.transcriptLabel}>Transcript</Text>
              <Text style={chatExtrasInlineStyles.transcriptText}>{item.transcript}</Text>
            </View>
          ) : null}
          {item.type === "voice" ? (
            <Pressable
              onPress={() => {
                if (item.transcript && item.transcriptStatus === "done") {
                  setTranscriptVisible((s) => ({ ...s, [item._id]: !s[item._id] }));
                  return;
                }
                if (transcribingId === item._id) return;
                setTranscribingId(item._id);
                void transcribeVoiceMessage(item._id)
                  .then(() => {
                    setTranscriptVisible((s) => ({ ...s, [item._id]: true }));
                    queryClient.invalidateQueries({
                      queryKey: queryKeys.chats.messages(conversationId),
                    });
                  })
                  .finally(() => setTranscribingId(null));
              }}
              hitSlop={8}
              style={chatExtrasInlineStyles.transcriptBtn}
            >
              <Ionicons name="text-outline" size={12} color={isMine ? "rgba(255,255,255,0.85)" : "#2563EB"} />
              <Text
                style={[
                  chatExtrasInlineStyles.transcriptBtnText,
                  { color: isMine ? "rgba(255,255,255,0.85)" : "#2563EB" },
                ]}
              >
                {transcribingId === item._id
                  ? "Transcribing…"
                  : transcriptVisible[item._id]
                  ? "Hide transcript"
                  : item.transcript
                  ? "Show transcript"
                  : "Show transcript"}
              </Text>
            </Pressable>
          ) : null}
          <View style={styles.bubbleFooter}>
            {isMine && item.status === "failed" && (
              <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine, { color: "#ef4444" }]}>
                Tap to retry
              </Text>
            )}
            <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>
              {item.editedAt ? "Edited · " : ""}
              {formatTime(item.createdAt)}
            </Text>
            {isMine && !isGroup && (
              <MessageStatus
                status={item.status}
                pending={item.pending || item.status === "sending"}
                failed={item.status === "failed"}
              />
            )}
            {isMine && isGroup && item.status === "failed" && (
              <MessageStatus status="failed" failed />
            )}
          </View>
          </View>
          {item.reactions && item.reactions.length > 0 ? (
            <View
              style={[
                chatExtrasInlineStyles.reactionsRow,
                isMine
                  ? chatExtrasInlineStyles.reactionsRowMine
                  : chatExtrasInlineStyles.reactionsRowTheirs,
              ]}
            >
              {Object.entries(
                item.reactions.reduce<Record<string, number>>((acc, r) => {
                  acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                  return acc;
                }, {})
              ).map(([emoji, count]) => (
                <View key={emoji} style={chatExtrasInlineStyles.reactionChip}>
                  <Text style={chatExtrasInlineStyles.reactionChipEmoji}>{emoji}</Text>
                  {count > 1 ? (
                    <Text style={chatExtrasInlineStyles.reactionChipCount}>{count}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
          </Pressable>
          </View>
        </View>
      );
    },
    [
      conversationId,
      currentUserId,
      displayMessages,
      highlightedMessageId,
      isGroup,
      openMediaViewer,
      queryClient,
      chatE2E,
      senderNameById,
      resolveSenderId,
      resendFailedMessage,
      transcriptVisible,
      transcribingId,
    ]
  );

  const partnerName = partner?.fullname ?? "Chat";
  const partnerAvatar = getS3ImageUrl(partner?.profile_picture);
  const showPolicyBanner = !isGroup && !!(chatPolicy && !chatPolicy.hasPaidSession);
  const composerBottomInset = Math.max(insets.bottom, space.sm);
  /**
   * `chromeHeight` is the real, measured height of everything *above*
   * the KeyboardAvoidingView: the chat header + the pinned-message banner
   * + the trainer-only pinned note + any other pre-list chrome. We
   * measure it via `onLayout` instead of guessing with `insets.top + 60`
   * so the keyboard offset stays correct when the banners appear /
   * disappear.
   */
  const [chromeHeight, setChromeHeight] = useState(insets.top + 60);
  const keyboardVerticalOffset = 0;

  const sharedMedia = chatMediaItems;

  const searchHits = useMemo(() => {
    const q = profileSearch.trim();
    if (!q) return [];
    return displayMessages
      .filter((m) => messageMatchesQuery(m, q))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [displayMessages, profileSearch]);

  const searchSections = useMemo(
    () => groupMessagesByDay(searchHits),
    [searchHits]
  );

  const headerSubtitle = isGroup
    ? `${liveMemberCount || memberCount || 0} member${(liveMemberCount || memberCount || 0) === 1 ? "" : "s"}`
    : partnerTyping
      ? "typing..."
      : chatE2E.isE2EActive
        ? "🔒 End-to-end encrypted"
        : partnerOnline
          ? "online"
          : partnerLastSeen
            ? `last seen ${formatLastSeen(partnerLastSeen)}`
            : "";

  const openPartnerProfile = useCallback(() => {
    if (isGroup) {
      setShowGroupSheet(true);
      return;
    }
    setProfileTab("info");
    setProfileSearch("");
    setShowProfile(true);
  }, [isGroup]);

  return (
    <View style={[styles.root, { backgroundColor: themeColors.background }]}>
      {/*
        Chrome wrapper — measured on every layout pass so the
        KeyboardAvoidingView's offset always matches the real height of
        the header + banners. See `chromeHeight` state above.
      */}
      <View
        onLayout={(e) => {
          const h = Math.round(e.nativeEvent.layout.height);
          if (h > 0 && Math.abs(h - chromeHeight) > 1) setChromeHeight(h);
        }}
      >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + space.sm,
            backgroundColor: themeColors.surfaceElevated,
            borderBottomColor: themeColors.border,
          },
        ]}
      >
        <Pressable
          onPress={onGoBack}
          hitSlop={12}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back to chats"
        >
          <Ionicons name="chevron-back" size={26} color={themeColors.text} />
        </Pressable>
        <Pressable
          onPress={openPartnerProfile}
          style={styles.headerProfileTap}
          accessibilityRole="button"
          accessibilityLabel={`${partnerName} profile`}
        >
          <View>
            {isGroup ? (
              groupAvatarUrl ? (
                <Image source={{ uri: groupAvatarUrl }} style={styles.headerAvatar} />
              ) : (
                <View style={[styles.headerAvatar, styles.headerAvatarFb]}>
                  <Ionicons name="people" size={20} color="#fff" />
                </View>
              )
            ) : partnerAvatar ? (
              <Image source={{ uri: partnerAvatar }} style={styles.headerAvatar} />
            ) : (
              <View style={[styles.headerAvatar, styles.headerAvatarFb]}>
                <Text style={styles.headerAvatarInitial}>{partnerName[0]?.toUpperCase()}</Text>
              </View>
            )}
            {!isGroup && partnerOnline && <View style={styles.onlineDot} />}
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerName} numberOfLines={1}>{partnerName}</Text>
            {partnerTyping ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 1 }}>
                <TypingDots color="#4CAF50" />
                <Text style={[styles.headerSub, styles.headerSubTyping]}>typing…</Text>
              </View>
            ) : !!headerSubtitle ? (
              <Text style={styles.headerSub} numberOfLines={1}>{headerSubtitle}</Text>
            ) : null}
          </View>
        </Pressable>
        {isTrainerView ? (
          <Pressable
            onPress={() => {
              haptics.tap();
              setNudgePickerOpen(true);
            }}
            hitSlop={10}
            style={styles.headerMore}
            accessibilityRole="button"
            accessibilityLabel="Send a nudge to this trainee"
          >
            <Ionicons name="paper-plane-outline" size={18} color={themeColors.brandNavy} />
          </Pressable>
        ) : null}
        {isTrainerView ? (
          <Pressable
            onPress={() => {
              haptics.tap();
              setScheduleComposerOpen(true);
            }}
            onLongPress={() => {
              haptics.impact();
              setScheduledListOpen(true);
            }}
            hitSlop={10}
            style={styles.headerMore}
            accessibilityRole="button"
            accessibilityLabel="Schedule a message"
          >
            <Ionicons name="time-outline" size={18} color={themeColors.brandNavy} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={handleProfileAction}
          hitSlop={10}
          style={styles.headerMore}
          accessibilityRole="button"
          accessibilityLabel="More chat actions"
          accessibilityHint="Open mute, archive, block, or report"
        >
          <Ionicons name="ellipsis-vertical" size={20} color={themeColors.textMuted} />
        </Pressable>
      </View>

      {isTrainerView ? (
        <TrainerNudgePickerSheet
          visible={nudgePickerOpen}
          onClose={() => setNudgePickerOpen(false)}
          traineeId={partner._id}
          traineeName={partner.fullname}
        />
      ) : null}

      {isTrainerView ? (
        <PinnedTraineeNoteCard
          traineeId={partner._id}
          traineeName={partner.fullname}
        />
      ) : null}

      <PinnedMessageBanner
        conversationId={conversationId}
        decryptText={(raw) => chatE2E.decryptForDisplay(raw)}
        onJump={(id) => jumpToMessage(id)}
      />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? keyboardVerticalOffset : 0}
      >
        {showPolicyBanner && (
          <View style={styles.policyBanner}>
            <Ionicons name="information-circle-outline" size={16} color="#f59e0b" />
            <Text style={styles.policyText}>
              {rateLimited || chatPolicy!.remainingToday <= 0
                ? "Daily message limit reached. Book a lesson to unlock unlimited messaging!"
                : `${chatPolicy!.remainingToday} message${chatPolicy!.remainingToday === 1 ? "" : "s"} remaining today. Book a lesson to chat freely.`}
            </Text>
          </View>
        )}
        <SectionList
          ref={sectionListRef}
          sections={messageSections}
          keyExtractor={flatListKeyExtractor}
          renderItem={renderMessage}
          renderSectionHeader={({ section: { title } }) => (
            <ChatDaySeparator label={title} />
          )}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={[
            styles.messageList,
            allMessages.length === 0 && styles.messageListEmpty,
          ]}
          ListHeaderComponent={
            messagesQuery.hasNextPage ? (
              <Pressable
                onPress={loadOlderMessages}
                disabled={messagesQuery.isFetchingNextPage}
                style={({ pressed }) => [
                  {
                    alignSelf: "center",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    marginTop: 8,
                    borderRadius: 16,
                    backgroundColor: themeColors.surfaceElevated,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: themeColors.borderSubtle,
                  },
                  pressed && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Load 10 earlier messages"
              >
                {messagesQuery.isFetchingNextPage ? (
                  <ActivityIndicator size="small" color={themeColors.brandNavy} />
                ) : (
                  <Ionicons name="arrow-up-circle-outline" size={16} color={themeColors.brandNavy} />
                )}
                <Text style={{ color: themeColors.brandNavy, fontSize: 13, fontWeight: "700" }}>
                  {messagesQuery.isFetchingNextPage ? "Loading..." : "Load 10 earlier"}
                </Text>
              </Pressable>
            ) : null
          }
          // Trigger an auto-load of older messages when the user scrolls
          // within ~80 px of the top. Lookback threshold uses
          // `onEndReachedThreshold` analogue via `onScroll` because
          // SectionList doesn't have a built-in "start reached" callback.
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } =
              e.nativeEvent;
            const y = contentOffset.y;
            if (
              y <= 80 &&
              messagesQuery.hasNextPage &&
              !messagesQuery.isFetchingNextPage
            ) {
              loadOlderMessages();
            }
            // Distance from the bottom of the scrollable area.
            const distanceFromBottom =
              contentSize.height - (y + layoutMeasurement.height);
            const near = distanceFromBottom < 200;
            if (near !== isNearBottom) setIsNearBottom(near);
          }}
          scrollEventThrottle={64}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <View style={styles.emptyChatIcon}>
                <Ionicons
                  name={isGroup ? "people-outline" : "chatbubbles-outline"}
                  size={36}
                  color={themeColors.brandNavy}
                />
              </View>
              <Text style={styles.emptyChatTitle}>
                {isGroup ? `Say hi to ${partnerName}` : `Start chatting with ${partnerName}`}
              </Text>
              <Text style={styles.emptyChatText}>
                {chatE2E.isE2EActive
                  ? "Messages here are end-to-end encrypted. Only you and the other person can read them."
                  : "Send a message to break the ice. Photos, videos and voice notes are supported."}
              </Text>
            </View>
          }
          onScrollToIndexFailed={() => {
            /* SectionList scroll recovery */
          }}
          style={styles.messageArea}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        />

        {/* Scroll-to-bottom FAB. Only shown when the user has scrolled
            away from the most recent messages — taps re-pin the list to
            the latest message via the existing `scrollToLatestMessage`
            helper, which handles empty-section edge cases. */}
        {!isNearBottom && messageSections.length > 0 ? (
          <Pressable
            onPress={() => {
              haptics.tap?.();
              scrollToLatestMessage(true);
              setIsNearBottom(true);
            }}
            style={styles.scrollToBottomFab}
            accessibilityRole="button"
            accessibilityLabel="Scroll to latest message"
            hitSlop={6}
          >
            <Ionicons name="chevron-down" size={22} color={themeColors.text} />
          </Pressable>
        ) : null}

        <View style={styles.composer}>
          {replyTo ? (
            <View style={styles.replyBar}>
              <View style={{ flex: 1 }}>
                <Text style={styles.replyBarLabel}>Replying to</Text>
                <Text style={styles.replyBarText} numberOfLines={1}>
                  {chatE2E.decryptForDisplay(replyTo.content)}
                </Text>
              </View>
              <Pressable
                onPress={() => setReplyTo(null)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Cancel reply"
              >
                <Ionicons name="close-circle" size={22} color={themeColors.textMuted} />
              </Pressable>
            </View>
          ) : null}
          {showEmoji && !recording && (
            <View style={styles.emojiTray}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
                contentContainerStyle={styles.emojiScroll}
              >
                {EMOJI_LIST.map((e) => (
                  <Pressable key={e} onPress={() => insertEmoji(e)} style={styles.emojiBtn}>
                    <Text style={styles.emojiText}>{e}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {recording ? (
            <View style={[styles.recordBar, { paddingBottom: composerBottomInset }]}>
              <Animated.View style={[styles.recordDot, { transform: [{ scale: pulseAnim }] }]} />
              <Text style={styles.recordTime}>{formatDuration(recordSecs * 1000)}</Text>
              <Text style={styles.recordLabel}>Recording...</Text>
              <View style={{ flex: 1 }} />
              <Pressable
                onPress={cancelRecording}
                hitSlop={10}
                style={styles.recordCancel}
                accessibilityRole="button"
                accessibilityLabel="Cancel voice message"
              >
                <Ionicons name="trash-outline" size={22} color={themeColors.danger} />
              </Pressable>
              <Pressable
                onPress={finishRecording}
                hitSlop={10}
                style={styles.recordSend}
                accessibilityRole="button"
                accessibilityLabel="Send voice message"
              >
                <Ionicons name="send" size={20} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <View style={[styles.inputBar, { paddingBottom: composerBottomInset }]}>
              {rateLimited ? (
                <View style={styles.limitedBar}>
                  <Ionicons name="lock-closed-outline" size={18} color={themeColors.textMuted} />
                  <Text style={styles.limitedText}>Book a lesson to continue chatting</Text>
                </View>
              ) : (
                <>
                  <View style={styles.inputWrap}>
                    <Pressable
                      onPress={() => {
                        if (showEmoji) {
                          setShowEmoji(false);
                        } else {
                          Keyboard.dismiss();
                          setShowEmoji(true);
                        }
                      }}
                      hitSlop={6}
                      style={styles.inputAccessoryBtn}
                      accessibilityRole="button"
                      accessibilityLabel={showEmoji ? "Hide emoji picker" : "Show emoji picker"}
                      accessibilityState={{ expanded: showEmoji }}
                    >
                      <Ionicons
                        name={showEmoji ? "happy" : "happy-outline"}
                        size={22}
                        color={showEmoji ? themeColors.brandNavy : themeColors.textMuted}
                      />
                    </Pressable>
                    <TextInput
                      style={styles.textInput}
                      value={text}
                      onChangeText={handleTextChange}
                      placeholder="Message"
                      placeholderTextColor={themeColors.textMuted}
                      multiline
                      maxLength={2000}
                      onFocus={() => setShowEmoji(false)}
                    />
                    <Pressable
                      onPress={() => {
                        haptics.tap();
                        setShowAttach(true);
                      }}
                      hitSlop={6}
                      style={styles.inputAccessoryBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Attach photo, video, document, or location"
                    >
                      <Ionicons name="attach" size={22} color={themeColors.textMuted} />
                    </Pressable>
                  </View>
                  {text.trim() ? (
                    <Pressable
                      style={({ pressed }) => [styles.sendBtn, pressed && { transform: [{ scale: 0.94 }] }]}
                      onPress={sendMessage}
                      disabled={isSendingMessage}
                      accessibilityLabel="Send message"
                    >
                      {isSendingMessage ? (
                        <ActivityIndicator size={16} color="#fff" />
                      ) : (
                        <Ionicons name="send" size={18} color="#fff" />
                      )}
                    </Pressable>
                  ) : (
                    <Pressable
                      style={({ pressed }) => [styles.micBtn, pressed && { transform: [{ scale: 0.94 }] }]}
                      onPress={startRecording}
                      accessibilityLabel="Record voice message"
                    >
                      <Ionicons name="mic" size={20} color="#fff" />
                    </Pressable>
                  )}
                </>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      <Modal visible={!!editTarget} transparent animationType="fade" onRequestClose={() => setEditTarget(null)}>
        <View style={styles.editModalBackdrop}>
          <View style={styles.editModalCard}>
            <Text style={styles.editModalTitle}>Edit message</Text>
            <TextInput
              style={styles.editModalInput}
              value={editDraft}
              onChangeText={setEditDraft}
              multiline
              autoFocus
            />
            <View style={styles.editModalActions}>
              <Pressable onPress={() => setEditTarget(null)}>
                <Text style={styles.editModalCancel}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!editTarget || !editDraft.trim()) return;
                  void editChatMessage(editTarget._id, editDraft.trim()).then(() => {
                    queryClient.invalidateQueries({ queryKey: ["chatMessages", conversationId] });
                    setEditTarget(null);
                  });
                }}
              >
                <Text style={styles.editModalSave}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Upload overlay */}
      {uploading && (
        <View style={styles.uploadingOverlay}>
          <View style={styles.uploadingCard}>
            <ActivityIndicator color={themeColors.brandNavy} size="large" />
          </View>
        </View>
      )}

      {/* Attachment sheet */}
      <Modal visible={showAttach} transparent animationType="fade" onRequestClose={() => setShowAttach(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowAttach(false)}>
          <View style={{ flex: 1 }} />
        </Pressable>
        <View style={[styles.sheetCard, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Share</Text>
          <View style={styles.sheetGrid}>
            <Pressable style={styles.sheetOption} onPress={pickImage}>
              <View style={[styles.sheetIcon, { backgroundColor: "#4CAF50" }]}>
                <Ionicons name="image-outline" size={28} color="#fff" />
              </View>
              <Text style={styles.sheetLabel}>Gallery</Text>
            </Pressable>
            <Pressable style={styles.sheetOption} onPress={takePhoto}>
              <View style={[styles.sheetIcon, { backgroundColor: "#FF9800" }]}>
                <Ionicons name="camera-outline" size={28} color="#fff" />
              </View>
              <Text style={styles.sheetLabel}>Camera</Text>
            </Pressable>
            <Pressable style={styles.sheetOption} onPress={pickVideo}>
              <View style={[styles.sheetIcon, { backgroundColor: "#2196F3" }]}>
                <Ionicons name="videocam-outline" size={28} color="#fff" />
              </View>
              <Text style={styles.sheetLabel}>Video</Text>
            </Pressable>
            <Pressable style={styles.sheetOption} onPress={startRecording}>
              <View style={[styles.sheetIcon, { backgroundColor: "#F44336" }]}>
                <Ionicons name="mic-outline" size={28} color="#fff" />
              </View>
              <Text style={styles.sheetLabel}>Voice</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ChatMediaViewerModal
        visible={mediaViewer != null}
        items={chatMediaItems}
        initialIndex={mediaViewer?.index ?? 0}
        onClose={() => setMediaViewer(null)}
      />

      {/* User profile modal */}
      <Modal visible={showProfile} transparent animationType="slide" onRequestClose={() => setShowProfile(false)}>
        <View style={styles.profileBackdrop}>
          <View style={[styles.profileCard, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 14 }]}>
            <Pressable onPress={() => setShowProfile(false)} style={[styles.profileClose, { top: insets.top + 8 }]}>
              <Ionicons name="close" size={28} color={themeColors.text} />
            </Pressable>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.profileCenter}>
                {partnerAvatar ? (
                  <ImageWithSkeleton
                    uri={partnerAvatar}
                    width={100}
                    height={100}
                    borderRadius={50}
                    style={styles.profileAvatar}
                  />
                ) : (
                  <View style={[styles.profileAvatar, styles.profileAvatarFb]}>
                    <Text style={styles.profileAvatarInitial}>{partnerName[0]?.toUpperCase()}</Text>
                  </View>
                )}
                <Text style={styles.profileName}>{partnerName}</Text>
                <View style={styles.profileStatusRow}>
                  <View style={[styles.profileDot, partnerOnline ? styles.profileDotOnline : styles.profileDotOffline]} />
                  <Text style={styles.profileStatusText}>
                    {partnerOnline ? "Online" : partnerLastSeen ? `Last seen ${formatLastSeen(partnerLastSeen)}` : "Offline"}
                  </Text>
                </View>
              </View>

              <View style={styles.profileTabs}>
                {(["info", "media", "search"] as const).map((tab) => (
                  <Pressable
                    key={tab}
                    onPress={() => setProfileTab(tab)}
                    style={[styles.profileTab, profileTab === tab && styles.profileTabActive]}
                  >
                    <Text style={[styles.profileTabText, profileTab === tab && styles.profileTabTextActive]}>
                      {tab === "info" ? "Info" : tab === "media" ? "Media" : "Search"}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {profileTab === "info" && (
                <View style={styles.profileActions}>
                  <Pressable
                    style={styles.profileActionBtn}
                    onPress={() => {
                      setShowProfile(false);
                      Alert.alert("Block User", `Block ${partnerName}?`, [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Block", style: "destructive",
                          onPress: async () => {
                            try {
                              await apiClient.post(API_ROUTES.user.blockUser, { userId: partner._id });
                              Alert.alert("Done", "User blocked.");
                              onGoBack();
                            } catch (e: any) {
                              Alert.alert("Error", e?.response?.data?.error ?? "Failed.");
                            }
                          },
                        },
                      ]);
                    }}
                  >
                    <Ionicons name="ban-outline" size={22} color={themeColors.error} />
                    <Text style={[styles.profileActionText, { color: themeColors.error }]}>Block</Text>
                  </Pressable>
                  <Pressable
                    style={styles.profileActionBtn}
                    onPress={() => { setShowProfile(false); handleProfileAction(); }}
                  >
                    <Ionicons name="flag-outline" size={22} color={themeColors.textMuted} />
                    <Text style={styles.profileActionText}>Report</Text>
                  </Pressable>
                  <Pressable
                    style={styles.profileActionBtn}
                    onPress={() => {
                      setShowProfile(false);
                      setDisappearingSheetOpen(true);
                    }}
                  >
                    <Ionicons name="timer-outline" size={22} color={themeColors.brandNavy} />
                    <Text style={styles.profileActionText}>
                      {disappearingMinutes > 0
                        ? `Disappearing · ${
                            disappearingMinutes >= 60 * 24
                              ? `${Math.round(disappearingMinutes / (60 * 24))}d`
                              : disappearingMinutes >= 60
                              ? `${Math.round(disappearingMinutes / 60)}h`
                              : `${disappearingMinutes}m`
                          }`
                        : "Disappearing messages"}
                    </Text>
                  </Pressable>
                </View>
              )}

              {profileTab === "media" && (
                <View style={styles.mediaSection}>
                  {sharedMedia.length === 0 ? (
                    <Text style={styles.profileEmptyText}>No photos or videos shared yet</Text>
                  ) : (
                    <View style={styles.mediaGrid}>
                      {sharedMedia.map((item) => (
                        <Pressable
                          key={item.id}
                          onPress={() => {
                            const index = chatMediaItems.findIndex((m) => m.id === item.id);
                            setShowProfile(false);
                            if (index >= 0) setMediaViewer({ index });
                          }}
                        >
                          {item.type === "video" ? (
                            <ChatVideoThumbnail
                              uri={item.uri}
                              style={styles.mediaGridItem}
                              onPress={() => {
                                const index = chatMediaItems.findIndex((m) => m.id === item.id);
                                setShowProfile(false);
                                if (index >= 0) setMediaViewer({ index });
                              }}
                            />
                          ) : (
                            <ImageWithSkeleton
                              uri={item.uri}
                              width={100}
                              height={100}
                              borderRadius={radii.sm}
                              style={styles.mediaGridItem}
                            />
                          )}
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {profileTab === "search" && (
                <View style={styles.searchSection}>
                  <View style={styles.profileSearchBar}>
                    <Ionicons name="search-outline" size={18} color={themeColors.textMuted} />
                    <TextInput
                      style={styles.profileSearchInput}
                      placeholder="Search messages..."
                      placeholderTextColor={themeColors.textMuted}
                      value={profileSearch}
                      onChangeText={setProfileSearch}
                    />
                  </View>
                  {profileSearch.trim() ? (
                    searchHits.length === 0 ? (
                      <Text style={styles.profileEmptyText}>No messages found</Text>
                    ) : (
                      searchSections.map((section) => (
                        <View key={section.title}>
                          <Text style={styles.searchDayHeader}>{section.title}</Text>
                          {section.data.map((m, hitIndex) => {
                            const text = getSearchableText(m);
                            const parts = highlightQueryParts(text, profileSearch);
                            return (
                              <Pressable
                                key={`${m._id}-${hitIndex}`}
                                style={styles.searchHit}
                                onPress={() => jumpToMessage(m._id)}
                              >
                                <Text style={styles.searchHitTime}>
                                  {formatChatDayLabel(m.createdAt)} · {formatTime(m.createdAt)}
                                </Text>
                                <Text style={styles.searchHitText}>
                                  {parts.map((p, i) => (
                                    <Text
                                      key={`${m._id}-${i}`}
                                      style={p.highlight ? styles.searchHitHighlight : undefined}
                                    >
                                      {p.text}
                                    </Text>
                                  ))}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      ))
                    )
                  ) : (
                    <Text style={styles.profileEmptyText}>Type to search this conversation</Text>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {isGroup ? (
        <GroupMembersSheet
          visible={showGroupSheet}
          conversationId={conversationId}
          groupName={partnerName}
          currentUserId={currentUserId}
          onClose={() => setShowGroupSheet(false)}
          onLeftGroup={onGoBack}
        />
      ) : null}

      <MessageActionsSheet
        visible={!!actionsTarget}
        onClose={() => setActionsTarget(null)}
        currentReaction={
          actionsTarget?.reactions?.find(
            (r) => String(r.user_id) === String(currentUserId)
          )?.emoji ?? null
        }
        onReact={(emoji) => {
          const target = actionsTarget;
          if (!target) return;
          void reactToMessage(target._id, emoji).then(() =>
            queryClient.invalidateQueries({
              queryKey: queryKeys.chats.messages(conversationId),
            })
          );
          setActionsTarget(null);
        }}
        actions={buildMessageActions({
          item: actionsTarget,
          isMine:
            !!actionsTarget &&
            resolveSenderId(actionsTarget.senderId) === currentUserId,
          conversationId,
          chatE2E,
          queryClient,
          setReplyTo,
          setEditDraft,
          setEditTarget,
          setForwardTarget,
        })}
      />

      <ForwardPickerSheet
        visible={!!forwardTarget}
        onClose={() => setForwardTarget(null)}
        messageId={forwardTarget?._id ?? ""}
        currentUserId={currentUserId}
        excludeConversationId={conversationId}
        onForwarded={() => setForwardTarget(null)}
      />

      <DisappearingMessagesSheet
        visible={disappearingSheetOpen}
        conversationId={conversationId}
        currentMinutes={disappearingMinutes}
        onClose={() => setDisappearingSheetOpen(false)}
        onChanged={(m) => setDisappearingMinutes(m)}
      />

      {isTrainerView ? (
        <ScheduledMessageComposer
          visible={scheduleComposerOpen}
          conversationId={conversationId}
          onClose={() => setScheduleComposerOpen(false)}
        />
      ) : null}

      {isTrainerView ? (
        <ScheduledMessagesSheet
          visible={scheduledListOpen}
          currentUserId={currentUserId}
          onClose={() => setScheduledListOpen(false)}
        />
      ) : null}
    </View>
  );
}

/**
 * Build the contextual action list for the long-press sheet. Lives at
 * module scope so it can be reused / tree-shaken and doesn't bloat the
 * already-massive component.
 */
function buildMessageActions(args: {
  item: Message | null;
  isMine: boolean;
  conversationId: string;
  chatE2E: { decryptForDisplay: (raw: string) => string };
  queryClient: any;
  setReplyTo: (m: Message) => void;
  setEditDraft: (v: string) => void;
  setEditTarget: (m: Message) => void;
  setForwardTarget: (m: Message) => void;
}): MessageAction[] {
  const {
    item,
    isMine,
    conversationId,
    chatE2E,
    queryClient,
    setReplyTo,
    setEditDraft,
    setEditTarget,
    setForwardTarget,
  } = args;
  if (!item) return [];
  const actions: MessageAction[] = [
    {
      id: "reply",
      label: "Reply",
      icon: "arrow-undo-outline",
      onPress: () => setReplyTo(item),
    },
    {
      id: "forward",
      label: "Forward",
      icon: "arrow-redo-outline",
      onPress: () => setForwardTarget(item),
    },
    {
      id: "pin",
      label: "Pin to top",
      icon: "pin-outline",
      onPress: () => {
        void pinChatMessage(item._id).then(() =>
          queryClient.invalidateQueries({
            queryKey: queryKeys.chats.pinned(conversationId),
          })
        );
      },
    },
  ];
  if (item.type === "text") {
    actions.push({
      id: "copy",
      label: "Copy",
      icon: "copy-outline",
      onPress: () => {
        try {
          const Clipboard = require("expo-clipboard");
          const plain = chatE2E.decryptForDisplay(item.content);
          void Clipboard.setStringAsync(plain);
        } catch {
          /* clipboard not available */
        }
      },
    });
  }
  if (isMine && item.type === "text") {
    const ageMs = Date.now() - new Date(item.createdAt).getTime();
    if (ageMs < 30 * 60 * 1000) {
      actions.push({
        id: "edit",
        label: "Edit",
        icon: "create-outline",
        onPress: () => {
          const plain = chatE2E.decryptForDisplay(item.content);
          if (Platform.OS === "ios") {
            Alert.prompt(
              "Edit message",
              undefined,
              (t?: string) => {
                if (!t?.trim()) return;
                void editChatMessage(item._id, t.trim()).then(() =>
                  queryClient.invalidateQueries({
                    queryKey: queryKeys.chats.messages(conversationId),
                  })
                );
              },
              "plain-text",
              plain
            );
          } else {
            setEditDraft(plain);
            setEditTarget(item);
          }
        },
      });
    }
  }
  if (isMine) {
    actions.push({
      id: "delete",
      label: "Delete",
      icon: "trash-outline",
      destructive: true,
      onPress: () => {
        void deleteChatMessage(item._id).then(() =>
          queryClient.invalidateQueries({
            queryKey: queryKeys.chats.messages(conversationId),
          })
        );
      },
    });
  }
  return actions;
}

const chatExtrasInlineStyles = StyleSheet.create({
  forwardedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  forwardedText: {
    fontSize: 11,
    fontStyle: "italic",
    fontWeight: "500",
  },
  reactionsRow: {
    flexDirection: "row",
    marginTop: -10,
    paddingHorizontal: 4,
    gap: 4,
  },
  reactionsRowMine: { alignSelf: "flex-end" },
  reactionsRowTheirs: { alignSelf: "flex-start" },
  reactionChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
    gap: 3,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  reactionChipEmoji: { fontSize: 13 },
  reactionChipCount: { fontSize: 11, color: "#374151", fontWeight: "600" },
  transcriptBox: {
    marginTop: 6,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  transcriptLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
    marginBottom: 2,
    letterSpacing: 0.4,
  },
  transcriptText: {
    fontSize: 13,
    color: "#0F172A",
    lineHeight: 18,
  },
  transcriptBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  transcriptBtnText: {
    fontSize: 11,
    fontWeight: "600",
  },
});

