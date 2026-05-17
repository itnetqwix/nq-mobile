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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { getS3ImageUrl } from "../../../lib/imageUtils";
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

type Props = {
  conversationId: string;
  partner: {
    _id: string;
    fullname?: string;
    profile_picture?: string;
  };
  onGoBack: () => void;
};

type Message = {
  _id: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: string;
  mediaUrl?: string | null;
  status?: "sent" | "delivered" | "read" | "sending";
  pending?: boolean;
  createdAt: string;
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

async function getPresignedUploadUrl(fileName: string, fileType: string) {
  const res = await apiClient.post(API_ROUTES.chat.mediaUploadUrl, { fileName, fileType });
  const body = (res as any)?.data ?? res;
  if (!body?.uploadUrl) throw new Error(body?.message ?? "Failed to get upload URL");
  return { uploadUrl: body.uploadUrl as string, mediaUrl: body.mediaUrl as string };
}

async function uploadToS3(uploadUrl: string, fileUri: string, contentType: string) {
  const response = await fetch(fileUri);
  const blob = await response.blob();
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!res.ok) throw new Error(`Upload failed with status ${res.status}`);
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Status checkmarks ──────────────────────────────────────────────────────

function MessageStatus({
  status,
  pending,
}: {
  status?: string;
  pending?: boolean;
}) {
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

function useChatRoomStyles() {
  return useThemedStyles((themeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: themeColors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: themeColors.surfaceElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: themeColors.border,
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
  headerInfo: { flex: 1 },
  headerName: { ...typography.titleSm, color: themeColors.text, fontSize: 16 },
  headerSub: { fontSize: 12, color: themeColors.textMuted, marginTop: 1 },
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
    justifyContent: "center",
  },
  messageRow: {
    width: "100%",
    flexDirection: "row",
    paddingVertical: 3,
  },
  messageRowMine: { justifyContent: "flex-end" },
  messageRowTheirs: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  bubbleMine: { backgroundColor: themeColors.brandNavy, borderBottomRightRadius: 4 },
  bubbleTheirs: {
    backgroundColor: themeColors.surfaceElevated,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: themeColors.border,
  },
  composer: {
    backgroundColor: themeColors.surfaceElevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: themeColors.border,
  },
  bubbleText: { ...typography.bodyMd, color: themeColors.text, lineHeight: 20 },
  bubbleTextMine: { color: "#fff" },
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
    gap: 4,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  textInput: {
    flex: 1, fontSize: 15, color: themeColors.text, backgroundColor: themeColors.surfaceMuted,
    borderRadius: 20, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 8,
    maxHeight: 100, textAlignVertical: "center",
  },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: themeColors.brandNavy, alignItems: "center", justifyContent: "center" },
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
  },
  emptyChatText: {
    ...typography.bodyMd,
    color: themeColors.textMuted,
    textAlign: "center",
  },
  recordDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#F44336" },
  recordTime: { fontSize: 16, fontWeight: "600", color: themeColors.text, fontVariant: ["tabular-nums"] },
  recordLabel: { fontSize: 13, color: themeColors.textMuted },
  recordCancel: { padding: 6 },
  recordSend: { width: 40, height: 40, borderRadius: 20, backgroundColor: themeColors.brandNavy, alignItems: "center", justifyContent: "center" },
  uploadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.3)", alignItems: "center", justifyContent: "center" },
  uploadingCard: { backgroundColor: "#fff", borderRadius: 16, padding: 32, alignItems: "center", gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },

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
  limitedText: { fontSize: 14, color: themeColors.textMuted, fontWeight: "500" },
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

export function ChatRoomScreen({ conversationId, partner, onGoBack }: Props) {
  const themeColors = useThemeColors();
  const styles = useChatRoomStyles();
  const insets = useSafeAreaInsets();
  const { user: authUser } = useAuth();
  const { socket } = useSocket();
  const { isOnline: isUserOnline } = useOnlinePresence();
  const queryClient = useQueryClient();
  const sectionListRef = useRef<SectionList<Message>>(null);
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
  const [partnerLastSeen, setPartnerLastSeen] = useState<string | null>(null);
  const currentUserId = String((authUser as any)?._id ?? (authUser as any)?.id ?? "");
  const chatE2E = useChatE2E(partner?._id);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [chatPolicy, setChatPolicy] = useState<{
    hasPaidSession: boolean;
    remainingToday: number;
    dailyLimit: number;
  } | null>(null);
  const [rateLimited, setRateLimited] = useState(false);

  useEffect(() => {
    if (!partner?._id) return;
    (async () => {
      try {
        const res = await apiClient.get(API_ROUTES.chat.policy(partner._id));
        const data = (res as any)?.data?.data ?? (res as any)?.data;
        if (data) setChatPolicy(data);
      } catch { /* non-critical */ }
    })();
  }, [partner?._id]);

  useEffect(() => {
    didInitialScrollRef.current = false;
  }, [conversationId]);

  useEffect(() => {
    if (partner?._id) setPartnerOnline(isUserOnline(partner._id));
  }, [partner?._id, isUserOnline]);

  // Fetch partner's online status / lastSeen
  useEffect(() => {
    if (!socket || !partner?._id) return;

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
  }, [socket, partner?._id]);

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

  const { data: serverMessages = [] } = useQuery<Message[]>({
    queryKey: ["chatMessages", conversationId],
    queryFn: async () => {
      const res = await apiClient.get(API_ROUTES.chat.messages(conversationId), {
        params: { page: 1, limit: 200 },
      });
      const body = (res as any)?.data ?? res;
      return body?.data ?? body?.result ?? [];
    },
    enabled: !!conversationId,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

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

  const displayMessages = useMemo(
    () =>
      allMessages.map((m) => ({
        ...m,
        content: chatE2E.decryptForDisplay(m.content),
        _encrypted: isEncryptedChatContent(m.content),
      })),
    [allMessages, chatE2E.decryptForDisplay]
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
    const animated = didInitialScrollRef.current;
    if (!didInitialScrollRef.current) didInitialScrollRef.current = true;
    const t = setTimeout(() => scrollToLatestMessage(animated), 60);
    return () => clearTimeout(t);
  }, [allMessages.length, scrollToLatestMessage]);

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
        ids.includes(m._id) && m.status === "sent" ? { ...m, status: "delivered" } : m
      );
    };
    const handleRead = (data: any) => {
      if (data?.conversationId !== conversationId) return;
      patchMessageStatus((m) =>
        m.senderId === currentUserId && m.status !== "read" ? { ...m, status: "read" } : m
      );
    };

    socket.on("CHAT_DELIVERED", handleDelivered);
    socket.on("CHAT_READ", handleRead);
    return () => {
      socket.off("CHAT_DELIVERED", handleDelivered);
      socket.off("CHAT_READ", handleRead);
    };
  }, [socket, conversationId, currentUserId, queryClient]);

  useEffect(() => {
    if (!socket || !conversationId) return;
    const handleReceive = (msg: any) => {
      if (msg?.conversationId === conversationId) {
        setLocalMessages((prev) => {
          if (prev.some((m) => m._id === msg._id)) return prev;
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
      }
    };
    socket.on("CHAT_MESSAGE", handleReceive);
    socket.emit("JOIN_CHAT", { conversationId });
    return () => {
      socket.off("CHAT_MESSAGE", handleReceive);
      socket.emit("LEAVE_CHAT", { conversationId });
    };
  }, [socket, conversationId, queryClient, currentUserId]);

  useEffect(() => {
    setLocalMessages((prev) => {
      const serverIds = new Set(serverMessages.map((m: Message) => m._id));
      const remaining = prev.filter((m) => !serverIds.has(m._id));
      return remaining.length === prev.length ? prev : remaining;
    });
  }, [serverMessages]);

  // ─── Send text ──────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    const plain = text.trim();
    if (!plain || !partner?._id || isSendingMessage) return;
    const content = chatE2E.canEncrypt ? chatE2E.encryptForSend(plain) : plain;
    setText("");
    setShowEmoji(false);
    setIsSendingMessage(true);
    if (socket) socket.emit("CHAT_STOP_TYPING", { conversationId, userId: currentUserId });
    const tempId = `temp_${Date.now()}`;
    const tempMsg: Message = {
      _id: tempId, senderId: currentUserId, receiverId: partner._id,
      content, type: "text", status: "sending", pending: true, createdAt: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, tempMsg]);
    try {
      const res = await apiClient.post(API_ROUTES.chat.send, {
        receiverId: partner._id, content, type: "text", conversationId,
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
      setLocalMessages((prev) => prev.filter((m) => m._id !== tempId));
      const status = e?.response?.status;
      if (status === 429) {
        setRateLimited(true);
        const msg = e?.response?.data?.data?.error ?? e?.response?.data?.error ?? "Message limit reached.";
        setChatPolicy((p) => p ? { ...p, remainingToday: 0 } : p);
        Alert.alert("Limit Reached", msg);
      }
    } finally {
      setIsSendingMessage(false);
    }
  }, [text, partner, currentUserId, socket, conversationId, queryClient, chatPolicy, isSendingMessage, chatE2E]);

  // ─── Send media ─────────────────────────────────────────────────────────────

  const sendMediaMessage = useCallback(
    async (fileUri: string, fileName: string, mimeType: string, type: "image" | "video" | "voice") => {
      if (!partner?._id) return;
      setUploading(true);
      const tempId = `temp_${Date.now()}`;
      const label = type === "image" ? "📷 Photo" : type === "video" ? "🎬 Video" : "🎤 Voice note";
      setLocalMessages((prev) => [...prev, {
        _id: tempId, senderId: currentUserId, receiverId: partner._id,
        content: label, type, mediaUrl: fileUri, status: "sending", pending: true,
        createdAt: new Date().toISOString(),
      }]);
      try {
        const { uploadUrl, mediaUrl } = await getPresignedUploadUrl(fileName, mimeType);
        await uploadToS3(uploadUrl, fileUri, mimeType);
        const res = await apiClient.post(API_ROUTES.chat.send, {
          receiverId: partner._id, content: label, type, mediaUrl, conversationId,
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
      } catch (e: any) {
        setLocalMessages((prev) => prev.filter((m) => m._id !== tempId));
        Alert.alert("Upload failed", e?.response?.data?.message ?? e?.message ?? "Could not send media.");
      } finally {
        setUploading(false);
      }
    },
    [partner, currentUserId, socket, conversationId, queryClient]
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
      setRecording(rec);
      setRecordSecs(0);
      recordTimerRef.current = setInterval(() => setRecordSecs((s) => s + 1), 1000);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not start recording.");
    }
  }, []);

  const cancelRecording = useCallback(async () => {
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
      await sendMediaMessage(uri, `voice_${Date.now()}.m4a`, "audio/mp4", "voice");
    } catch (e: any) {
      setRecording(null);
      setRecordSecs(0);
      Alert.alert("Error", e?.message ?? "Could not send voice note.");
    }
  }, [recording, sendMediaMessage]);

  const insertEmoji = useCallback((emoji: string) => setText((prev) => prev + emoji), []);

  // ─── Profile actions ──────────────────────────────────────────────────────

  const handleProfileAction = useCallback(() => {
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

  // ─── Render message ─────────────────────────────────────────────────────────

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => {
      const isMine = item.senderId === currentUserId;
      const mediaUri = resolveChatMediaUri(item.mediaUrl);
      const mediaKind = inferChatMediaKind(item.type, item.mediaUrl);
      const isHighlighted = item._id === highlightedMessageId;
      const showTextFallback =
        !mediaUri ||
        (mediaKind === null && item.type !== "voice");

      return (
        <View style={[styles.messageRow, isMine ? styles.messageRowMine : styles.messageRowTheirs]}>
          <View
            style={[
              styles.bubble,
              isMine ? styles.bubbleMine : styles.bubbleTheirs,
              isHighlighted && styles.bubbleHighlight,
            ]}
          >
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
          <View style={styles.bubbleFooter}>
            <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>
              {formatTime(item.createdAt)}
            </Text>
            {isMine && (
              <MessageStatus
                status={item.status}
                pending={item.pending || item.status === "sending"}
              />
            )}
          </View>
          </View>
        </View>
      );
    },
    [currentUserId, highlightedMessageId, openMediaViewer]
  );

  const partnerName = partner?.fullname ?? "Chat";
  const partnerAvatar = getS3ImageUrl(partner?.profile_picture);
  const showPolicyBanner = !!(chatPolicy && !chatPolicy.hasPaidSession);
  const composerBottomInset = Math.max(insets.bottom, 8);
  const keyboardVerticalOffset =
    insets.top + 56 + (showPolicyBanner ? 48 : 0);

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

  const headerSubtitle = partnerTyping
    ? "typing..."
    : chatE2E.isE2EActive
      ? "🔒 End-to-end encrypted"
      : partnerOnline
        ? "online"
        : partnerLastSeen
          ? `last seen ${formatLastSeen(partnerLastSeen)}`
          : "";

  const openPartnerProfile = useCallback(() => {
    setProfileTab("info");
    setProfileSearch("");
    setShowProfile(true);
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: themeColors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            backgroundColor: themeColors.surfaceElevated,
            borderBottomColor: themeColors.border,
          },
        ]}
      >
        <Pressable onPress={onGoBack} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={themeColors.text} />
        </Pressable>
        <Pressable
          onPress={openPartnerProfile}
          style={styles.headerProfileTap}
          accessibilityRole="button"
          accessibilityLabel={`${partnerName} profile`}
        >
          <View>
            {partnerAvatar ? (
              <Image source={{ uri: partnerAvatar }} style={styles.headerAvatar} />
            ) : (
              <View style={[styles.headerAvatar, styles.headerAvatarFb]}>
                <Text style={styles.headerAvatarInitial}>{partnerName[0]?.toUpperCase()}</Text>
              </View>
            )}
            {partnerOnline && <View style={styles.onlineDot} />}
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerName} numberOfLines={1}>{partnerName}</Text>
            {!!headerSubtitle && (
              <Text style={[styles.headerSub, partnerTyping && styles.headerSubTyping]} numberOfLines={1}>
                {headerSubtitle}
              </Text>
            )}
          </View>
        </Pressable>
        <Pressable onPress={handleProfileAction} hitSlop={10} style={styles.headerMore}>
          <Ionicons name="ellipsis-vertical" size={20} color={themeColors.textMuted} />
        </Pressable>
      </View>

      {/* Chat policy banner */}
      {showPolicyBanner && (
        <View style={styles.policyBanner}>
          <Ionicons name="information-circle-outline" size={16} color="#f59e0b" />
          <Text style={styles.policyText}>
            {rateLimited || chatPolicy.remainingToday <= 0
              ? "Daily message limit reached. Book a lesson to unlock unlimited messaging!"
              : `${chatPolicy.remainingToday} message${chatPolicy.remainingToday === 1 ? "" : "s"} remaining today. Book a lesson to chat freely.`}
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? keyboardVerticalOffset : 0}
      >
        <SectionList
          ref={sectionListRef}
          sections={messageSections}
          keyExtractor={(item) => item._id}
          renderItem={renderMessage}
          renderSectionHeader={({ section: { title } }) => (
            <ChatDaySeparator label={title} />
          )}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={[
            styles.messageList,
            allMessages.length === 0 && styles.messageListEmpty,
          ]}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatText}>
                Say hello — your messages are private and secure.
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

        <View style={styles.composer}>
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
              <Pressable onPress={cancelRecording} hitSlop={10} style={styles.recordCancel}>
                <Ionicons name="trash-outline" size={22} color={themeColors.danger} />
              </Pressable>
              <Pressable onPress={finishRecording} hitSlop={10} style={styles.recordSend}>
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
                  <Pressable onPress={() => setShowAttach(true)} hitSlop={8} style={styles.iconBtn}>
                    <Ionicons name="add-circle-outline" size={26} color={themeColors.brandNavy} />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      if (showEmoji) {
                        setShowEmoji(false);
                      } else {
                        Keyboard.dismiss();
                        setShowEmoji(true);
                      }
                    }}
                    hitSlop={8}
                    style={styles.iconBtn}
                  >
                    <Ionicons
                      name={showEmoji ? "happy" : "happy-outline"}
                      size={24}
                      color={showEmoji ? themeColors.brandNavy : themeColors.textMuted}
                    />
                  </Pressable>
                  <TextInput
                    style={styles.textInput}
                    value={text}
                    onChangeText={handleTextChange}
                    placeholder="Message..."
                    placeholderTextColor={themeColors.textMuted}
                    multiline
                    maxLength={2000}
                    onFocus={() => setShowEmoji(false)}
                  />
                  {text.trim() ? (
                    <Pressable style={styles.sendBtn} onPress={sendMessage} disabled={isSendingMessage}>
                      {isSendingMessage ? (
                        <ActivityIndicator size={16} color="#fff" />
                      ) : (
                        <Ionicons name="send" size={18} color="#fff" />
                      )}
                    </Pressable>
                  ) : (
                    <Pressable style={styles.iconBtn} onPress={startRecording}>
                      <Ionicons name="mic-outline" size={26} color={themeColors.brandNavy} />
                    </Pressable>
                  )}
                </>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

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
          <View style={[styles.profileCard, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
            <Pressable onPress={() => setShowProfile(false)} style={styles.profileClose}>
              <Ionicons name="close" size={28} color={themeColors.text} />
            </Pressable>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.profileCenter}>
                {partnerAvatar ? (
                  <Image source={{ uri: partnerAvatar }} style={styles.profileAvatar} />
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
                            <Image source={{ uri: item.uri }} style={styles.mediaGridItem} resizeMode="cover" />
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
                          {section.data.map((m) => {
                            const text = getSearchableText(m);
                            const parts = highlightQueryParts(text, profileSearch);
                            return (
                              <Pressable
                                key={m._id}
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
    </View>
  );
}


