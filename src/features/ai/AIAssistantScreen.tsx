import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useTranslation } from "react-i18next";
import { useThemeColors, space, radii, typography } from "../../theme";
import { apiClient } from "../../api/client";
import { API_ROUTES } from "../../config/apiRoutes";
import { useAuth } from "../auth/context/AuthContext";
import {
  appendAiMessage,
  clearAiHistory,
  loadAiHistory,
  setAiHistory,
  type StoredAiMessage,
} from "./aiHistoryStore";
import { useVoiceInput } from "./useVoiceInput";
import { haptics } from "../../lib/haptics";
import {
  describeAiAction,
  parseAiActions,
  runAiAction,
  type AiAction,
} from "./aiActions";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  /** Optional structured actions parsed from the assistant response. */
  actions?: AiAction[];
};

/**
 * First-open suggestion chips. The set is deliberately mixed across
 * intents (find a trainer, manage bookings, account/help) so a user can
 * land somewhere actionable regardless of what brought them here.
 */
const FIRST_OPEN_SUGGESTIONS = [
  "ai.suggest.findYoga",
  "ai.suggest.rescheduleWednesday",
  "ai.suggest.pricing",
  "ai.suggest.refund",
  "ai.suggest.improveGame",
  "ai.suggest.instant",
];

const SUGGESTION_FALLBACKS: Record<string, string> = {
  "ai.suggest.findYoga": "Find a yoga trainer near me",
  "ai.suggest.rescheduleWednesday": "Reschedule my Wednesday class",
  "ai.suggest.pricing": "How does pricing work?",
  "ai.suggest.refund": "Can I get a refund?",
  "ai.suggest.improveGame": "How can I improve my game?",
  "ai.suggest.instant": "Tell me about instant lessons",
};

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi! I'm your NetQwix AI Assistant. I can help you find trainers, manage your sessions, or answer questions about the platform.",
  timestamp: new Date(),
};

function toStored(m: Message): StoredAiMessage | null {
  if (m.id === "welcome") return null;
  return { id: m.id, role: m.role, content: m.content, ts: m.timestamp.getTime() };
}

function fromStored(s: StoredAiMessage): Message {
  return { id: s.id, role: s.role, content: s.content, timestamp: new Date(s.ts) };
}

export default function AIAssistantScreen({ onClose }: { onClose?: () => void }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = useMemo(
    () => (user?._id as string) ?? (user?.id as string) ?? null,
    [user]
  );
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const flatListRef = useRef<FlatList<Message>>(null);

  /**
   * Rehydrate the per-user transcript on open. We keep the welcome
   * card pinned as the first row even when there's history, so the
   * surface always feels recognisable.
   */
  useEffect(() => {
    let mounted = true;
    void loadAiHistory(userId).then((rows) => {
      if (!mounted) return;
      if (rows.length === 0) {
        setMessages([WELCOME_MESSAGE]);
      } else {
        setMessages([WELCOME_MESSAGE, ...rows.map(fromStored)]);
      }
      setHydrating(false);
    });
    return () => {
      mounted = false;
    };
  }, [userId]);

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
      haptics.press();
      const userStored = toStored(userMsg);
      if (userStored) void appendAiMessage(userId, userStored);

      try {
        const history = newMessages
          .filter((m) => m.id !== "welcome")
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await apiClient.post(API_ROUTES.ai.chatAssistant, {
          messages: history.slice(-10),
        });

        const reply = res.data?.result?.reply || "Sorry, I couldn't process that.";
        const actions = parseAiActions(res.data?.result?.actions);

        const assistantMsg: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: reply,
          timestamp: new Date(),
          actions: actions.length > 0 ? actions : undefined,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        const stored = toStored(assistantMsg);
        if (stored) void appendAiMessage(userId, stored);
      } catch {
        const errMsg: Message = {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: t("ai.connectError", {
            defaultValue:
              "I'm having trouble connecting right now. Please try again in a moment.",
          }),
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
        const stored = toStored(errMsg);
        if (stored) void appendAiMessage(userId, stored);
        haptics.error();
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, t, userId]
  );

  const onClearHistory = useCallback(() => {
    Alert.alert(
      t("ai.clearTitle", { defaultValue: "Clear conversation?" }),
      t("ai.clearBody", {
        defaultValue: "Removes the saved history on this device.",
      }),
      [
        { text: t("common.cancel", { defaultValue: "Cancel" }), style: "cancel" },
        {
          text: t("ai.clearAction", { defaultValue: "Clear" }),
          style: "destructive",
          onPress: async () => {
            haptics.warning();
            await clearAiHistory(userId);
            setMessages([WELCOME_MESSAGE]);
          },
        },
      ]
    );
  }, [t, userId]);

  const voice = useVoiceInput({
    onResult: (result) => {
      if (result.text) {
        /** Append (don't replace) so a user mid-typing keeps what they had. */
        setInputText((cur) => (cur ? `${cur} ${result.text}` : result.text!));
      } else if (result.error === "permission") {
        Alert.alert(
          t("ai.voice.permissionTitle", { defaultValue: "Microphone access needed" }),
          t("ai.voice.permissionBody", {
            defaultValue: "Allow microphone access in Settings to use voice input.",
          })
        );
      } else if (result.error === "transcribe") {
        Alert.alert(
          t("ai.voice.transcribeTitle", { defaultValue: "Couldn't transcribe" }),
          result.message ??
            t("ai.voice.transcribeBody", {
              defaultValue:
                "Voice transcription isn't available right now. Please type your message instead.",
            })
        );
      }
    },
  });

  const onVoicePress = useCallback(() => {
    if (voice.state === "idle") void voice.start();
    else if (voice.state === "recording") void voice.stop();
  }, [voice]);

  /** Persist the current transcript whenever it drifts from storage —
   *  appendAiMessage already covers the happy path, but a clear / replay
   *  flow needs a full snapshot. */
  useEffect(() => {
    if (hydrating) return;
    const rows = messages.map(toStored).filter((m): m is StoredAiMessage => !!m);
    void setAiHistory(userId, rows);
  }, [hydrating, messages, userId]);

  const renderActions = useCallback(
    (actions?: AiAction[]) => {
      if (!actions || actions.length === 0) return null;
      return (
        <View style={styles.actionRow}>
          {actions.map((action, idx) => (
            <Pressable
              key={`${action.type}-${idx}`}
              onPress={() => {
                haptics.tap();
                runAiAction(action);
              }}
              style={[
                styles.actionChip,
                { backgroundColor: colors.brand, borderColor: colors.brand },
              ]}
              accessibilityRole="button"
              accessibilityLabel={describeAiAction(action)}
            >
              <Ionicons name="arrow-forward" size={14} color="#fff" />
              <Text style={[typography.bodySm, { color: "#fff", fontWeight: "600" }]}>
                {describeAiAction(action)}
              </Text>
            </Pressable>
          ))}
        </View>
      );
    },
    [colors.brand]
  );

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => {
      const isUser = item.role === "user";
      return (
        <View>
          <View
            style={[
              styles.messageBubble,
              isUser
                ? [styles.userBubble, { backgroundColor: colors.brand }]
                : [
                    styles.assistantBubble,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ],
            ]}
          >
            {!isUser && (
              <View style={styles.aiIconRow}>
                <View style={[styles.aiIcon, { backgroundColor: colors.brandAccentSubtle }]}>
                  <Ionicons name="sparkles" size={14} color={colors.brandAccent} />
                </View>
                <Text style={[typography.label, { color: colors.brandAccent, marginLeft: 6 }]}>
                  {t("ai.label", { defaultValue: "AI Assistant" })}
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
          {!isUser ? renderActions(item.actions) : null}
        </View>
      );
    },
    [colors, renderActions, t]
  );

  const renderSuggestions = () => {
    /**
     * Suggestion chips only render on the very first open (no
     * persisted user/assistant pairs). Once the user starts a
     * conversation they vanish to free up vertical space.
     */
    if (messages.length > 1) return null;
    return (
      <View style={styles.suggestionsContainer}>
        <Text style={[typography.label, { color: colors.textMuted, marginBottom: 8 }]}>
          {t("ai.tryAsking", { defaultValue: "Try asking" })}
        </Text>
        <View style={styles.suggestionsWrap}>
          {FIRST_OPEN_SUGGESTIONS.map((key) => {
            const text = t(key, { defaultValue: SUGGESTION_FALLBACKS[key] ?? key });
            return (
              <Pressable
                key={key}
                onPress={() => {
                  haptics.tap();
                  void sendMessage(text);
                }}
                accessibilityRole="button"
                accessibilityLabel={text}
                style={[
                  styles.suggestionChip,
                  { backgroundColor: colors.brandAccentSubtle, borderColor: colors.brandAccent },
                ]}
              >
                <Text style={[typography.bodySm, { color: colors.brandAccent }]}>{text}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  const voiceIcon = voice.state === "recording" ? "stop" : voice.state === "processing" ? "hourglass" : "mic";
  const voiceTint =
    voice.state === "recording" ? colors.danger : voice.state === "processing" ? colors.textMuted : colors.brandAccent;
  const voiceA11y =
    voice.state === "recording"
      ? t("ai.voice.stop", { defaultValue: "Stop recording and transcribe" })
      : voice.state === "processing"
      ? t("ai.voice.processing", { defaultValue: "Transcribing…" })
      : t("ai.voice.start", { defaultValue: "Start voice input" });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.brand,
            paddingTop: insets.top + 8,
          },
        ]}
      >
        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={t("common.close", { defaultValue: "Close" })}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="sparkles" size={20} color="#fff" />
          </View>
          <View>
            <Text style={[typography.titleSm, { color: "#fff" }]}>
              {t("ai.title", { defaultValue: "AI Assistant" })}
            </Text>
            <Text style={[typography.caption, { color: "rgba(255,255,255,0.7)" }]}>
              {t("ai.subtitle", { defaultValue: "Powered by NetQwix AI" })}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={onClearHistory}
          hitSlop={12}
          style={styles.headerRightBtn}
          accessibilityRole="button"
          accessibilityLabel={t("ai.clearA11y", { defaultValue: "Clear conversation" })}
        >
          <Ionicons name="trash-outline" size={18} color="#fff" />
        </Pressable>
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
                    {t("ai.thinking", { defaultValue: "Thinking…" })}
                  </Text>
                </View>
              )}
              {renderSuggestions()}
            </>
          }
        />

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
            placeholder={t("ai.placeholder", { defaultValue: "Ask me anything…" })}
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
            onPress={onVoicePress}
            disabled={loading || voice.state === "processing"}
            style={[
              styles.voiceButton,
              {
                backgroundColor:
                  voice.state === "recording" ? colors.dangerSubtle : colors.surfaceMuted,
                borderColor: voiceTint,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={voiceA11y}
          >
            {voice.state === "processing" ? (
              <ActivityIndicator size="small" color={voiceTint} />
            ) : (
              <Ionicons name={voiceIcon} size={18} color={voiceTint} />
            )}
          </Pressable>
          <Pressable
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() || loading}
            style={[
              styles.sendButton,
              {
                backgroundColor: inputText.trim() && !loading ? colors.brand : colors.neutral300,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("ai.send", { defaultValue: "Send message" })}
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
  headerRightBtn: { width: 40, alignItems: "flex-end" },
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
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: -space.xs,
    marginBottom: space.sm,
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
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
    gap: 8,
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
  voiceButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
