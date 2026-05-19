import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Banner, Button, Skeleton } from "../../../components/ui";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { postInviteFriendEmail, fetchMyReferrals } from "../../home/api/homeApi";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { useAppTranslation } from "../../../i18n/useAppTranslation";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InviteFriendsScreen() {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useInviteStyles();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [chips, setChips] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: referrals = [], isLoading: loadingHistory } = useQuery({
    queryKey: ["myReferrals"],
    queryFn: fetchMyReferrals,
    staleTime: 60_000,
  });

  const handleTextChange = (val: string) => {
    if (val.endsWith(",") || val.endsWith(" ") || val.endsWith(";")) {
      const raw = val.slice(0, -1).trim().toLowerCase();
      if (raw && emailRegex.test(raw) && !chips.includes(raw)) {
        setChips((prev) => [...prev, raw]);
        setText("");
        setErr("");
        return;
      } else if (raw && !emailRegex.test(raw)) {
        setErr(t("invites.invalidEmail", { email: raw }));
      }
      setText("");
      return;
    }
    setText(val);
    if (err) setErr("");
  };

  const handleSubmitEditing = () => {
    const raw = text.trim().toLowerCase();
    if (raw && emailRegex.test(raw) && !chips.includes(raw)) {
      setChips((prev) => [...prev, raw]);
      setText("");
      setErr("");
    } else if (raw && !emailRegex.test(raw)) {
      setErr(t("invites.invalidEmail", { email: raw }));
    }
  };

  const removeChip = (email: string) => {
    setChips((prev) => prev.filter((e) => e !== email));
  };

  const allEmails = useMemo(() => {
    const extra = text.trim().toLowerCase();
    if (extra && emailRegex.test(extra) && !chips.includes(extra)) {
      return [...chips, extra];
    }
    return chips;
  }, [chips, text]);

  const sendInvites = useCallback(async () => {
    setErr("");
    if (allEmails.length === 0) {
      setErr(t("invites.needOneEmail"));
      return;
    }
    if (allEmails.length > 10) {
      setErr(t("invites.maxTen"));
      return;
    }

    setLoading(true);
    const ok: string[] = [];
    const failed: { email: string; reason: string }[] = [];
    for (const email of allEmails) {
      try {
        await postInviteFriendEmail(email);
        ok.push(email);
      } catch (e) {
        failed.push({ email, reason: getApiErrorMessage(e, "Send failed") });
      }
    }
    setLoading(false);

    if (failed.length && ok.length) {
      Alert.alert(
        t("invites.someFailedTitle"),
        t("invites.someFailedBody", {
          sent: ok.length,
          failed: failed.map((f) => `${f.email} (${f.reason})`).join(", "),
        })
      );
      setChips(failed.map((f) => f.email));
    } else if (failed.length) {
      setErr(t("invites.failedFor", { emails: failed.map((f) => f.email).join(", ") }));
    } else {
      setChips([]);
      setText("");
      setErr("");
      Alert.alert(
        t("invites.sentTitle"),
        t("invites.sentBody", { count: ok.length })
      );
    }
    queryClient.invalidateQueries({ queryKey: ["myReferrals"] });
  }, [allEmails, queryClient, t]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        <Text style={styles.title}>{t("invites.title")}</Text>
        <Text style={styles.sub}>{t("invites.subtitle")}</Text>

        <Text style={styles.label}>{t("invites.emailLabel")}</Text>
        <View style={styles.chipContainer}>
          {chips.map((email) => (
            <View key={email} style={styles.chip}>
              <Text style={styles.chipText} numberOfLines={1}>{email}</Text>
              <Pressable onPress={() => removeChip(email)} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={c.textMuted} />
              </Pressable>
            </View>
          ))}
          <TextInput
            style={styles.chipInput}
            placeholder={chips.length === 0 ? t("invites.emailPlaceholder") : t("invites.addMorePlaceholder")}
            placeholderTextColor={c.textMuted}
            value={text}
            onChangeText={handleTextChange}
            onSubmitEditing={handleSubmitEditing}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="done"
            blurOnSubmit={false}
          />
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.meta}>
            {t("invites.emailsReady", { count: allEmails.length })}
          </Text>
          <Text style={styles.metaMuted}>{t("invites.maxPerSend")}</Text>
        </View>

        {!!err && <Banner tone="danger" title={t("common.error")} description={err} />}

        <Button
          label={
            allEmails.length > 0
              ? t("invites.sendInvites", { count: allEmails.length })
              : t("invites.sendInvites", { count: 0 })
          }
          onPress={sendInvites}
          disabled={loading || allEmails.length === 0}
          loading={loading}
          size="lg"
        />
      </View>

      {/* Invite History */}
      <View style={styles.historySection}>
        <Text style={styles.historyTitle}>{t("invites.pastInvitations")}</Text>
        {loadingHistory ? (
          <View style={{ gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} width="100%" height={40} radius={radii.sm} />
            ))}
          </View>
        ) : referrals.length === 0 ? (
          <View style={styles.emptyHistory}>
            <Ionicons name="mail-outline" size={28} color={c.textMuted} />
            <Text style={styles.emptyHistoryText}>{t("invites.noInvitationsYet")}</Text>
          </View>
        ) : (
          referrals.map((ref: any) => (
            <View key={ref._id ?? ref.email} style={styles.historyRow}>
              <View style={styles.historyIcon}>
                <Ionicons name="mail-outline" size={18} color={c.iconPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyEmail} numberOfLines={1}>{ref.email}</Text>
                <Text style={styles.historyDate}>
                  {ref.createdAt
                    ? new Date(ref.createdAt).toLocaleDateString(undefined, {
                        month: "short", day: "numeric", year: "numeric",
                      })
                    : ""}
                </Text>
              </View>
              <Ionicons name="checkmark-circle" size={18} color={c.success} />
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function useInviteStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      root: { flex: 1, backgroundColor: palette.background },
      content: { padding: space.md, paddingBottom: space.xl, gap: space.md },
      card: {
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: palette.border,
        padding: space.md,
        gap: space.sm,
      },
      title: { ...typography.titleMd, color: palette.iconPrimary },
      sub: { ...typography.bodySm, color: palette.textMuted },
      label: { ...typography.label, color: palette.textSecondary, marginTop: space.sm },
      chipContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: radii.sm,
        paddingHorizontal: 10,
        paddingVertical: 8,
        minHeight: 48,
        alignItems: "center",
        backgroundColor: palette.input,
      },
      chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: palette.brandSubtle,
        borderRadius: radii.pill,
        paddingHorizontal: 10,
        paddingVertical: 5,
        maxWidth: "90%",
      },
      chipText: { ...typography.bodySm, color: palette.iconPrimary, fontWeight: "600", flexShrink: 1 },
      chipInput: {
        flex: 1,
        minWidth: 120,
        fontSize: typography.bodyMd.fontSize,
        color: palette.text,
        paddingVertical: 4,
      },
      metaRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      },
      meta: { ...typography.caption, color: palette.textMuted },
      metaMuted: { ...typography.caption, color: palette.textMuted },
      historySection: {
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: palette.border,
        padding: space.md,
        gap: space.sm,
      },
      historyTitle: { ...typography.subtitle, color: palette.text, marginBottom: 4 },
      emptyHistory: { alignItems: "center", gap: 6, paddingVertical: space.md },
      emptyHistoryText: { ...typography.bodySm, color: palette.textMuted },
      historyRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: palette.border,
      },
      historyIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: palette.brandSubtle,
        alignItems: "center",
        justifyContent: "center",
      },
      historyEmail: { ...typography.bodySm, color: palette.text, fontWeight: "600" },
      historyDate: { ...typography.caption, color: palette.textMuted, marginTop: 1 },
    })
  );
}
