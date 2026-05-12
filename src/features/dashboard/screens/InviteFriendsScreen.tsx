import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, space } from "../../../theme/tokens";
import { useAuth } from "../../auth/context/AuthContext";
import { postInviteFriendEmail } from "../../home/api/homeApi";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";

const NAVY = "#000080";
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InviteFriendsScreen() {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastSent, setLastSent] = useState<string[]>([]);

  /**
   * The backend sends the invite email **only** when the inviter's
   * `notifications.promotional.email` toggle is true (see
   * `nq-backend-main/src/modules/user/userService.ts#inviteFriend`). If it's off, the row
   * is still inserted into `ReferredUser` but no mail goes out — the user sees nothing
   * delivered, which is the usual cause of "invite friends isn't working". Surface that
   * gotcha right on the screen.
   */
  const notifications = (user?.notifications as any) ?? {};
  const promoEmailEnabled = notifications?.promotional?.email !== false;

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
        `Failed for: ${failed.map((f) => f.email).join(", ")}. ` +
          (promoEmailEnabled
            ? ""
            : "Promotional email is off in your account — turn it on in Settings → Notifications.")
      );
    } else {
      setText("");
      setErr("");
      Alert.alert(
        "Invitations sent",
        promoEmailEnabled
          ? `Sent ${ok.length} invitation${ok.length === 1 ? "" : "s"}. Your friends should receive an email shortly.`
          : `Sent ${ok.length} ${ok.length === 1 ? "invitation" : "invitations"}, but promotional email is OFF on your account, so delivery may be skipped server-side. Enable it in Settings → Notifications.`
      );
    }
  }, [validEmails, promoEmailEnabled]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        <Text style={styles.title}>Invite friends</Text>
        <Text style={styles.sub}>
          Same flow as the website: we email each address from your account.
        </Text>

        {!promoEmailEnabled && (
          <View style={styles.warnBox}>
            <Text style={styles.warnText}>
              Heads up: promotional email is currently OFF for your account, so the backend
              skips sending invites. Enable it in Settings → Notifications to deliver.
            </Text>
          </View>
        )}

        <Text style={styles.label}>Email addresses</Text>
        <TextInput
          style={styles.input}
          multiline
          numberOfLines={4}
          placeholder="e.g. friend@example.com, coach@example.com"
          placeholderTextColor="#9ca3af"
          value={text}
          onChangeText={setText}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.metaRow}>
          <Text style={styles.meta}>
            {validEmails.length} valid{parsedCount > 0 ? ` • ${parsedCount} typed` : ""}
          </Text>
          <Text style={styles.metaMuted}>Max 10 per send</Text>
        </View>

        {invalidEmails.length > 0 && (
          <View style={styles.warnBox}>
            <Text style={styles.warnText}>
              These look invalid and are skipped: {invalidEmails.join(", ")}
            </Text>
          </View>
        )}

        {!!err && (
          <View style={styles.errBox}>
            <Ionicons name="alert-circle-outline" size={18} color="#b91c1c" />
            <Text style={styles.errText}>{err}</Text>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.btn,
            (loading || validEmails.length === 0) && styles.btnDisabled,
            pressed && styles.btnPressed,
          ]}
          onPress={sendInvites}
          disabled={loading || validEmails.length === 0}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>
              Send {validEmails.length > 0 ? `${validEmails.length} ` : ""}invite
              {validEmails.length === 1 ? "" : "s"}
            </Text>
          )}
        </Pressable>

        {lastSent.length > 0 && (
          <View style={styles.okBox}>
            <Ionicons name="mail-open-outline" size={18} color="#15803d" />
            <Text style={styles.okText}>
              Last sent to: {lastSent.join(", ")}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f6f7fb" },
  content: { padding: space.md, paddingBottom: space.xl },

  card: {
    backgroundColor: "#fff",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: space.md,
    gap: space.sm,
  },
  title: { fontSize: 20, fontWeight: "700", color: NAVY },
  sub: { fontSize: 14, color: "#6b7280", lineHeight: 20 },
  label: { fontSize: 13, fontWeight: "700", color: "#374151", marginTop: space.sm },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111827",
    minHeight: 96,
    textAlignVertical: "top",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  meta: { fontSize: 12, color: "#6b7280" },
  metaMuted: { fontSize: 12, color: "#9ca3af" },

  warnBox: {
    backgroundColor: "#fff7ed",
    borderRadius: radii.sm,
    padding: space.sm,
  },
  warnText: { fontSize: 12, color: "#9a3412", lineHeight: 17 },

  errBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderRadius: radii.sm,
    padding: space.sm,
  },
  errText: { flex: 1, fontSize: 13, color: "#b91c1c", lineHeight: 18 },

  okBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#dcfce7",
    borderRadius: radii.sm,
    padding: space.sm,
    marginTop: space.sm,
  },
  okText: { flex: 1, fontSize: 12, color: "#15803d", lineHeight: 17 },

  btn: {
    marginTop: space.sm,
    backgroundColor: NAVY,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.45 },
  btnPressed: { opacity: 0.9 },
  btnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
