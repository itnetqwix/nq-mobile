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
import { colors, radii, space, typography } from "../../../theme";
import { postInviteFriendEmail, fetchMyReferrals } from "../../home/api/homeApi";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InviteFriendsScreen() {
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
        setErr(`"${raw}" is not a valid email.`);
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
      setErr(`"${raw}" is not a valid email.`);
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
      setErr("Enter at least one valid email address.");
      return;
    }
    if (allEmails.length > 10) {
      setErr("You can invite a maximum of 10 friends at a time.");
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
        "Some invites failed",
        `Sent: ${ok.length}\nFailed: ${failed.map((f) => `${f.email} (${f.reason})`).join(", ")}`
      );
      setChips(failed.map((f) => f.email));
    } else if (failed.length) {
      setErr(`Failed for: ${failed.map((f) => f.email).join(", ")}.`);
    } else {
      setChips([]);
      setText("");
      setErr("");
      Alert.alert("Invitations sent", `Sent ${ok.length} invitation${ok.length === 1 ? "" : "s"}.`);
    }
    queryClient.invalidateQueries({ queryKey: ["myReferrals"] });
  }, [allEmails, queryClient]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        <Text style={styles.title}>Invite friends</Text>
        <Text style={styles.sub}>
          Enter email addresses to send invitations. Press space, comma, or return after each email.
        </Text>

        <Text style={styles.label}>Email addresses</Text>
        <View style={styles.chipContainer}>
          {chips.map((email) => (
            <View key={email} style={styles.chip}>
              <Text style={styles.chipText} numberOfLines={1}>{email}</Text>
              <Pressable onPress={() => removeChip(email)} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
          <TextInput
            style={styles.chipInput}
            placeholder={chips.length === 0 ? "friend@example.com" : "Add more..."}
            placeholderTextColor={colors.textMuted}
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
            {allEmails.length} email{allEmails.length === 1 ? "" : "s"} ready
          </Text>
          <Text style={styles.metaMuted}>Max 10 per send</Text>
        </View>

        {!!err && <Banner tone="danger" title="Error" description={err} />}

        <Button
          label={`Send ${allEmails.length > 0 ? `${allEmails.length} ` : ""}invite${allEmails.length === 1 ? "" : "s"}`}
          onPress={sendInvites}
          disabled={loading || allEmails.length === 0}
          loading={loading}
          size="lg"
        />
      </View>

      {/* Invite History */}
      <View style={styles.historySection}>
        <Text style={styles.historyTitle}>Past invitations</Text>
        {loadingHistory ? (
          <View style={{ gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} width="100%" height={40} radius={radii.sm} />
            ))}
          </View>
        ) : referrals.length === 0 ? (
          <View style={styles.emptyHistory}>
            <Ionicons name="mail-outline" size={28} color={colors.textMuted} />
            <Text style={styles.emptyHistoryText}>No invitations sent yet</Text>
          </View>
        ) : (
          referrals.map((ref: any) => (
            <View key={ref._id ?? ref.email} style={styles.historyRow}>
              <View style={styles.historyIcon}>
                <Ionicons name="mail-outline" size={18} color={colors.brandNavy} />
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
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { padding: space.md, paddingBottom: space.xl, gap: space.md },

  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    gap: space.sm,
  },
  title: { ...typography.titleMd, color: colors.brandNavy },
  sub: { ...typography.bodySm, color: colors.textMuted },
  label: { ...typography.label, color: colors.textSecondary, marginTop: space.sm },

  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 48,
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brandSubtle,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: "90%",
  },
  chipText: { ...typography.bodySm, color: colors.brandNavy, fontWeight: "600", flexShrink: 1 },
  chipInput: {
    flex: 1,
    minWidth: 120,
    fontSize: typography.bodyMd.fontSize,
    color: colors.text,
    paddingVertical: 4,
  },

  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  meta: { ...typography.caption, color: colors.textMuted },
  metaMuted: { ...typography.caption, color: colors.textMuted },

  historySection: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    gap: space.sm,
  },
  historyTitle: { ...typography.subtitle, color: colors.text, marginBottom: 4 },
  emptyHistory: { alignItems: "center", gap: 6, paddingVertical: space.md },
  emptyHistoryText: { ...typography.bodySm, color: colors.textMuted },

  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  historyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brandSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  historyEmail: { ...typography.bodySm, color: colors.text, fontWeight: "600" },
  historyDate: { ...typography.caption, color: colors.textMuted, marginTop: 1 },
});
