import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
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
import { colors, radii, space, typography } from "../../../theme";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { useAuth } from "../../auth/context/AuthContext";
import { useSocket } from "../../socket/SocketContext";

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
  createdAt: string;
};

const EMOJI_LIST = [
  "😀","😂","🥰","😍","😎","🤩","😢","😡","👍","👎",
  "❤️","🔥","🎉","💪","🙏","👏","🤝","💯","✅","⭐",
  "😊","🤗","😇","🤔","😏","🥳","😱","💀","👀","🙌",
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

async function getPresignedUploadUrl(fileName: string, fileType: string) {
  const res = await apiClient.post(API_ROUTES.chat.mediaUploadUrl, { fileName, fileType });
  const body = (res as any)?.data ?? res;
  return { uploadUrl: body.uploadUrl as string, mediaUrl: body.mediaUrl as string };
}

async function uploadToS3(uploadUrl: string, fileUri: string, contentType: string) {
  await FileSystem.uploadAsync(uploadUrl, fileUri, {
    httpMethod: "PUT",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { "Content-Type": contentType },
  });
}

// ─── Voice note player ──────────────────────────────────────────────────────

function VoicePlayer({ uri, isMine }: { uri: string; isMine: boolean }) {
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
    if (playing && sound) {
      await sound.pauseAsync();
      setPlaying(false);
      return;
    }
    if (sound) {
      await sound.playAsync();
      setPlaying(true);
      return;
    }
    try {
      const { sound: s } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          setPos(status.positionMillis);
          setDur(status.durationMillis ?? 0);
          if (status.didJustFinish) {
            setPlaying(false);
            s.setPositionAsync(0);
          }
        }
      );
      setSound(s);
      setPlaying(true);
    } catch {
      Alert.alert("Error", "Could not play audio.");
    }
  }, [uri, sound, playing]);

  const progress = dur > 0 ? pos / dur : 0;
  const fg = isMine ? "rgba(255,255,255,0.9)" : colors.brandNavy;
  const barBg = isMine ? "rgba(255,255,255,0.3)" : colors.border;
  const barFill = isMine ? "#fff" : colors.brandNavy;
  const timeFg = isMine ? "rgba(255,255,255,0.7)" : colors.textMuted;

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
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const flatListRef = useRef<FlatList>(null);
  const [text, setText] = useState("");
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordSecs, setRecordSecs] = useState(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const currentUserId = String((user as any)?._id ?? (user as any)?.id ?? "");
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const { data: serverMessages = [] } = useQuery<Message[]>({
    queryKey: ["chatMessages", conversationId],
    queryFn: async () => {
      const res = await apiClient.get(API_ROUTES.chat.messages(conversationId));
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
    return merged;
  }, [serverMessages, localMessages]);

  useEffect(() => {
    if (!socket || !conversationId) return;
    const handleReceive = (msg: any) => {
      if (msg?.conversationId === conversationId) {
        setLocalMessages((prev) => {
          if (prev.some((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
        queryClient.invalidateQueries({ queryKey: ["chatMessages", conversationId] });
      }
    };
    socket.on("CHAT_MESSAGE", handleReceive);
    socket.emit("JOIN_CHAT", { conversationId });
    return () => {
      socket.off("CHAT_MESSAGE", handleReceive);
      socket.emit("LEAVE_CHAT", { conversationId });
    };
  }, [socket, conversationId, queryClient]);

  useEffect(() => {
    setLocalMessages((prev) => {
      const serverIds = new Set(serverMessages.map((m: Message) => m._id));
      const remaining = prev.filter((m) => !serverIds.has(m._id));
      return remaining.length === prev.length ? prev : remaining;
    });
  }, [serverMessages]);

  // ─── Send text message ──────────────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    const content = text.trim();
    if (!content || !partner?._id) return;
    setText("");
    setShowEmoji(false);
    const tempId = `temp_${Date.now()}`;
    const tempMsg: Message = {
      _id: tempId,
      senderId: currentUserId,
      receiverId: partner._id,
      content,
      type: "text",
      createdAt: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await apiClient.post(API_ROUTES.chat.send, {
        receiverId: partner._id,
        content,
        type: "text",
        conversationId,
      });
      const data = (res as any)?.data?.data ?? (res as any)?.data;
      if (data?.message) {
        setLocalMessages((prev) =>
          prev.map((m) => (m._id === tempId ? { ...data.message, _id: data.message._id } : m))
        );
      }
      if (socket) {
        socket.emit("CHAT_MESSAGE", { ...data?.message, conversationId });
      }
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch {
      setLocalMessages((prev) => prev.filter((m) => m._id !== tempId));
    }
  }, [text, partner, currentUserId, socket, conversationId, queryClient]);

  // ─── Send media message ─────────────────────────────────────────────────────

  const sendMediaMessage = useCallback(
    async (fileUri: string, fileName: string, mimeType: string, type: "image" | "video" | "voice") => {
      if (!partner?._id) return;
      setUploading(true);
      const tempId = `temp_${Date.now()}`;
      const label = type === "image" ? "📷 Photo" : type === "video" ? "🎬 Video" : "🎤 Voice note";
      const tempMsg: Message = {
        _id: tempId,
        senderId: currentUserId,
        receiverId: partner._id,
        content: label,
        type,
        mediaUrl: fileUri,
        createdAt: new Date().toISOString(),
      };
      setLocalMessages((prev) => [...prev, tempMsg]);

      try {
        const { uploadUrl, mediaUrl } = await getPresignedUploadUrl(fileName, mimeType);
        await uploadToS3(uploadUrl, fileUri, mimeType);
        const res = await apiClient.post(API_ROUTES.chat.send, {
          receiverId: partner._id,
          content: label,
          type,
          mediaUrl,
          conversationId,
        });
        const data = (res as any)?.data?.data ?? (res as any)?.data;
        if (data?.message) {
          setLocalMessages((prev) =>
            prev.map((m) => (m._id === tempId ? { ...data.message, _id: data.message._id } : m))
          );
        }
        if (socket) {
          socket.emit("CHAT_MESSAGE", { ...data?.message, conversationId });
        }
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      } catch (e: any) {
        setLocalMessages((prev) => prev.filter((m) => m._id !== tempId));
        Alert.alert("Upload failed", e?.message ?? "Could not send media.");
      } finally {
        setUploading(false);
      }
    },
    [partner, currentUserId, socket, conversationId, queryClient]
  );

  // ─── Pick image ─────────────────────────────────────────────────────────────

  const pickImage = useCallback(async () => {
    setShowAttach(false);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission", "Photo library access is required.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const ext = (asset.uri.split(".").pop() ?? "jpg").toLowerCase();
      const name = `photo_${Date.now()}.${ext}`;
      await sendMediaMessage(asset.uri, name, asset.mimeType ?? `image/${ext}`, "image");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not pick image.");
    }
  }, [sendMediaMessage]);

  // ─── Take photo ─────────────────────────────────────────────────────────────

  const takePhoto = useCallback(async () => {
    setShowAttach(false);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission", "Camera access is required.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const ext = (asset.uri.split(".").pop() ?? "jpg").toLowerCase();
      const name = `camera_${Date.now()}.${ext}`;
      await sendMediaMessage(asset.uri, name, asset.mimeType ?? `image/${ext}`, "image");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not take photo.");
    }
  }, [sendMediaMessage]);

  // ─── Pick video ─────────────────────────────────────────────────────────────

  const pickVideo = useCallback(async () => {
    setShowAttach(false);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission", "Photo library access is required.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        quality: 0.7,
        videoMaxDuration: 120,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const ext = (asset.uri.split(".").pop() ?? "mp4").toLowerCase();
      const name = `video_${Date.now()}.${ext}`;
      await sendMediaMessage(asset.uri, name, asset.mimeType ?? `video/${ext}`, "video");
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
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission", "Microphone access is required to send voice notes.");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
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
      const name = `voice_${Date.now()}.m4a`;
      await sendMediaMessage(uri, name, "audio/mp4", "voice");
    } catch (e: any) {
      setRecording(null);
      setRecordSecs(0);
      Alert.alert("Error", e?.message ?? "Could not send voice note.");
    }
  }, [recording, sendMediaMessage]);

  // ─── Emoji insert ──────────────────────────────────────────────────────────

  const insertEmoji = useCallback((emoji: string) => {
    setText((prev) => prev + emoji);
  }, []);

  // ─── Render message ─────────────────────────────────────────────────────────

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => {
      const isMine = item.senderId === currentUserId;
      const mediaUri = item.mediaUrl
        ? item.mediaUrl.startsWith("http") || item.mediaUrl.startsWith("file")
          ? item.mediaUrl
          : getS3ImageUrl(item.mediaUrl)
        : null;

      return (
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
          {item.type === "image" && mediaUri ? (
            <Pressable onPress={() => setPreviewUri(mediaUri)}>
              <Image source={{ uri: mediaUri }} style={styles.mediaThumbnail} resizeMode="cover" />
            </Pressable>
          ) : item.type === "video" && mediaUri ? (
            <Pressable onPress={() => setPreviewUri(mediaUri)} style={styles.videoContainer}>
              <View style={styles.videoPlaceholder}>
                <Ionicons name="videocam" size={28} color={isMine ? "#fff" : colors.brandNavy} />
              </View>
              <View style={styles.playOverlay}>
                <Ionicons name="play-circle" size={44} color="rgba(255,255,255,0.9)" />
              </View>
            </Pressable>
          ) : item.type === "voice" && mediaUri ? (
            <VoicePlayer uri={mediaUri} isMine={isMine} />
          ) : (
            <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.content}</Text>
          )}
          <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>
      );
    },
    [currentUserId]
  );

  const partnerName = partner?.fullname ?? "Chat";
  const partnerAvatar = getS3ImageUrl(partner?.profile_picture);
  const screenW = Dimensions.get("window").width;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header — compact, flush with status bar */}
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={onGoBack} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        {partnerAvatar ? (
          <Image source={{ uri: partnerAvatar }} style={styles.headerAvatar} />
        ) : (
          <View style={[styles.headerAvatar, styles.headerAvatarFb]}>
            <Text style={styles.headerAvatarInitial}>{partnerName[0]?.toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>{partnerName}</Text>
        </View>
      </View>

      {/* Messages list */}
      <FlatList
        ref={flatListRef}
        data={allMessages}
        keyExtractor={(item) => item._id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        style={styles.messageArea}
      />

      {/* Emoji picker tray */}
      {showEmoji && (
        <View style={styles.emojiTray}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiScroll}>
            {EMOJI_LIST.map((e) => (
              <Pressable key={e} onPress={() => insertEmoji(e)} style={styles.emojiBtn}>
                <Text style={styles.emojiText}>{e}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Recording bar */}
      {recording && (
        <View style={[styles.recordBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <Animated.View style={[styles.recordDot, { transform: [{ scale: pulseAnim }] }]} />
          <Text style={styles.recordTime}>{formatDuration(recordSecs * 1000)}</Text>
          <Text style={styles.recordLabel}>Recording...</Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={cancelRecording} hitSlop={10} style={styles.recordCancel}>
            <Ionicons name="trash-outline" size={22} color={colors.error} />
          </Pressable>
          <Pressable onPress={finishRecording} hitSlop={10} style={styles.recordSend}>
            <Ionicons name="send" size={20} color="#fff" />
          </Pressable>
        </View>
      )}

      {/* Input bar — compact */}
      {!recording && (
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 6) }]}>
          <Pressable onPress={() => setShowAttach(true)} hitSlop={8} style={styles.iconBtn}>
            <Ionicons name="add-circle-outline" size={26} color={colors.brandNavy} />
          </Pressable>
          <Pressable onPress={() => setShowEmoji((v) => !v)} hitSlop={8} style={styles.iconBtn}>
            <Ionicons name={showEmoji ? "happy" : "happy-outline"} size={24} color={showEmoji ? colors.brandNavy : colors.textMuted} />
          </Pressable>
          <TextInput
            style={styles.textInput}
            value={text}
            onChangeText={setText}
            placeholder="Message..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={2000}
            onFocus={() => setShowEmoji(false)}
          />
          {text.trim() ? (
            <Pressable style={styles.sendBtn} onPress={sendMessage}>
              <Ionicons name="send" size={18} color="#fff" />
            </Pressable>
          ) : (
            <Pressable style={styles.iconBtn} onPress={startRecording}>
              <Ionicons name="mic-outline" size={26} color={colors.brandNavy} />
            </Pressable>
          )}
        </View>
      )}

      {/* Upload indicator */}
      {uploading && (
        <View style={styles.uploadingOverlay}>
          <View style={styles.uploadingCard}>
            <ActivityIndicator color={colors.brandNavy} size="large" />
            <Text style={styles.uploadingText}>Sending…</Text>
          </View>
        </View>
      )}

      {/* Attachment bottom sheet */}
      <Modal visible={showAttach} transparent animationType="slide" onRequestClose={() => setShowAttach(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowAttach(false)}>
          <View />
        </Pressable>
        <View style={[styles.sheetCard, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
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

      {/* Image preview modal */}
      <Modal visible={!!previewUri} transparent animationType="fade" onRequestClose={() => setPreviewUri(null)}>
        <View style={styles.previewBackdrop}>
          <Pressable onPress={() => setPreviewUri(null)} style={[styles.previewClose, { top: insets.top + 8 }]}>
            <Ionicons name="close-circle" size={34} color="#fff" />
          </Pressable>
          {previewUri && (
            <Image source={{ uri: previewUri }} style={{ width: screenW, height: screenW * 1.2 }} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: { marginRight: -2 },
  headerAvatar: { width: 34, height: 34, borderRadius: 17 },
  headerAvatarFb: { backgroundColor: colors.brandNavy, alignItems: "center", justifyContent: "center" },
  headerAvatarInitial: { color: "#fff", fontWeight: "700", fontSize: 14 },
  headerInfo: { flex: 1 },
  headerName: { ...typography.titleSm, color: colors.text, fontSize: 16 },
  messageArea: { flex: 1 },
  messageList: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, gap: 4 },
  bubble: { maxWidth: "78%", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, marginBottom: 2 },
  bubbleMine: { alignSelf: "flex-end", backgroundColor: colors.brandNavy, borderBottomRightRadius: 4 },
  bubbleTheirs: { alignSelf: "flex-start", backgroundColor: colors.surfaceElevated, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  bubbleText: { ...typography.bodyMd, color: colors.text, lineHeight: 20 },
  bubbleTextMine: { color: "#fff" },
  bubbleTime: { ...typography.caption, color: colors.textMuted, marginTop: 3, alignSelf: "flex-end", fontSize: 10 },
  bubbleTimeMine: { color: "rgba(255,255,255,0.6)" },
  mediaThumbnail: { width: 200, height: 200, borderRadius: radii.md, marginBottom: 4 },
  videoContainer: { position: "relative", width: 200, height: 120, borderRadius: radii.md, overflow: "hidden" },
  videoPlaceholder: { flex: 1, backgroundColor: "rgba(0,0,0,0.1)", alignItems: "center", justifyContent: "center" },
  playOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  emojiTray: { backgroundColor: colors.surfaceElevated, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  emojiScroll: { paddingHorizontal: 8, paddingVertical: 8, gap: 2 },
  emojiBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  emojiText: { fontSize: 24 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    paddingHorizontal: 8,
    paddingTop: 6,
    backgroundColor: colors.surfaceElevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
    maxHeight: 100,
    textAlignVertical: "center",
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brandNavy,
    alignItems: "center",
    justifyContent: "center",
  },
  recordBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: colors.surfaceElevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  recordDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#F44336" },
  recordTime: { fontSize: 16, fontWeight: "600", color: colors.text, fontVariant: ["tabular-nums"] },
  recordLabel: { fontSize: 13, color: colors.textMuted },
  recordCancel: { padding: 6 },
  recordSend: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandNavy,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadingCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  uploadingText: { color: colors.text, ...typography.titleSm },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheetCard: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 24,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 16 },
  sheetTitle: { ...typography.titleSm, color: colors.text, marginBottom: 20, fontSize: 18 },
  sheetGrid: { flexDirection: "row", justifyContent: "space-around" },
  sheetOption: { alignItems: "center", gap: 8, width: 72 },
  sheetIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  sheetLabel: { fontSize: 13, color: colors.text, fontWeight: "500" },
  previewBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" },
  previewClose: { position: "absolute", right: 16, zIndex: 10 },
});
