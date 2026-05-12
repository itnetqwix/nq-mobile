import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AccountType } from "../../../constants/accountType";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { radii, space } from "../../../theme/tokens";
import { useAuth } from "../../auth/context/AuthContext";
import {
  fetchScheduledMeetings,
  postRaiseConcern,
  type RaiseConcernReason,
} from "../../home/api/homeApi";

const NAVY = "#000080";
const REASONS: RaiseConcernReason[] = ["Technical issue", "Request for Refund"];

/**
 * Web parity: `nq-frontend-main/app/components/contactUs` flow.
 *
 *  Contact Us hub  →  Report Technical Issue / Refund  →  SessionsList  →  ReportForm
 *
 * On mobile we collapse those four screens into one with three modes:
 *   1) `list`    — show recent bookings; tap to choose the session.
 *   2) `form`    — collect reason / subject / description / refund flag, POST `/user/raise-concern`.
 *   3) `success` — small confirmation; tap "Report another" to go back to list.
 */
export function ReportIssueScreen() {
  const { user, accountType } = useAuth();

  const presetName = (user?.fullname as string) ?? "";
  const presetEmail = (user?.email as string) ?? "";
  const presetPhone = (user?.mobile_no as string) ?? (user?.phone as string) ?? "";

  const [selected, setSelected] = useState<any | null>(null);
  const [reason, setReason] = useState<RaiseConcernReason>("Technical issue");
  const [refundLinked, setRefundLinked] = useState<"Yes" | "No">("No");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [doneFor, setDoneFor] = useState<string | null>(null);

  /**
   * Same data source the web SessionsList uses. We pull "confirmed" + "completed" so the
   * trainee can also report on sessions that already happened (e.g. asking for a refund
   * after a no-show). The backend doesn't gate `raise-concern` by status anyway.
   */
  const confirmedQ = useQuery({
    queryKey: ["raiseConcern", "sessions", "confirmed"],
    queryFn: () => fetchScheduledMeetings("confirmed"),
    staleTime: 30_000,
  });
  const completedQ = useQuery({
    queryKey: ["raiseConcern", "sessions", "completed"],
    queryFn: () => fetchScheduledMeetings("completed"),
    staleTime: 30_000,
  });
  const upcomingQ = useQuery({
    queryKey: ["raiseConcern", "sessions", "upcoming"],
    queryFn: () => fetchScheduledMeetings("upcoming"),
    staleTime: 30_000,
  });

  const sessions = useMemo(() => {
    const merged = [
      ...(upcomingQ.data ?? []),
      ...(confirmedQ.data ?? []),
      ...(completedQ.data ?? []),
    ];
    const seen = new Set<string>();
    const unique: any[] = [];
    for (const s of merged) {
      const id = String(s?._id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      unique.push(s);
    }
    return unique.sort((a: any, b: any) => {
      const ad = new Date(a?.booked_date ?? a?.createdAt ?? 0).getTime();
      const bd = new Date(b?.booked_date ?? b?.createdAt ?? 0).getTime();
      return bd - ad;
    });
  }, [upcomingQ.data, confirmedQ.data, completedQ.data]);

  const loadingList =
    confirmedQ.isLoading || completedQ.isLoading || upcomingQ.isLoading;
  const refreshingList =
    confirmedQ.isRefetching ||
    completedQ.isRefetching ||
    upcomingQ.isRefetching;

  const onRefreshSessions = () => {
    void Promise.all([
      upcomingQ.refetch(),
      confirmedQ.refetch(),
      completedQ.refetch(),
    ]);
  };

  const submit = async () => {
    if (!selected?._id) {
      Alert.alert("Pick a session", "Choose a session to attach this report to.");
      return;
    }
    if (!subject.trim() || !description.trim()) {
      Alert.alert("Required", "Subject and description are required.");
      return;
    }
    setSubmitting(true);
    try {
      await postRaiseConcern({
        name: presetName,
        email: presetEmail?.toLowerCase(),
        phone_number: presetPhone,
        reason,
        subject: subject.trim(),
        description: description.trim(),
        is_releted_to_refund:
          /** Mirrors web: refund-reason auto-sets Yes; technical-issue uses the toggle. */
          reason === "Request for Refund" ? "Yes" : refundLinked,
        booking_id: String(selected._id),
      });
      setDoneFor(String(selected._id));
      setSubject("");
      setDescription("");
      setRefundLinked("No");
    } catch (e) {
      Alert.alert(
        "Could not submit",
        getApiErrorMessage(e, "Failed to submit the report.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (doneFor) {
    return (
      <View style={styles.successWrap}>
        <Ionicons name="checkmark-circle" size={64} color="#16a34a" />
        <Text style={styles.successTitle}>Report submitted</Text>
        <Text style={styles.successBody}>
          Our team has received your report. You'll hear back at{" "}
          {presetEmail || "your account email"} once it's reviewed.
        </Text>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => {
            setDoneFor(null);
            setSelected(null);
          }}
        >
          <Text style={styles.primaryBtnText}>Report another session</Text>
        </Pressable>
      </View>
    );
  }

  if (!selected) {
    return (
      <View style={styles.root}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Report an issue</Text>
          <Text style={styles.heroSub}>
            Same flow as the website. Choose the session you want to report on — we'll then ask
            for details and email our support team.
          </Text>
        </View>

        {loadingList ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={NAVY} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshingList}
                onRefresh={onRefreshSessions}
                tintColor={NAVY}
              />
            }
          >
            {sessions.length === 0 ? (
              <View style={styles.emptyBlock}>
                <Ionicons name="calendar-outline" size={48} color="#d1d5db" />
                <Text style={styles.emptyTitle}>No sessions found</Text>
                <Text style={styles.emptyBody}>
                  Once you've booked or completed a session, you can report issues on it here.
                </Text>
              </View>
            ) : (
              sessions.map((s: any) => (
                <SessionCard
                  key={String(s._id)}
                  session={s}
                  isTrainer={accountType === AccountType.TRAINER}
                  onPress={() => setSelected(s)}
                />
              ))
            )}
          </ScrollView>
        )}
      </View>
    );
  }

  const sessionLabel = formatSessionLabel(selected);
  const peer =
    accountType === AccountType.TRAINER ? selected.trainee_id : selected.trainer_id;
  const peerName = peer?.fullname ?? peer?.email ?? "Other party";

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#f6f7fb" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.backRow} onPress={() => setSelected(null)} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={NAVY} />
          <Text style={styles.backLabel}>Choose a different session</Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Reporting about</Text>
          <Text style={styles.cardSession}>{sessionLabel}</Text>
          <Text style={styles.cardPeer}>with {peerName}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>What's the issue?</Text>
          <View style={styles.reasonRow}>
            {REASONS.map((r) => {
              const on = reason === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => setReason(r)}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{r}</Text>
                </Pressable>
              );
            })}
          </View>

          {reason === "Technical issue" && (
            <View style={{ marginTop: space.sm }}>
              <Text style={styles.label}>Related to refund?</Text>
              <View style={styles.reasonRow}>
                {(["No", "Yes"] as const).map((opt) => {
                  const on = refundLinked === opt;
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => setRefundLinked(opt)}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{opt}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          <Text style={styles.label}>Subject</Text>
          <TextInput
            style={styles.input}
            placeholder="One-line summary of the problem"
            placeholderTextColor="#9ca3af"
            value={subject}
            onChangeText={setSubject}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Tell us exactly what happened — the more detail, the faster we can help."
            placeholderTextColor="#9ca3af"
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />

          <Pressable
            style={[styles.primaryBtn, submitting && { opacity: 0.7 }]}
            onPress={submit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Submit report</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SessionCard({
  session,
  isTrainer,
  onPress,
}: {
  session: any;
  isTrainer: boolean;
  onPress: () => void;
}) {
  const peer = isTrainer ? session.trainee_id : session.trainer_id;
  const peerName = peer?.fullname ?? peer?.email ?? "—";
  const avatar = getS3ImageUrl(peer?.profile_picture);
  const label = formatSessionLabel(session);
  return (
    <Pressable style={styles.sessionCard} onPress={onPress}>
      {avatar ? (
        <Image source={{ uri: avatar }} style={styles.sessionAvatar} />
      ) : (
        <View style={[styles.sessionAvatar, styles.sessionAvatarFallback]}>
          <Text style={styles.sessionAvatarInitial}>
            {(peerName ?? "?")[0]?.toUpperCase()}
          </Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.sessionPeer} numberOfLines={1}>
          {peerName}
        </Text>
        <Text style={styles.sessionMeta} numberOfLines={2}>
          {label}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
    </Pressable>
  );
}

function formatSessionLabel(session: any): string {
  if (!session) return "Session";
  const d = session?.booked_date ? new Date(session.booked_date) : null;
  const datePart = d
    ? d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
  const time =
    session?.start_time && session?.end_time
      ? ` · ${session.start_time}–${session.end_time}`
      : "";
  const instant = session?.is_instant ? " · Instant lesson" : "";
  return `${datePart}${time}${instant}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f6f7fb" },
  hero: {
    padding: space.md,
    paddingBottom: space.sm,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  heroTitle: { fontSize: 22, fontWeight: "800", color: NAVY, letterSpacing: -0.3 },
  heroSub: { fontSize: 13, color: "#6b7280", marginTop: 6, lineHeight: 18 },

  list: { padding: space.md, gap: space.sm, paddingBottom: space.xl * 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  emptyBlock: {
    alignItems: "center",
    paddingVertical: space.xl * 2,
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#374151" },
  emptyBody: { fontSize: 13, color: "#6b7280", textAlign: "center", lineHeight: 19 },

  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.md,
    backgroundColor: "#fff",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  sessionAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#eef2ff" },
  sessionAvatarFallback: { alignItems: "center", justifyContent: "center" },
  sessionAvatarInitial: { color: NAVY, fontWeight: "800", fontSize: 18 },
  sessionPeer: { fontSize: 15, fontWeight: "700", color: "#111827" },
  sessionMeta: { fontSize: 12, color: "#6b7280", marginTop: 2, lineHeight: 17 },

  content: { padding: space.md, gap: space.md, paddingBottom: space.xl * 2 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  backLabel: { color: NAVY, fontWeight: "700", fontSize: 14 },

  card: {
    backgroundColor: "#fff",
    borderRadius: radii.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: space.sm,
  },
  cardLabel: { fontSize: 11, color: "#6b7280", textTransform: "uppercase", fontWeight: "700" },
  cardSession: { fontSize: 15, fontWeight: "700", color: "#111827" },
  cardPeer: { fontSize: 13, color: "#374151" },

  label: { fontSize: 13, fontWeight: "700", color: "#374151" },

  reasonRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
  },
  chipOn: { backgroundColor: NAVY, borderColor: NAVY },
  chipText: { fontSize: 13, color: "#374151", fontWeight: "600" },
  chipTextOn: { color: "#fff" },

  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: radii.sm,
    padding: space.sm,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#f9fafb",
  },
  textarea: { minHeight: 130 },

  primaryBtn: {
    marginTop: space.sm,
    backgroundColor: NAVY,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  successWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.lg,
    backgroundColor: "#f6f7fb",
    gap: space.sm,
  },
  successTitle: { fontSize: 22, fontWeight: "800", color: "#16a34a" },
  successBody: {
    fontSize: 14,
    color: "#374151",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: space.md,
  },
});
