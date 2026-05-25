import React, { useMemo, useState } from "react";
import {
  Alert,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, FormField } from "../../../components/ui";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { useAuth } from "../../auth/context/AuthContext";
import { postWriteUs } from "../../home/api/homeApi";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { FAQ_SECTIONS, type FaqItem, type FaqSection } from "../content/faqContent";
import { fuzzySearch } from "../../../lib/search/fuzzyMatch";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SUPPORT_EMAIL = "support@netqwix.com";

export function FaqScreen() {
  const { t } = useAppTranslation();
  const styles = useFaqStyles();
  const c = useThemeColors();
  const { user } = useAuth();
  const [openId, setOpenId] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState("");

  /**
   * Fuzzy search across every FAQ item. We pre-pack each item with its
   * `q` + `a` + section title as searchable fields so a query like
   * "instant join" matches "How does an instant lesson work?" under the
   * "Instant lessons" section even with no exact substring overlap.
   *
   * When the query is empty we fall back to the original section grouping.
   */
  const filteredSections: FaqSection[] = useMemo(() => {
    const q = query.trim();
    if (!q) return FAQ_SECTIONS;
    const haystack: { item: FaqItem & { __section: string }; fields: string[] }[] = [];
    for (const section of FAQ_SECTIONS) {
      for (const item of section.items) {
        haystack.push({
          item: { ...item, __section: section.title },
          fields: [item.q, item.a, section.title],
        });
      }
    }
    const hits = fuzzySearch(q, haystack, { fieldWeights: [1, 0.7, 0.5] });
    const bySection: Record<string, FaqItem[]> = {};
    for (const hit of hits) {
      const { __section, ...rest } = hit.item;
      (bySection[__section] ??= []).push(rest);
    }
    return Object.entries(bySection).map(([title, items]) => ({ title, items }));
  }, [query]);

  const presetName = (user?.fullname as string) ?? (user?.fullName as string) ?? "";
  const presetEmail = (user?.email as string) ?? "";

  const toggle = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenId((cur) => (cur === id ? null : id));
  };

  const submit = async () => {
    if (!topic.trim() || !question.trim()) {
      Alert.alert(t("faq.missingFieldsTitle"), t("faq.missingFieldsBody"));
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
      Alert.alert(t("faq.receivedTitle"), t("faq.receivedBody"));
      setTopic("");
      setQuestion("");
    } catch (e) {
      Alert.alert(t("faq.couldNotSend"), getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.heroTitle}>{t("faq.heroTitle")}</Text>
      <Text style={styles.heroSub}>{t("faq.heroSub")}</Text>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={c.iconMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("faq.searchPlaceholder", { defaultValue: "Search FAQ…" })}
          placeholderTextColor={c.textMuted}
          style={[styles.searchInput, { color: c.text }]}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel={t("faq.searchA11y", { defaultValue: "Search frequently asked questions" })}
        />
        {query.length > 0 ? (
          <Pressable
            onPress={() => setQuery("")}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t("common.clear", { defaultValue: "Clear" })}
          >
            <Ionicons name="close-circle" size={18} color={c.iconMuted} />
          </Pressable>
        ) : null}
      </View>

      {query.trim().length > 0 && filteredSections.length === 0 ? (
        <View style={styles.emptySearch}>
          <Ionicons name="search" size={20} color={c.iconMuted} />
          <Text style={[typography.bodySm, { color: c.textMuted, textAlign: "center" }]}>
            {t("faq.noResults", {
              defaultValue: "No matches yet — try simpler keywords or ask the team below.",
            })}
          </Text>
        </View>
      ) : null}

      {filteredSections.map((section) => (
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
        <Text style={styles.askTitle}>{t("faq.askTitle")}</Text>
        <Text style={styles.askSub}>
          {t("faq.askSub", { email: SUPPORT_EMAIL })}
        </Text>
        <FormField label={t("faq.topic")} value={topic} onChangeText={setTopic} placeholder={t("faq.topicPlaceholder")} />
        <FormField
          label={t("faq.yourQuestion")}
          value={question}
          onChangeText={setQuestion}
          placeholder={t("faq.questionPlaceholder")}
          multiline
          numberOfLines={5}
        />
        <Button title={t("faq.sendQuestion")} onPress={() => void submit()} loading={submitting} />
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
      searchRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: palette.border,
        paddingHorizontal: space.md,
        paddingVertical: 10,
      },
      searchInput: {
        flex: 1,
        ...typography.bodyMd,
        paddingVertical: 0,
      },
      emptySearch: {
        marginTop: space.md,
        padding: space.md,
        borderRadius: radii.md,
        backgroundColor: palette.surfaceMuted,
        gap: space.xs,
        alignItems: "center",
      },
    })
  );
}
