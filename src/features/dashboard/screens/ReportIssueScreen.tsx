import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import React, { useEffect, useMemo, useState } from "react";
import type { MenuStackParamList } from "../../../navigation/types";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AccountType } from "../../../constants/accountType";
import {
  Button,
  EmptyState,
  FormField,
  ImageWithSkeleton,
  KeyboardAwareScrollScreen,
  MorphRefreshScrollSurface,
  Pill,
  ScreenLoadingState,
  Skeleton,
  SkeletonGroup,
} from "../../../components/ui";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { useHapticRefresh } from "../../../lib/refresh/useHapticRefresh";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { type AppColors, radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { useAuth } from "../../auth/context/AuthContext";
import {
  fetchScheduledMeetings,
  postRaiseConcern,
  fetchMyRaiseConcerns,
  type RaiseConcernReason,
} from "../../home/api/homeApi";
import { SessionTimelineCard } from "../../support/SessionTimelineCard";

const REASONS: RaiseConcernReason[] = ["Technical issue", "Request for Refund"];

type ScreenMode = "list" | "form" | "success" | "tracker";

function useReportIssueStyles() {
  return useThemedStyles((palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.surface },
  hero: {
    padding: space.md,
    paddingBottom: space.sm,
    backgroundColor: palette.surfaceElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroTitle: { ...typography.titleLg, color: palette.brandNavy },
  heroSub: { ...typography.bodySm, color: palette.textMuted, marginTop: 6 },

  trackerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    backgroundColor: palette.surfaceElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  trackerBtnText: { ...typography.bodySm, color: palette.brandNavy, fontWeight: "600" },
  trackerBadge: {
    backgroundColor: palette.brandNavy,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  trackerBadgeText: { fontSize: 11, color: palette.brandTextOn, fontWeight: "700" },

  list: { padding: space.md, gap: space.sm, paddingBottom: space.xl * 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.md,
    backgroundColor: palette.surfaceElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
  },
  sessionAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: palette.brandSubtle },
  sessionAvatarFallback: { alignItems: "center", justifyContent: "center" },
  sessionAvatarInitial: { color: palette.brandNavy, fontWeight: "800", fontSize: 18 },
  sessionPeer: { ...typography.subtitle, color: palette.text },
  sessionCategory: { ...typography.caption, color: palette.brandNavy, fontWeight: "600", marginTop: 1 },
  sessionMeta: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
  sessionRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },

  formContent: { padding: space.md, gap: space.md, paddingBottom: space.xl * 2 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  backLabel: { ...typography.label, color: palette.brandNavy },

  card: {
    backgroundColor: palette.surfaceElevated,
    borderRadius: radii.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: palette.border,
    gap: space.sm,
  },
  cardLabel: { ...typography.overline, color: palette.textMuted },
  cardSession: { ...typography.subtitle, color: palette.text },
  cardPeer: { ...typography.bodySm, color: palette.textSecondary },

  label: { ...typography.label, color: palette.textSecondary },

  reasonRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  reasonChipOn: { backgroundColor: palette.brandNavy, borderColor: palette.brandNavy },
  reasonChipText: { ...typography.bodySm, color: palette.textSecondary, fontWeight: "600" },
  reasonChipTextOn: { color: palette.brandTextOn },

  textarea: { minHeight: 130 },

  successWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.lg,
    backgroundColor: palette.surface,
    gap: space.sm,
  },
  successTitle: { ...typography.titleLg, color: palette.success },
  successBody: {
    ...typography.bodyMd,
    color: palette.textSecondary,
    textAlign: "center",
    marginBottom: space.md,
  },

  reportCard: {
    backgroundColor: palette.surfaceElevated,
    borderRadius: radii.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 8,
  },
  reportHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  reportStatusDot: { width: 8, height: 8, borderRadius: 4 },
  reportSubject: { ...typography.subtitle, color: palette.text, flex: 1 },
  reportReason: { ...typography.caption, color: palette.brandNavy, fontWeight: "600" },
  reportDesc: { ...typography.bodySm, color: palette.textMuted },
  reportFooter: { flexDirection: "row", gap: 16, marginTop: 2 },
  reportMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  reportMetaText: { ...typography.caption, color: palette.textMuted },

  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
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
  progressCircleDone: { backgroundColor: palette.success },
  progressCirclePending: { backgroundColor: palette.surfaceMuted, borderWidth: 1.5, borderColor: palette.border },
  progressInnerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.textMuted },
  progressLine: { flex: 1, height: 2, backgroundColor: palette.border, marginHorizontal: 4 },
  progressLineDone: { backgroundColor: palette.success },
  progressLabel: { ...typography.caption, color: palette.textMuted, fontSize: 9 },
}));
}

export function ReportIssueScreen() {
  const c = useThemeColors();
  const styles = useReportIssueStyles();

  const route = useRoute<RouteProp<MenuStackParamList, "ReportIssue">>();
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

  useEffect(() => {
    const params = route.params;
    if (!params?.bookingId && !params?.prefillSubject && !params?.prefillDescription) return;
    if (params.prefillSubject) setSubject(params.prefillSubject);
    if (params.prefillDescription) setDescription(params.prefillDescription);
    if (params.bookingId) {
      setRefundLinked("Yes");
      setMode("form");
    }
  }, [route.params]);

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
  const { refreshing: reportsRefreshing, onRefresh: onRefreshReports } = useHapticRefresh(() =>
    refetchReports()
  );

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
        <Ionicons name="checkmark-circle" size={64} color={c.success} />
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
              <Ionicons name="chevron-back" size={22} color={c.iconPrimary} />
            </Pressable>
            <Text style={styles.heroTitle}>Reports</Text>
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
              <RefreshControl
                refreshing={reportsRefreshing}
                onRefresh={onRefreshReports}
                tintColor={c.iconPrimary}
              />
            }
          >
            {pastReports.length === 0 ? (
              <EmptyState
                icon="document-text-outline"
                title="No reports yet"
                description="Reports you submit will appear here with their status."
              />
            ) : (
              pastReports.map((r: any, index: number) => (
                <ReportTrackerCard key={`report-${String(r._id ?? "row")}-${index}`} report={r} />
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
      <KeyboardAwareScrollScreen
        style={{ flex: 1, backgroundColor: c.surface }}
        contentContainerStyle={styles.formContent}
        footer={
          <Button
            label="Submit report"
            onPress={submit}
            disabled={submitting}
            loading={submitting}
            size="lg"
          />
        }
      >
          <Pressable style={styles.backRow} onPress={() => { setMode("list"); setSelected(null); }} hitSlop={10}>
            <Ionicons name="chevron-back" size={20} color={c.iconPrimary} />
            <Text style={styles.backLabel}>Choose a different session</Text>
          </Pressable>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Reporting about</Text>
            <Text style={styles.cardSession}>{sessionLabel}</Text>
            <Text style={styles.cardPeer}>with {peerName}</Text>
          </View>

          <SessionTimelineCard bookingId={String(selected._id)} />

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

          </View>
      </KeyboardAwareScrollScreen>
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
        <Ionicons name="document-text-outline" size={18} color={c.iconPrimary} />
        <Text style={styles.trackerBtnText}>View my past reports</Text>
        <View style={{ flex: 1 }} />
        {pastReports.length > 0 && (
          <View style={styles.trackerBadge}>
            <Text style={styles.trackerBadgeText}>{pastReports.length}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
      </Pressable>

      {loadingList ? (
        <ScreenLoadingState
          variant="skeleton"
          skeleton={
            <SkeletonGroup
              count={4}
              gap={space.sm}
              style={{ padding: space.md }}
              renderRow={() => <Skeleton width="100%" height={72} radius={radii.md} />}
            />
          }
        />
      ) : (
        <MorphRefreshScrollSurface
          onRefresh={onRefreshSessions}
          externalRefreshing={refreshingList}
          tintColor={c.iconPrimary}
        >
          {({ refreshControl, onScroll, scrollEventThrottle }) => (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={refreshControl}
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
        >
          {sessions.length === 0 ? (
            <EmptyState
              icon="calendar-outline"
              title="No sessions found"
              description="Once you've booked or completed a session, you can report issues on it here."
            />
          ) : (
            sessions.map((s: any, index: number) => (
              <SessionCard
                key={`issue-session-${String(s._id ?? "row")}-${index}`}
                session={s}
                isTrainer={accountType === AccountType.TRAINER}
                onPress={() => { setSelected(s); setMode("form"); }}
              />
            ))
          )}
        </ScrollView>
          )}
        </MorphRefreshScrollSurface>
      )}
    </View>
  );
}

function getStatusConfig(status: string | undefined, c: AppColors) {
  switch (status?.toLowerCase()) {
    case "resolved":
    case "closed":
      return { label: "Resolved", tone: "success" as const, icon: "checkmark-circle" as const, color: c.success };
    case "in_progress":
    case "in progress":
    case "in-progress":
      return { label: "In Progress", tone: "warning" as const, icon: "time" as const, color: "#E5A100" };
    default:
      return { label: "Submitted", tone: "info" as const, icon: "document-text" as const, color: c.brandNavy };
  }
}

function ReportTrackerCard({ report }: { report: any }) {
  const c = useThemeColors();
  const styles = useReportIssueStyles();
  const cfg = getStatusConfig(report.ticket_status, c);
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
          <Ionicons name="calendar-outline" size={12} color={c.textMuted} />
          <Text style={styles.reportMetaText}>Filed {date}</Text>
        </View>
        {!!bookingDate && (
          <View style={styles.reportMeta}>
            <Ionicons name="videocam-outline" size={12} color={c.textMuted} />
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
  const c = useThemeColors();
  const styles = useReportIssueStyles();
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
              status === "completed" ? c.success
              : status === "confirmed" ? c.brandAccent
              : c.textMuted,
          }]} />
        )}
        <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
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


