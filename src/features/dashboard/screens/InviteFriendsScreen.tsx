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
import { postInviteFriendEmail } from "../../home/api/homeApi";

const NAVY = "#000080";
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InviteFriendsScreen() {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const { validEmails, invalidEmails, parsedCount } = useMemo(() => {
    const parsed = text
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    const valid = parsed.filter((e) => emailRegex.test(e));
    const invalid = parsed.filter((e) => e && !emailRegex.test(e));
    return { validEmails: valid, invalidEmails: invalid, parsedCount: parsed.length };
  }, [text]);

  const sendInvites = useCallback(async () => {
    setErr("");
    if (validEmails.length === 0) {
      setErr("Enter at least one valid email address.");
      return;
    }
    if (validEmails.length > 10) {
      setErr("You can invite a maximum of 10 friends at a time.");
      return;
    }

    setLoading(true);
    const failed: string[] = [];
    await Promise.all(
      validEmails.map(async (email) => {
        try {
          await postInviteFriendEmail(email);
        } catch {
          failed.push(email);
        }
      })
    );
    setLoading(false);

    if (failed.length) {
      setErr(`Failed for: ${failed.join(", ")}`);
    } else {
      setText("");
      setErr("");
      Alert.alert("Invitations sent", "Your friends should receive an email shortly.");
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
          Same flow as the website: we email each address using your account (promotional email
          must stay enabled in settings for delivery).
        </Text>

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
            <Text style={styles.btnText}>Send invites</Text>
          )}
        </Pressable>
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
