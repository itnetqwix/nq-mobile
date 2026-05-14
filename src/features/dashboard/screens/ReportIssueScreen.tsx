import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  View,
} from "react-native";
import { AccountType } from "../../../constants/accountType";
import { Button, EmptyState, FormField, ImageWithSkeleton, Pill, Skeleton } from "../../../components/ui";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { colors, radii, space, typography } from "../../../theme";
import { useAuth } from "../../auth/context/AuthContext";
import {
  fetchScheduledMeetings,
  postRaiseConcern,
  fetchMyRaiseConcerns,
  type RaiseConcernReason,
} from "../../home/api/homeApi";

const REASONS: RaiseConcernReason[] = ["Technical issue", "Request for Refund"];

type ScreenMode = "list" | "form" | "success" | "tracker";

export function ReportIssueScreen() {
  const { user, accountType } = useAuth();
  const queryClient = useQueryClient();

  const presetName = (user?.fullname as string) ?? "";
  const presetEmail = (user?.email as string) ?? "";
  const presetPhone = (user?.mobile_no as string) ?? (user?.phone as string) ?? "";

  const [mode, setMode] = useState<ScreenMode>("list");
  const [selected, setSelected] = useState<any | null>(null);
  const [reason, setReason] = useState<RaiseConcernReason>("Technical issue");
  const [refundLinked, setRefundLinked] = useState<"Yes" | "No">("No");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  const { data: pastReports = [], isLoading: loadingReports, refetch: refetchReports } = useQuery({
    queryKey: ["myRaiseConcerns"],
    queryFn: fetchMyRaiseConcerns,
    staleTime: 60_000,
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
    confirmedQ.isRefetching || completedQ.isRefetching || upcomingQ.isRefetching;

  const onRefreshSessions = () => {
    void Promise.all([upcomingQ.refetch(), confirmedQ.refetch(), completedQ.refetch()]);
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
        is_releted_to_refund: reason === "Request for Refund" ? "Yes" : refundLinked,
        booking_id: String(selected._id),
      });
      setMode("success");
      setSubject("");
      setDescription("");
      setRefundLinked("No");
      queryClient.invalidateQueries({ queryKey: ["myRaiseConcerns"] });
    } catch (e) {
      Alert.alert("Could not submit", getApiErrorMessage(e, "Failed to submit the report."));
    } finally {
      setSubmitting(false);
    }
  };

  // Success screen
  if (mode === "success") {
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
          onPress={() => { setMode("list"); setSelected(null); }}
        />
        <Button
          label="View my reports"
          onPress={() => { setMode("tracker"); setSelected(null); }}
          variant="secondary"
          style={{ marginTop: space.sm }}
        />
      </View>
    );
  }

  // Report tracker screen
  if (mode === "tracker") {
    return (
      <View style={styles.root}>
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <Pressable onPress={() => setMode("list")} hitSlop={10}>
              <Ionicons name="chevron-back" size={22} color={colors.brandNavy} />
            </Pressable>
            <Text style={styles.heroTitle}>My Reports</Text>
          </View>
          <Text style={styles.heroSub}>Track the status of your submitted reports.</Text>
        </View>

        {loadingReports ? (
          <View style={styles.list}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} width="100%" height={80} radius={radii.md} />
            ))}
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={false} onRefresh={() => refetchReports()} tintColor={colors.brandNavy} />
            }
          >
            {pastReports.length === 0 ? (
              <EmptyState
                icon="document-text-outline"
                title="No reports yet"
                description="Reports you submit will appear here with their status."
              />
            ) : (
              pastReports.map((r: any) => (
                <ReportTrackerCard key={r._id} report={r} />
              ))
            )}
          </ScrollView>
        )}
      </View>
    );
  }

  // Form screen
  if (mode === "form" && selected) {
    const sessionLabel = formatSessionLabel(selected);
    const peer = accountType === AccountType.TRAINER ? selected.trainee_id : selected.trainer_id;
    const peerName = peer?.fullname ?? peer?.email ?? "Other party";

    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.surface }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          <Pressable style={styles.backRow} onPress={() => { setMode("list"); setSelected(null); }} hitSlop={10}>
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
                    style={[styles.reasonChip, on && styles.reasonChipOn]}
                  >
                    <Text style={[styles.reasonChipText, on && styles.reasonChipTextOn]}>{r}</Text>
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
                        style={[styles.reasonChip, on && styles.reasonChipOn]}
                      >
                        <Text style={[styles.reasonChipText, on && styles.reasonChipTextOn]}>{opt}</Text>
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

  // Session list screen (default)
  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Report an issue</Text>
        <Text style={styles.heroSub}>
          Choose the session you want to report on — we'll then ask
          for details and email our support team.
        </Text>
      </View>

      <Pressable style={styles.trackerBtn} onPress={() => setMode("tracker")}>
        <Ionicons name="document-text-outline" size={18} color={colors.brandNavy} />
        <Text style={styles.trackerBtnText}>View my past reports</Text>
        <View style={{ flex: 1 }} />
        {pastReports.length > 0 && (
          <View style={styles.trackerBadge}>
            <Text style={styles.trackerBadgeText}>{pastReports.length}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>

      {loadingList ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brandNavy} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshingList} onRefresh={onRefreshSessions} tintColor={colors.brandNavy} />
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
                onPress={() => { setSelected(s); setMode("form"); }}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

function getStatusConfig(status?: string) {
  switch (status?.toLowerCase()) {
    case "resolved":
    case "closed":
      return { label: "Resolved", tone: "success" as const, icon: "checkmark-circle" as const, color: colors.success };
    case "in_progress":
    case "in progress":
    case "in-progress":
      return { label: "In Progress", tone: "warning" as const, icon: "time" as const, color: "#E5A100" };
    default:
      return { label: "Submitted", tone: "info" as const, icon: "document-text" as const, color: colors.brandNavy };
  }
}

function ReportTrackerCard({ report }: { report: any }) {
  const cfg = getStatusConfig(report.ticket_status);
  const date = report.createdAt
    ? new Date(report.createdAt).toLocaleDateString(undefined, {
        month: "short", day: "numeric", year: "numeric",
      })
    : "";
  const bookingDate = report.booking_details?.booked_date
    ? new Date(report.booking_details.booked_date).toLocaleDateString(undefined, {
        month: "short", day: "numeric",
      })
    : "";

  return (
    <View style={styles.reportCard}>
      <View style={styles.reportHeader}>
        <View style={[styles.reportStatusDot, { backgroundColor: cfg.color }]} />
        <Text style={styles.reportSubject} numberOfLines={1}>
          {report.subject || "Report"}
        </Text>
        <Pill label={cfg.label} tone={cfg.tone} />
      </View>

      <Text style={styles.reportReason}>{report.reason}</Text>
      {!!report.description && (
        <Text style={styles.reportDesc} numberOfLines={2}>{report.description}</Text>
      )}

      <View style={styles.reportFooter}>
        <View style={styles.reportMeta}>
          <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
          <Text style={styles.reportMetaText}>Filed {date}</Text>
        </View>
        {!!bookingDate && (
          <View style={styles.reportMeta}>
            <Ionicons name="videocam-outline" size={12} color={colors.textMuted} />
            <Text style={styles.reportMetaText}>Session {bookingDate}</Text>
          </View>
        )}
      </View>

      {/* Status progress bar */}
      <View style={styles.progressRow}>
        <View style={[styles.progressStep, styles.progressStepDone]}>
          <View style={[styles.progressCircle, styles.progressCircleDone]}>
            <Ionicons name="checkmark" size={10} color="#fff" />
          </View>
          <Text style={styles.progressLabel}>Submitted</Text>
        </View>
        <View style={[styles.progressLine, cfg.label !== "Submitted" && styles.progressLineDone]} />
        <View style={[styles.progressStep, cfg.label !== "Submitted" && styles.progressStepDone]}>
          <View style={[
            styles.progressCircle,
            cfg.label !== "Submitted" ? styles.progressCircleDone : styles.progressCirclePending,
          ]}>
            {cfg.label !== "Submitted" ? (
              <Ionicons name="checkmark" size={10} color="#fff" />
            ) : (
              <View style={styles.progressInnerDot} />
            )}
          </View>
          <Text style={styles.progressLabel}>In Progress</Text>
        </View>
        <View style={[styles.progressLine, cfg.label === "Resolved" && styles.progressLineDone]} />
        <View style={[styles.progressStep, cfg.label === "Resolved" && styles.progressStepDone]}>
          <View style={[
            styles.progressCircle,
            cfg.label === "Resolved" ? styles.progressCircleDone : styles.progressCirclePending,
          ]}>
            {cfg.label === "Resolved" ? (
              <Ionicons name="checkmark" size={10} color="#fff" />
            ) : (
              <View style={styles.progressInnerDot} />
            )}
          </View>
          <Text style={styles.progressLabel}>Resolved</Text>
        </View>
      </View>
    </View>
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
  const peer = isTrainer
    ? session.trainee_info ?? session.trainee_id
    : session.trainer_info ?? session.trainer_id;
  const peerName = peer?.fullname ?? peer?.fullName ?? peer?.email ?? "—";
  const avatar = getS3ImageUrl(peer?.profile_picture);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatar]);

  const label = formatSessionLabel(session);
  const category = session?.category;
  const status = session?.status;

  return (
    <Pressable style={styles.sessionCard} onPress={onPress}>
      {avatar && !avatarFailed ? (
        <ImageWithSkeleton
          uri={avatar}
          width={48}
          height={48}
          borderRadius={24}
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
        {!!category && (
          <Text style={styles.sessionCategory} numberOfLines={1}>
            {category}
          </Text>
        )}
        <Text style={styles.sessionMeta} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={styles.sessionRight}>
        {!!status && (
          <View style={[styles.statusDot, {
            backgroundColor:
              status === "completed" ? colors.success
              : status === "confirmed" ? colors.brandAccent
              : colors.textMuted,
          }]} />
        )}
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

function formatSessionLabel(session: any): string {
  if (!session) return "Session";
  const d = session?.booked_date ? new Date(session.booked_date) : null;
  const datePart = d
    ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
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
  heroRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroTitle: { ...typography.titleLg, color: colors.brandNavy },
  heroSub: { ...typography.bodySm, color: colors.textMuted, marginTop: 6 },

  trackerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  trackerBtnText: { ...typography.bodySm, color: colors.brandNavy, fontWeight: "600" },
  trackerBadge: {
    backgroundColor: colors.brandNavy,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  trackerBadgeText: { fontSize: 11, color: colors.brandTextOn, fontWeight: "700" },

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
  sessionAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandSubtle },
  sessionAvatarFallback: { alignItems: "center", justifyContent: "center" },
  sessionAvatarInitial: { color: colors.brandNavy, fontWeight: "800", fontSize: 18 },
  sessionPeer: { ...typography.subtitle, color: colors.text },
  sessionCategory: { ...typography.caption, color: colors.brandNavy, fontWeight: "600", marginTop: 1 },
  sessionMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  sessionRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },

  formContent: { padding: space.md, gap: space.md, paddingBottom: space.xl * 2 },
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
  reasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  reasonChipOn: { backgroundColor: colors.brandNavy, borderColor: colors.brandNavy },
  reasonChipText: { ...typography.bodySm, color: colors.textSecondary, fontWeight: "600" },
  reasonChipTextOn: { color: colors.brandTextOn },

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

  reportCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  reportHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  reportStatusDot: { width: 8, height: 8, borderRadius: 4 },
  reportSubject: { ...typography.subtitle, color: colors.text, flex: 1 },
  reportReason: { ...typography.caption, color: colors.brandNavy, fontWeight: "600" },
  reportDesc: { ...typography.bodySm, color: colors.textMuted },
  reportFooter: { flexDirection: "row", gap: 16, marginTop: 2 },
  reportMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  reportMetaText: { ...typography.caption, color: colors.textMuted },

  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  progressStep: { alignItems: "center", gap: 4 },
  progressStepDone: {},
  progressCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  progressCircleDone: { backgroundColor: colors.success },
  progressCirclePending: { backgroundColor: colors.surfaceMuted, borderWidth: 1.5, borderColor: colors.border },
  progressInnerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted },
  progressLine: { flex: 1, height: 2, backgroundColor: colors.border, marginHorizontal: 4 },
  progressLineDone: { backgroundColor: colors.success },
  progressLabel: { ...typography.caption, color: colors.textMuted, fontSize: 9 },
});
