import React, { useState } from "react";
import {
  Alert,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, FormField } from "../../../components/ui";
import { radii, space, typography, useThemedStyles } from "../../../theme";
import { useAuth } from "../../auth/context/AuthContext";
import { postWriteUs } from "../../home/api/homeApi";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { FAQ_SECTIONS } from "../content/faqContent";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SUPPORT_EMAIL = "support@netqwix.com";

export function FaqScreen() {
  const styles = useFaqStyles();
  const { user } = useAuth();
  const [openId, setOpenId] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const presetName = (user?.fullname as string) ?? (user?.fullName as string) ?? "";
  const presetEmail = (user?.email as string) ?? "";

  const toggle = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenId((cur) => (cur === id ? null : id));
  };

  const submit = async () => {
    if (!topic.trim() || !question.trim()) {
      Alert.alert("Missing fields", "Please add a topic and your question.");
      return;
    }
    setSubmitting(true);
    try {
      await postWriteUs({
        name: presetName || "NetQwix user",
        email: presetEmail,
        subject: `FAQ: ${topic.trim()}`,
        description: question.trim(),
      });
      Alert.alert(
        "Question received",
        "Thanks — our team will get back to you as soon as possible."
      );
      setTopic("");
      setQuestion("");
    } catch (e) {
      Alert.alert("Could not send", getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.heroTitle}>Help & FAQ</Text>
      <Text style={styles.heroSub}>
        Answers to common questions about lessons, video calls, payments, and chat.
      </Text>

      {FAQ_SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.items.map((item) => {
            const open = openId === item.id;
            return (
              <Pressable
                key={item.id}
                style={styles.card}
                onPress={() => toggle(item.id)}
              >
                <View style={styles.cardHead}>
                  <Text style={styles.q}>{item.q}</Text>
                  <Ionicons
                    name={open ? "chevron-up" : "chevron-down"}
                    size={18}
                    color="#64748B"
                  />
                </View>
                {open ? <Text style={styles.a}>{item.a}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={styles.askBox}>
        <Text style={styles.askTitle}>Still left with a question?</Text>
        <Text style={styles.askSub}>
          Ask us on {SUPPORT_EMAIL} — fill in the form below and we will email you back.
        </Text>
        <FormField label="Topic" value={topic} onChangeText={setTopic} placeholder="Brief topic" />
        <FormField
          label="Your question"
          value={question}
          onChangeText={setQuestion}
          placeholder="Describe your question in detail"
          multiline
          numberOfLines={5}
        />
        <Button title="Submit question" onPress={() => void submit()} loading={submitting} />
      </View>
    </ScrollView>
  );
}

function useFaqStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      root: { flex: 1, backgroundColor: palette.background },
      content: { padding: space.md, paddingBottom: space.xxl, gap: space.md },
      heroTitle: { ...typography.titleMd, color: palette.text },
      heroSub: { ...typography.bodyMd, color: palette.textMuted, lineHeight: 22 },
      section: { gap: space.sm },
      sectionTitle: {
        ...typography.titleSm,
        color: palette.brandNavy,
        marginTop: space.sm,
      },
      card: {
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.md,
        padding: space.md,
        borderWidth: 1,
        borderColor: palette.border,
      },
      cardHead: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: space.sm,
      },
      q: { flex: 1, ...typography.bodyMd, fontWeight: "600", color: palette.text },
      a: {
        marginTop: space.sm,
        ...typography.bodyMd,
        color: palette.textMuted,
        lineHeight: 22,
      },
      askBox: {
        marginTop: space.lg,
        padding: space.md,
        borderRadius: radii.md,
        backgroundColor: palette.surfaceElevated,
        borderWidth: 1,
        borderColor: palette.border,
        gap: space.md,
      },
      askTitle: { ...typography.titleSm, color: palette.text },
      askSub: { ...typography.bodySm, color: palette.textMuted, lineHeight: 20 },
    })
  );
}
