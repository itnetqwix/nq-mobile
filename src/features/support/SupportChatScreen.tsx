/**
 * SupportChatScreen — minimal live-chat shim with the NetQwix support team.
 *
 * This is intentionally NOT a full re-implementation of `ChatRoomScreen`.
 * It reuses the shared `apiClient` + `Sheet`/`Card`/`Button` primitives
 * and gives the user a thread experience without needing a "support user
 * account" on the conversations list. Messages are persisted on the
 * backend via the existing `postWriteUs` endpoint with a special subject
 * prefix so support sees them grouped in their CRM, and locally so the
 * thread survives session restarts.
 *
 * When a real two-way live-chat backend (e.g. Intercom, Crisp, or our
 * own ConversationKind="support" extension) lands we swap the local
 * persistence for the websocket-backed transport and reuse the same UI.
 *
 * Why this approach now?
 *   - It removes the dead-end of "Contact us" being a fire-and-forget
 *     form. The user sees their messages, can add follow-ups, and the
 *     auto-reply seeds expectations.
 *   - It gets us the structural primitives (thread state, persistence,
 *     unread state) in place so the future websocket cutover is a few
 *     lines.
 */

import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/context/AuthContext";
import { postWriteUs } from "../home/api/homeApi";
import { radii, space, typography, useThemeColors } from "../../theme";
import { haptics } from "../../lib/haptics";
import { getApiErrorMessage } from "../../lib/http/getApiErrorMessage";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { HomeStackParamList } from "../../navigation/types";

const STORAGE_KEY = "nq.support-chat.transcript.v1";
const AUTO_REPLY_DELAY_MS = 850;

type Sender = "user" | "support" | "system";

type Message = {
  id: string;
  sender: Sender;
  text: string;
  createdAt: number;
};

function welcomeMessages(userName?: string | null): Message[] {
  const now = Date.now();
  return [
    {
      id: `welcome-${now}`,
      sender: "system",
      text:
        "Welcome to NetQwix support. The team is online during business hours and typically replies within minutes.",
      createdAt: now,
    },
    {
      id: `hello-${now + 1}`,
      sender: "support",
      text:
        userName && userName.length
          ? `Hi ${userName}, how can we help today? You can also use "Report a problem" to attach diagnostic info.`
          : "Hi! How can we help today? You can also use \"Report a problem\" to attach diagnostic info.",
      createdAt: now + 1,
    },
  ];
}

async function loadTranscript(): Promise<Message[]> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Message[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is Message =>
        !!m &&
        typeof m.id === "string" &&
        typeof m.text === "string" &&
        (m.sender === "user" || m.sender === "support" || m.sender === "system") &&
        typeof m.createdAt === "number"
    );
  } catch {
    return [];
  }
}

async function persistTranscript(messages: Message[]): Promise<void> {
  try {
    /**
     * Trim to last 200 messages so the SecureStore record doesn't grow
     * unbounded — chat history this old is almost never relevant.
     */
    const trimmed = messages.slice(-200);
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* non-critical persistence */
  }
}

export function SupportChatScreen() {
  const { t } = useTranslation();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList<Message>>(null);

  const userName = useMemo(
    () => (user?.fullname as string) ?? (user?.fullName as string) ?? null,
    [user]
  );

  useEffect(() => {
    let mounted = true;
    void loadTranscript().then((rows) => {
      if (!mounted) return;
      if (rows.length === 0) {
        setMessages(welcomeMessages(userName));
      } else {
        setMessages(rows);
      }
    });
    return () => {
      mounted = false;
    };
  }, [userName]);

  useEffect(() => {
    if (messages.length === 0) return;
    void persistTranscript(messages);
  }, [messages]);

  const send = useCallback(async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    haptics.press();
    const now = Date.now();
    const userMsg: Message = { id: `u-${now}`, sender: "user", text: body, createdAt: now };
    setMessages((prev) => [...prev, userMsg]);
    setText("");

    try {
      /**
       * Bridge to the existing write-us endpoint so support sees the
       * message in their inbox today. The "[live-chat]" subject prefix
       * is the convention agreed with the support team for grouping.
       */
      await postWriteUs({
        name: userName ?? "NetQwix user",
        email: (user?.email as string) ?? "",
        subject: `[live-chat] ${body.slice(0, 60)}`,
        description: body,
      });
      const replyAt = now + AUTO_REPLY_DELAY_MS;
      const auto: Message = {
        id: `s-${replyAt}`,
        sender: "support",
        text: t("support.autoReply", {
          defaultValue:
            "Thanks — we've got your message. A team-member will follow up soon. Need anything else?",
        }),
        createdAt: replyAt,
      };
      setTimeout(() => setMessages((prev) => [...prev, auto]), AUTO_REPLY_DELAY_MS);
    } catch (e) {
      const fail: Message = {
        id: `err-${Date.now()}`,
        sender: "system",
        text: t("support.sendFailed", {
          defaultValue: "Couldn't reach support · {{detail}}. Try again or open Report a problem.",
          detail: getApiErrorMessage(e),
        }),
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, fail]);
      haptics.error();
    } finally {
      setSending(false);
    }
  }, [sending, t, text, user?.email, userName]);

  const renderRow = useCallback(
    ({ item }: { item: Message }) => {
      const isUser = item.sender === "user";
      const isSystem = item.sender === "system";
      if (isSystem) {
        return (
          <View style={styles.systemRow}>
            <Text style={[typography.caption, { color: c.textMuted, textAlign: "center" }]}>
              {item.text}
            </Text>
          </View>
        );
      }
      return (
        <View
          style={[
            styles.bubble,
            {
              alignSelf: isUser ? "flex-end" : "flex-start",
              backgroundColor: isUser ? c.brandAccent : c.surfaceElevated,
              borderColor: isUser ? c.brandAccent : c.border,
              borderBottomRightRadius: isUser ? 4 : radii.lg,
              borderBottomLeftRadius: isUser ? radii.lg : 4,
            },
          ]}
        >
          {!isUser ? (
            <Text style={[typography.caption, { color: c.brandAccent, fontWeight: "700" }]}>
              {t("support.teamLabel", { defaultValue: "NetQwix support" })}
            </Text>
          ) : null}
          <Text
            style={[
              typography.bodyMd,
              { color: isUser ? "#fff" : c.text, marginTop: isUser ? 0 : 4 },
            ]}
          >
            {item.text}
          </Text>
          <Text
            style={[
              typography.caption,
              {
                color: isUser ? "rgba(255,255,255,0.7)" : c.textMuted,
                alignSelf: isUser ? "flex-end" : "flex-start",
                marginTop: 4,
              },
            ]}
          >
            {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
      );
    },
    [c, t]
  );

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderRow}
          contentContainerStyle={[
            styles.list,
            { paddingTop: space.md, paddingBottom: space.lg },
          ]}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        <View
          style={[
            styles.composer,
            {
              backgroundColor: c.surfaceElevated,
              borderTopColor: c.border,
              paddingBottom: Math.max(insets.bottom, space.sm),
            },
          ]}
        >
          <Pressable
            onPress={() =>
              navigation.navigate("ReportIssue", { prefillSubject: "Live chat follow-up" })
            }
            hitSlop={10}
            style={[styles.reportBtn, { backgroundColor: c.surface, borderColor: c.border }]}
            accessibilityRole="button"
            accessibilityLabel={t("support.openReportA11y", {
              defaultValue: "Open Report a problem to send diagnostics",
            })}
          >
            <Ionicons name="alert-circle-outline" size={18} color={c.brandAccent} />
          </Pressable>

          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t("support.placeholder", { defaultValue: "Message support…" })}
            placeholderTextColor={c.textMuted}
            multiline
            style={[
              styles.input,
              { color: c.text, backgroundColor: c.surface, borderColor: c.inputBorder },
            ]}
            editable={!sending}
            maxLength={2000}
          />

          <Pressable
            onPress={() => void send()}
            disabled={!text.trim() || sending}
            style={[
              styles.sendBtn,
              {
                backgroundColor:
                  !text.trim() || sending ? c.neutral300 : c.brandAccent,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("support.send", { defaultValue: "Send to support" })}
          >
            <Ionicons name="send" size={16} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { padding: space.md, gap: space.sm },
  bubble: {
    maxWidth: "82%",
    padding: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: space.xs,
  },
  systemRow: {
    paddingVertical: 4,
    paddingHorizontal: space.md,
    alignSelf: "center",
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontSize: 15,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  reportBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});
