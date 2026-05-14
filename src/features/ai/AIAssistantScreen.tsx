import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors, space, radii, typography } from "../../theme";
import { apiClient } from "../../api/client";
import { API_ROUTES } from "../../config/apiRoutes";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

const SUGGESTIONS = [
  "How do I book a lesson?",
  "What sports are available?",
  "How does pricing work?",
  "Can I get a refund?",
  "How to improve my game?",
  "Tell me about instant lessons",
];

export default function AIAssistantScreen({ onClose }: { onClose?: () => void }) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! I'm your NetQwix AI Assistant. I can help you find trainers, answer questions about the platform, or give you tips to improve your game. How can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setInputText("");
      setLoading(true);

      try {
        const history = newMessages
          .filter((m) => m.id !== "welcome")
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await apiClient.post(API_ROUTES.ai.chatAssistant, {
          messages: history.slice(-10),
        });

        const reply = res.data?.result?.reply || "Sorry, I couldn't process that.";

        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: reply,
            timestamp: new Date(),
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: "I'm having trouble connecting right now. Please try again in a moment.",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [messages, loading]
  );

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => {
      const isUser = item.role === "user";
      return (
        <View
          style={[
            styles.messageBubble,
            isUser
              ? [styles.userBubble, { backgroundColor: colors.brand }]
              : [styles.assistantBubble, { backgroundColor: colors.surface, borderColor: colors.border }],
          ]}
        >
          {!isUser && (
            <View style={styles.aiIconRow}>
              <View style={[styles.aiIcon, { backgroundColor: colors.brandAccentSubtle }]}>
                <Ionicons name="sparkles" size={14} color={colors.brandAccent} />
              </View>
              <Text style={[typography.label, { color: colors.brandAccent, marginLeft: 6 }]}>
                AI Assistant
              </Text>
            </View>
          )}
          <Text
            style={[
              typography.bodyMd,
              { color: isUser ? "#fff" : colors.text, marginTop: isUser ? 0 : 6 },
            ]}
          >
            {item.content}
          </Text>
          <Text
            style={[
              typography.caption,
              {
                color: isUser ? "rgba(255,255,255,0.6)" : colors.textMuted,
                alignSelf: isUser ? "flex-end" : "flex-start",
                marginTop: 4,
              },
            ]}
          >
            {item.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
      );
    },
    [colors]
  );

  const renderSuggestions = () => {
    if (messages.length > 1) return null;
    return (
      <View style={styles.suggestionsContainer}>
        <Text style={[typography.label, { color: colors.textMuted, marginBottom: 8 }]}>
          Quick questions
        </Text>
        <View style={styles.suggestionsWrap}>
          {SUGGESTIONS.map((s) => (
            <Pressable
              key={s}
              onPress={() => sendMessage(s)}
              style={[styles.suggestionChip, { backgroundColor: colors.brandAccentSubtle, borderColor: colors.brandAccent }]}
            >
              <Text style={[typography.bodySm, { color: colors.brandAccent }]}>{s}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.brand,
            paddingTop: insets.top + 8,
          },
        ]}
      >
        <Pressable onPress={onClose} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="sparkles" size={20} color="#fff" />
          </View>
          <View>
            <Text style={[typography.titleSm, { color: "#fff" }]}>AI Assistant</Text>
            <Text style={[typography.caption, { color: "rgba(255,255,255,0.7)" }]}>
              Powered by AI
            </Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListFooterComponent={
            <>
              {loading && (
                <View style={[styles.typingIndicator, { backgroundColor: colors.surface }]}>
                  <ActivityIndicator size="small" color={colors.brandAccent} />
                  <Text style={[typography.bodySm, { color: colors.textMuted, marginLeft: 8 }]}>
                    Thinking...
                  </Text>
                </View>
              )}
              {renderSuggestions()}
            </>
          }
        />

        {/* Input Bar */}
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 8),
            },
          ]}
        >
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: colors.input,
                borderColor: colors.inputBorder,
                color: colors.text,
              },
            ]}
            placeholder="Ask me anything..."
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            editable={!loading}
            onSubmitEditing={() => sendMessage(inputText)}
            returnKeyType="send"
            blurOnSubmit
          />
          <Pressable
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() || loading}
            style={[
              styles.sendButton,
              {
                backgroundColor: inputText.trim() && !loading ? colors.brand : colors.neutral300,
              },
            ]}
          >
            <Ionicons name="send" size={18} color={inputText.trim() && !loading ? "#fff" : colors.textMuted} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingBottom: 12,
  },
  backButton: { width: 40, alignItems: "flex-start" },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  messageList: { padding: space.md, paddingBottom: space.sm },
  messageBubble: {
    maxWidth: "82%",
    padding: 12,
    borderRadius: radii.lg,
    marginBottom: space.sm,
  },
  userBubble: {
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  aiIconRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  aiIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  typingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.md,
    marginBottom: space.sm,
  },
  suggestionsContainer: {
    marginTop: space.sm,
    paddingHorizontal: 4,
  },
  suggestionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: space.md,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.xl,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    maxHeight: 100,
    fontSize: 15,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
});
