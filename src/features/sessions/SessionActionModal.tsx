import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Button, ImageWithSkeleton, Pill } from "../../components/ui";
import { AccountType } from "../../constants/accountType";
import { useAuth } from "../auth/context/AuthContext";
import { fetchSessionDetail, updateBookedSessionStatus } from "../home/api/homeApi";
import { invalidateSessions, patchSessionInQueryCaches } from "../../lib/queryInvalidation";
import { queryKeys } from "../../lib/queryKeys";
import { getS3ImageUrl } from "../../lib/imageUtils";
import {
  canEnterLesson,
  canJoinSession,
  formatSessionWhen,
  getJoinDisabledReason,
  getOtherParty,
  getSessionOutcomeI18nKey,
  isInstantLesson,
  isPendingBooking,
  isSessionTerminalForUI,
  normalizeSessionStatus,
} from "../../lib/sessions/sessionUtils";
import { useAppTranslation } from "../../i18n/useAppTranslation";
import { getRefundReasonI18nKey } from "../../lib/sessions/refundReasonLabels";
import {
  NOTIFICATION_TITLES,
  NOTIFICATION_TYPES,
  useNotifications,
} from "../notifications/NotificationContext";
import { navigationRef } from "../../navigation/navigationRef";
import { colors, radii, space, typography } from "../../theme";
import { BookingDetailsModal } from "./components/BookingDetailsModal";
import { RatingsModal } from "../calling/components/RatingsModal";
import { formatDualTimezoneLine } from "../../lib/sessions/formatDualTimezone";
import {
  getViewerRatingSummary,
  hasViewerRated,
} from "../../lib/sessions/sessionRatingUtils";
import { formatRefundTransferLabel } from "../../lib/sessions/refundTransferLabel";
import { InstantLessonSessionActions } from "../instant-lesson/components/InstantLessonSessionActions";

type Props = {
  visible: boolean;
  session: any | null;
  onClose: () => void;
  onSessionUpdated?: (session: any) => void;
};

export function SessionActionModal({ visible, session, onClose, onSessionUpdated }: Props) {
  const { t } = useAppTranslation();
  const { user, accountType } = useAuth();
  const { emitNotification } = useNotifications();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<"confirm" | "decline" | null>(null);
  const [localSession, setLocalSession] = useState<any | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [ratingsOpen, setRatingsOpen] = useState(false);

  useEffect(() => {
    setLocalSession(session);
  }, [session]);

  const viewSession = localSession ?? session;

  const isTrainer = accountType === AccountType.TRAINER;
  const sessionId = String(viewSession?._id ?? viewSession?.id ?? "");

  useEffect(() => {
    if (!visible || !sessionId) return;
    let cancelled = false;
    void fetchSessionDetail(sessionId)
      .then((data) => {
        if (cancelled || !data?.session) return;
        setLocalSession((prev: any) => ({
          ...(prev ?? session),
          ...data.session,
          trainer_info: data.trainer
            ? { ...(prev ?? session)?.trainer_info, ...data.trainer }
            : (prev ?? session)?.trainer_info,
          trainee_info: data.trainee
            ? { ...(prev ?? session)?.trainee_info, ...data.trainee }
            : (prev ?? session)?.trainee_info,
          _escrow: data.escrow,
          _refund: data.refund,
        }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible, sessionId, session]);
  const status = normalizeSessionStatus(viewSession?.status);
  const pending = isPendingBooking(viewSession);
  const completed = status === "completed";
  const terminal = viewSession ? isSessionTerminalForUI(viewSession) : false;
  const instant = isInstantLesson(viewSession);
  const outcomeKey = viewSession ? getSessionOutcomeI18nKey(viewSession) : null;
  const outcomeLabel = outcomeKey ? t(outcomeKey as any) : null;
  const refundReasonKey = getRefundReasonI18nKey(
    viewSession?._refund?.reason ?? viewSession?.refund_reason
  );
  const refundReasonLabel = refundReasonKey
    ? t(refundReasonKey as any)
    : viewSession?._refund?.reason_label ?? viewSession?.refund_reason_label ?? null;
  const viewerRated = hasViewerRated(viewSession, isTrainer);
  const ratingSummary = getViewerRatingSummary(viewSession, isTrainer);
  const refundTransferLabel = formatRefundTransferLabel(
    viewSession?._refund?.transfer ?? viewSession?.refund_transfer
  );
  const other = getOtherParty(viewSession, isTrainer);
  const otherName = other?.fullname || other?.fullName || (isTrainer ? "Trainee" : "Coach");
  const { dateLabel, timeLabel } = formatSessionWhen(viewSession);
  const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const coachTz =
    viewSession?.trainer_info?.extraInfo?.availabilityInfo?.timeZone ||
    viewSession?.trainer_info?.time_zone ||
    viewSession?.trainer_timezone;
  const dualTz = formatDualTimezoneLine(
    viewSession?.start_time || viewSession?.booked_date,
    coachTz,
    viewerTz
  );
  const requestedLabel = viewSession?.requested_at || viewSession?.createdAt
    ? new Date(viewSession.requested_at || viewSession.createdAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;
  const price =
    viewSession?.charging_price != null
      ? `$${Number(viewSession.charging_price).toFixed(2)}`
      : viewSession?.amount != null
        ? `$${Number(viewSession.amount).toFixed(2)}`
        : null;

  const [joinHint, setJoinHint] = useState("");

  const joinEnabled = useMemo(
    () => (viewSession && !completed && !terminal ? canEnterLesson(viewSession) : false),
    [viewSession, completed, terminal]
  );
  const isRejoin = useMemo(
    () =>
      viewSession && joinEnabled && !completed
        ? !canJoinSession(viewSession)
        : false,
    [viewSession, joinEnabled, completed]
  );

  const openReportIssue = useCallback(() => {
    onClose();
    if (!navigationRef.isReady()) return;
    navigationRef.navigate("Main", {
      screen: "Tabs",
      params: {
        screen: "Home",
        params: {
          screen: "ShellSurface",
          params: { surfaceId: "reportIssue", sessionId },
        },
      },
    } as never);
  }, [onClose, sessionId]);

  useEffect(() => {
    if (!viewSession) return;
    const tick = () => {
      if (canJoinSession(viewSession)) setJoinHint("");
      else setJoinHint(getJoinDisabledReason(viewSession));
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [viewSession]);

  const invalidateSessionsCache = useCallback(async () => {
    invalidateSessions(queryClient);
    await queryClient.invalidateQueries({ queryKey: queryKeys.presence.onlineUsers });
  }, [queryClient]);

  const handleConfirm = useCallback(async () => {
    if (!sessionId) return;
    setBusy("confirm");
    try {
      await updateBookedSessionStatus(sessionId, "confirmed");
      const confirmed = { ...viewSession, status: "confirmed" };
      setLocalSession(confirmed);
      patchSessionInQueryCaches(queryClient, sessionId, { status: "confirmed" });
      onSessionUpdated?.(confirmed);
      const traineeId = String(viewSession?.trainee_info?._id ?? "");
      if (traineeId) {
        emitNotification({
          title: NOTIFICATION_TITLES.sessionConfirmation,
          description: "Your upcoming training session has been confirmed.",
          senderId: String(user?._id ?? ""),
          receiverId: traineeId,
          type: NOTIFICATION_TYPES.TRANSCATIONAL,
          bookingInfo: viewSession,
        });
      }
      await invalidateSessionsCache();
      Alert.alert(
        "Session confirmed",
        "The trainee has been notified. Join opens 15 minutes before the scheduled start time.",
        [{ text: "OK" }]
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not confirm session.";
      Alert.alert("Confirm failed", msg);
    } finally {
      setBusy(null);
    }
  }, [sessionId, viewSession, user, emitNotification, invalidateSessionsCache, onSessionUpdated, queryClient]);

  const handleDecline = useCallback(() => {
    if (!sessionId) return;
    Alert.alert(
      "Decline session?",
      "The trainee will be notified that this booking was cancelled.",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: async () => {
            setBusy("decline");
            try {
              await updateBookedSessionStatus(sessionId, "canceled");
              const traineeId = String(viewSession?.trainee_info?._id ?? "");
              if (traineeId) {
                emitNotification({
                  title: NOTIFICATION_TITLES.sessionCancellation,
                  description: "Your session request was declined by the coach.",
                  senderId: String(user?._id ?? ""),
                  receiverId: traineeId,
                  type: NOTIFICATION_TYPES.TRANSCATIONAL,
                  bookingInfo: viewSession,
                });
              }
              await invalidateSessionsCache();
              onClose();
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : "Could not decline session.";
              Alert.alert("Decline failed", msg);
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  }, [sessionId, viewSession, user, emitNotification, invalidateSessionsCache, onClose]);

  const handleJoin = useCallback(() => {
    if (!sessionId || !joinEnabled) return;
    onClose();
    const go = () => {
      if (navigationRef.isReady()) {
        navigationRef.navigate("Meeting", { lessonId: sessionId });
      }
    };
    go();
    setTimeout(go, 400);
  }, [sessionId, joinEnabled, onClose]);

  if (!viewSession) return null;

  const avatarUrl = getS3ImageUrl(other?.profile_picture);
  const statusLabel = pending ? "Awaiting confirmation" : status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          accessibilityLabel="Close session details"
        />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.headerRow}>
              <View style={styles.headerIcon}>
                <Ionicons
                  name={instant ? "flash" : "calendar"}
                  size={22}
                  color={colors.brandNavy}
                />
              </View>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>
                  {pending && isTrainer
                    ? "New session request"
                    : instant
                      ? "Instant lesson"
                      : "Session details"}
                </Text>
                <Pill
                  label={statusLabel}
                  tone={pending ? "warning" : status === "confirmed" ? "success" : "info"}
                />
              </View>
              <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            {outcomeLabel ? (
              <View style={styles.outcomeBanner}>
                <Ionicons name="alert-circle-outline" size={20} color={colors.dangerText} />
                <View style={styles.outcomeBannerText}>
                  <Text style={styles.outcomeBannerTitle}>{t("sessions.outcomeLabel")}</Text>
                  <Text style={styles.outcomeBannerBody}>{outcomeLabel}</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.profileRow}>
              {avatarUrl ? (
                <ImageWithSkeleton
                  uri={avatarUrl}
                  width={72}
                  height={72}
                  borderRadius={36}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitial}>{otherName[0]?.toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.profileMeta}>
                <Text style={styles.name}>{otherName}</Text>
                <Text style={styles.role}>{isTrainer ? "Trainee" : "Coach"}</Text>
              </View>
            </View>

            <View style={styles.detailCard}>
              <DetailRow icon="calendar-outline" label="Date" value={dateLabel} />
              {!!timeLabel && <DetailRow icon="time-outline" label="Time" value={timeLabel} />}
              {requestedLabel ? (
                <DetailRow icon="time-outline" label="Requested" value={requestedLabel} />
              ) : null}
              {dualTz ? (
                <Text style={styles.dualTz}>{dualTz}</Text>
              ) : null}
              {!!price && <DetailRow icon="card-outline" label="Price" value={price} />}
              {viewSession?.refund_status || viewSession?._refund?.status ? (
                <DetailRow
                  icon="return-down-back-outline"
                  label="Refund status"
                  value={String(viewSession._refund?.status ?? viewSession.refund_status)}
                />
              ) : null}
              {refundReasonLabel ? (
                <DetailRow icon="information-circle-outline" label="Refund reason" value={refundReasonLabel} />
              ) : null}
              {viewSession?.instant_phase ? (
                <DetailRow
                  icon="pulse-outline"
                  label="Phase"
                  value={String(viewSession.instant_phase).replace(/_/g, " ")}
                />
              ) : null}
              {viewSession?._escrow?.status ? (
                <DetailRow icon="shield-outline" label="Escrow" value={String(viewSession._escrow.status)} />
              ) : null}
              {refundTransferLabel ? (
                <DetailRow icon="cash-outline" label="Refund" value={refundTransferLabel} />
              ) : null}
              {Array.isArray(viewSession?.extensions) && viewSession.extensions.length > 0 ? (
                <DetailRow
                  icon="add-circle-outline"
                  label="Extensions"
                  value={`${viewSession.extensions.length} · +${viewSession.total_extended_minutes ?? 0} min`}
                />
              ) : null}
              <DetailRow
                icon={instant ? "flash-outline" : "bookmark-outline"}
                label="Type"
                value={instant ? "Instant lesson" : "Scheduled session"}
              />
            </View>

            {pending && isTrainer && !terminal ? (
              <Text style={styles.hint}>
                Review the details below, then tap Confirm session. Join becomes available after
                confirmation, starting 15 minutes before the scheduled time.
              </Text>
            ) : null}

            {!terminal && !joinEnabled && !!joinHint ? (
              <Text style={styles.hint}>{joinHint}</Text>
            ) : null}

            <View style={styles.actions}>
              {terminal ? (
                <Button
                  label={t("sessions.viewBookingDetails")}
                  leftIcon="document-text-outline"
                  onPress={() => setDetailsOpen(true)}
                />
              ) : null}

              {isTrainer && pending && !instant && !terminal ? (
                <>
                  <Button
                    label={busy === "confirm" ? "Confirming…" : "Confirm session"}
                    leftIcon="checkmark-circle-outline"
                    onPress={handleConfirm}
                    disabled={!!busy}
                    loading={busy === "confirm"}
                  />
                  <Button
                    label="Decline"
                    variant="danger"
                    leftIcon="close-circle-outline"
                    onPress={handleDecline}
                    disabled={!!busy}
                    loading={busy === "decline"}
                  />
                </>
              ) : null}

              {isTrainer && pending && instant && !terminal ? (
                <InstantLessonSessionActions
                  session={viewSession}
                  layout="column"
                  size="md"
                  onActionComplete={async () => {
                    await invalidateSessionsCache();
                    onClose();
                  }}
                />
              ) : null}

              {!terminal && !pending && !completed && (
                <Button
                  label={isRejoin ? "Rejoin session" : "Join session"}
                  leftIcon="videocam-outline"
                  onPress={handleJoin}
                  disabled={!joinEnabled}
                />
              )}

              {completed && !terminal ? (
                <>
                  {ratingSummary ? (
                    <Text style={styles.hint}>Your rating: {ratingSummary}</Text>
                  ) : null}
                  {!viewerRated ? (
                    <Button
                      label="Rate session"
                      leftIcon="star-outline"
                      onPress={() => setRatingsOpen(true)}
                    />
                  ) : null}
                  <Button
                    label="Report an issue"
                    variant="secondary"
                    leftIcon="flag-outline"
                    onPress={openReportIssue}
                  />
                </>
              ) : null}

              {pending && !isTrainer && !terminal ? (
                <View style={styles.waitingBox}>
                  <ActivityIndicator color={colors.brandNavy} />
                  <Text style={styles.waitingText}>
                    Waiting for your coach to confirm this session…
                  </Text>
                </View>
              ) : null}

              {!terminal ? (
              <Pressable style={styles.detailsLink} onPress={() => setDetailsOpen(true)}>
                <Text style={styles.detailsLinkText}>View full booking details</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.brandNavy} />
              </Pressable>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
      <BookingDetailsModal
        visible={detailsOpen}
        session={viewSession}
        isTrainer={isTrainer}
        accountType={accountType}
        viewerTimezone={viewerTz}
        onClose={() => setDetailsOpen(false)}
        onReportIssue={openReportIssue}
        onRateSession={() => setRatingsOpen(true)}
      />
      <RatingsModal
        visible={ratingsOpen}
        bookingId={sessionId}
        accountType={accountType}
        isFromCall={false}
        onClose={() => {
          setRatingsOpen(false);
          void fetchSessionDetail(sessionId).then((data) => {
            if (data?.session) {
              setLocalSession((prev: any) => ({
                ...(prev ?? session),
                ...data.session,
                _refund: data.refund,
              }));
            }
          });
        }}
      />
    </Modal>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={18} color={colors.brandNavy} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: "92%",
    paddingBottom: space.xl,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: space.sm,
    marginBottom: space.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    paddingHorizontal: space.lg,
    marginBottom: space.md,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brandNavy + "14",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1, gap: 6 },
  outcomeBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    marginHorizontal: space.lg,
    marginBottom: space.md,
    padding: space.md,
    backgroundColor: colors.dangerSubtle,
    borderRadius: radii.md,
  },
  outcomeBannerText: { flex: 1 },
  outcomeBannerTitle: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.dangerText,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  outcomeBannerBody: { ...typography.bodyMd, color: colors.dangerText, marginTop: 2 },
  title: { ...typography.titleSm, color: colors.text },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    marginBottom: space.md,
  },
  avatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brandNavy,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { color: colors.brandTextOn, fontSize: 28, fontWeight: "700" },
  profileMeta: { flex: 1 },
  name: { ...typography.subtitle, color: colors.text, fontWeight: "700" },
  role: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  detailCard: {
    marginHorizontal: space.lg,
    padding: space.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: space.sm,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  detailLabel: { ...typography.caption, color: colors.textMuted, width: 48 },
  detailValue: { ...typography.bodySm, color: colors.text, flex: 1, fontWeight: "600" },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginHorizontal: space.lg,
    marginTop: space.md,
    lineHeight: 18,
  },
  actions: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    gap: space.sm,
  },
  waitingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  waitingText: { ...typography.bodySm, color: colors.textMuted, flex: 1 },
  dualTz: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  detailsLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: space.md,
    paddingVertical: space.sm,
  },
  detailsLinkText: { ...typography.bodySm, fontWeight: "600", color: colors.brandNavy },
});
