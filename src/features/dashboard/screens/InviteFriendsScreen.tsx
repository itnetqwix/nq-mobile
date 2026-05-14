import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Banner, Button } from "../../../components/ui";
import { colors, radii, space, typography } from "../../../theme";
import { postInviteFriendEmail } from "../../home/api/homeApi";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InviteFriendsScreen() {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastSent, setLastSent] = useState<string[]>([]);

  const { validEmails, invalidEmails, parsedCount } = useMemo(() => {
    const parsed = text
      .split(/[,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const dedup = Array.from(new Set(parsed));
    const valid = dedup.filter((e) => emailRegex.test(e));
    const invalid = dedup.filter((e) => e && !emailRegex.test(e));
    return { validEmails: valid, invalidEmails: invalid, parsedCount: dedup.length };
  }, [text]);

  const sendInvites = useCallback(async () => {
    setErr("");
    setLastSent([]);
    if (validEmails.length === 0) {
      setErr("Enter at least one valid email address.");
      return;
    }
    if (validEmails.length > 10) {
      setErr("You can invite a maximum of 10 friends at a time.");
      return;
    }

    setLoading(true);
    /**
     * Sequential sends avoid rate-limit / SMTP flooding (web does serial-ish bursts too).
     * Track per-address failures so we can show partial success instead of all-or-nothing.
     */
    const ok: string[] = [];
    const failed: { email: string; reason: string }[] = [];
    for (const email of validEmails) {
      try {
        await postInviteFriendEmail(email);
        ok.push(email);
      } catch (e) {
        failed.push({ email, reason: getApiErrorMessage(e, "Send failed") });
      }
    }
    setLoading(false);

    setLastSent(ok);
    if (failed.length && ok.length) {
      Alert.alert(
        "Some invites failed",
        `Sent: ${ok.length}\nFailed: ${failed
          .map((f) => `${f.email} (${f.reason})`)
          .join(", ")}`
      );
      setText(failed.map((f) => f.email).join(", "));
    } else if (failed.length) {
      setErr(
        `Failed for: ${failed.map((f) => f.email).join(", ")}.`
      );
    } else {
      setText("");
      setErr("");
      Alert.alert(
        "Invitations sent",
        `Sent ${ok.length} invitation${ok.length === 1 ? "" : "s"}. Your friends should receive an email shortly.`
      );
    }
  }, [validEmails]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        <Text style={styles.title}>Invite friends</Text>
        <Text style={styles.sub}>
          We email each address from your account.
        </Text>

        <Text style={styles.label}>Email addresses</Text>
        <TextInput
          style={styles.input}
          multiline
          numberOfLines={4}
          placeholder="e.g. friend@example.com, coach@example.com"
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Email addresses"
        />

        <View style={styles.metaRow}>
          <Text style={styles.meta}>
            {validEmails.length} valid{parsedCount > 0 ? ` • ${parsedCount} typed` : ""}
          </Text>
          <Text style={styles.metaMuted}>Max 10 per send</Text>
        </View>

        {invalidEmails.length > 0 && (
          <Banner
            tone="warning"
            title="Invalid addresses skipped"
            description={invalidEmails.join(", ")}
          />
        )}

        {!!err && (
          <Banner tone="danger" title="Invites failed" description={err} />
        )}

        <Button
          label={`Send ${
            validEmails.length > 0 ? `${validEmails.length} ` : ""
          }invite${validEmails.length === 1 ? "" : "s"}`}
          onPress={sendInvites}
          disabled={loading || validEmails.length === 0}
          loading={loading}
          size="lg"
        />

        {lastSent.length > 0 && (
          <View style={styles.okBox}>
            <Ionicons name="mail-open-outline" size={18} color={colors.success} />
            <Text style={styles.okText}>Last sent to: {lastSent.join(", ")}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { padding: space.md, paddingBottom: space.xl },

  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    gap: space.sm,
  },
  title: { ...typography.titleMd, color: colors.brandNavy },
  sub: { ...typography.bodyMd, color: colors.textMuted },
  label: { ...typography.label, color: colors.textSecondary, marginTop: space.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: typography.bodyMd.fontWeight,
    fontFamily: typography.bodyMd.fontFamily,
    letterSpacing: typography.bodyMd.letterSpacing,
    color: colors.text,
    minHeight: 96,
    textAlignVertical: "top",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  meta: { ...typography.caption, color: colors.textMuted },
  metaMuted: { ...typography.caption, color: colors.textMuted },

  okBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.successSubtle,
    borderRadius: radii.sm,
    padding: space.sm,
    marginTop: space.sm,
  },
  okText: { flex: 1, ...typography.caption, color: colors.success },
});
