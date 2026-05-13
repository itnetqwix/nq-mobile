import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
  createdAt: string;
};

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function ChatRoomScreen({ conversationId, partner, onGoBack }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const flatListRef = useRef<FlatList>(null);
  const [text, setText] = useState("");
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const currentUserId = String((user as any)?._id ?? (user as any)?.id ?? "");

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

  const allMessages = [...serverMessages, ...localMessages];

  useEffect(() => {
    if (!socket || !conversationId) return;
    const handleReceive = (msg: any) => {
      if (msg?.conversationId === conversationId) {
        setLocalMessages((prev) => {
          if (prev.some((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
        queryClient.invalidateQueries({
          queryKey: ["chatMessages", conversationId],
        });
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
    setLocalMessages([]);
  }, [serverMessages]);

  const sendMessage = useCallback(async () => {
    const content = text.trim();
    if (!content || !partner?._id) return;
    setText("");
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
      });
      const data = (res as any)?.data?.data ?? (res as any)?.data;
      if (data?.message) {
        setLocalMessages((prev) =>
          prev.map((m) => (m._id === tempId ? { ...data.message, _id: data.message._id } : m))
        );
      }
      if (socket) {
        socket.emit("CHAT_MESSAGE", {
          ...data?.message,
          conversationId,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch {
      setLocalMessages((prev) => prev.filter((m) => m._id !== tempId));
    }
  }, [text, partner, currentUserId, socket, conversationId, queryClient]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = item.senderId === currentUserId;
    return (
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>
          {item.content}
        </Text>
        <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>
          {formatTime(item.createdAt)}
        </Text>
      </View>
    );
  };

  const partnerName = partner?.fullname ?? "Chat";
  const partnerAvatar = getS3ImageUrl(partner?.profile_picture);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={onGoBack} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        {partnerAvatar ? (
          <Image
            source={{ uri: partnerAvatar }}
            style={styles.headerAvatar}
          />
        ) : (
          <View style={[styles.headerAvatar, styles.headerAvatarFb]}>
            <Text style={styles.headerAvatarInitial}>
              {partnerName[0]?.toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.headerName} numberOfLines={1}>
          {partnerName}
        </Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={allMessages}
        keyExtractor={(item) => item._id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: false })
        }
      />

      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={styles.textInput}
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={2000}
        />
        <Pressable
          style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!text.trim()}
        >
          <Ionicons name="send" size={20} color={colors.brandTextOn} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: space.md,
    paddingBottom: 12,
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerAvatarFb: {
    backgroundColor: colors.brandNavy,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarInitial: {
    color: colors.brandTextOn,
    fontWeight: "700",
    fontSize: 15,
  },
  headerName: {
    ...typography.titleSm,
    color: colors.text,
    flex: 1,
  },
  messageList: {
    padding: space.md,
    paddingBottom: space.lg,
    gap: 6,
  },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.lg,
    marginBottom: 2,
  },
  bubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: colors.brandNavy,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceElevated,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: {
    ...typography.bodyMd,
    color: colors.text,
  },
  bubbleTextMine: {
    color: colors.brandTextOn,
  },
  bubbleTime: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
    alignSelf: "flex-end",
    fontSize: 10,
  },
  bubbleTimeMine: {
    color: "rgba(255,255,255,0.7)",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: space.md,
    paddingTop: 8,
    backgroundColor: colors.surfaceElevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  textInput: {
    flex: 1,
    ...typography.bodyMd,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.brandNavy,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.45 },
});
