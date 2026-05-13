import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { Button, EmptyState, FormField, ImageWithSkeleton } from "../../../components/ui";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { colors, radii, space, typography } from "../../../theme";
import { useAuth } from "../../auth/context/AuthContext";
import {
  fetchScheduledMeetings,
  postRaiseConcern,
  type RaiseConcernReason,
} from "../../home/api/homeApi";

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
        <Ionicons name="checkmark-circle" size={64} color={colors.success} />
        <Text style={styles.successTitle}>Report submitted</Text>
        <Text style={styles.successBody}>
          Our team has received your report. You'll hear back at{" "}
          {presetEmail || "your account email"} once it's reviewed.
        </Text>
        <Button
          label="Report another session"
          onPress={() => {
            setDoneFor(null);
            setSelected(null);
          }}
        />
      </View>
    );
  }

  if (!selected) {
    return (
      <View style={styles.root}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Report an issue</Text>
          <Text style={styles.heroSub}>
            Choose the session you want to report on — we'll then ask
            for details and email our support team.
          </Text>
        </View>

        {loadingList ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.brandNavy} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshingList}
                onRefresh={onRefreshSessions}
                tintColor={colors.brandNavy}
              />
            }
          >
            {sessions.length === 0 ? (
              <EmptyState
                icon="calendar-outline"
                title="No sessions found"
                description="Once you've booked or completed a session, you can report issues on it here."
              />
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
      style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.backRow} onPress={() => setSelected(null)} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={colors.brandNavy} />
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

          <FormField
            label="Subject"
            placeholder="One-line summary of the problem"
            value={subject}
            onChangeText={setSubject}
          />

          <FormField
            label="Description"
            placeholder="Tell us exactly what happened — the more detail, the faster we can help."
            value={description}
            onChangeText={setDescription}
            multiline
            inputStyle={styles.textarea}
          />

          <Button
            label="Submit report"
            onPress={submit}
            disabled={submitting}
            loading={submitting}
            style={{ marginTop: space.sm }}
          />
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
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatar]);

  const label = formatSessionLabel(session);
  return (
    <Pressable style={styles.sessionCard} onPress={onPress}>
      {avatar && !avatarFailed ? (
        <ImageWithSkeleton
          uri={avatar}
          width={44}
          height={44}
          borderRadius={22}
          resizeMode="cover"
          onLoadError={() => setAvatarFailed(true)}
          accessibilityLabel={`${peerName} photo`}
        />
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
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
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
  root: { flex: 1, backgroundColor: colors.surface },
  hero: {
    padding: space.md,
    paddingBottom: space.sm,
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  heroTitle: { ...typography.titleLg, color: colors.brandNavy },
  heroSub: { ...typography.bodySm, color: colors.textMuted, marginTop: 6 },

  list: { padding: space.md, gap: space.sm, paddingBottom: space.xl * 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sessionAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandSubtle },
  sessionAvatarFallback: { alignItems: "center", justifyContent: "center" },
  sessionAvatarInitial: { color: colors.brandNavy, fontWeight: "800", fontSize: 18 },
  sessionPeer: { ...typography.subtitle, color: colors.text },
  sessionMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },

  content: { padding: space.md, gap: space.md, paddingBottom: space.xl * 2 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  backLabel: { ...typography.label, color: colors.brandNavy },

  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: space.sm,
  },
  cardLabel: { ...typography.overline, color: colors.textMuted },
  cardSession: { ...typography.subtitle, color: colors.text },
  cardPeer: { ...typography.bodySm, color: colors.textSecondary },

  label: { ...typography.label, color: colors.textSecondary },

  reasonRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.brandNavy, borderColor: colors.brandNavy },
  chipText: { ...typography.bodySm, color: colors.textSecondary, fontWeight: "600" },
  chipTextOn: { color: colors.brandTextOn },

  textarea: { minHeight: 130 },

  successWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.lg,
    backgroundColor: colors.surface,
    gap: space.sm,
  },
  successTitle: { ...typography.titleLg, color: colors.success },
  successBody: {
    ...typography.bodyMd,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: space.md,
  },
});
