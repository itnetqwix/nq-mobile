import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, ImageWithSkeleton } from "../../../components/ui";
import { fetchSessionDetail } from "../../home/api/homeApi";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import {
  formatSessionWhen,
  getOtherParty,
  getSessionOutcomeI18nKey,
  isInstantLesson,
  normalizeSessionStatus,
} from "../../../lib/sessions/sessionUtils";
import { getRefundReasonI18nKey } from "../../../lib/sessions/refundReasonLabels";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { formatDualTimezoneLine } from "../../../lib/sessions/formatDualTimezone";
import { formatRefundTransferLabel } from "../../../lib/sessions/refundTransferLabel";
import {
  getViewerRatingSummary,
  hasViewerRated,
} from "../../../lib/sessions/sessionRatingUtils";
import { colors, radii, space, typography } from "../../../theme";

type Props = {
  visible: boolean;
  session: any;
  isTrainer: boolean;
  accountType?: string | null;
  viewerTimezone?: string;
  onClose: () => void;
  onReportIssue?: () => void;
  onRateSession?: () => void;
};

function fmtDate(v: string | Date | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function fmtMoney(amount: unknown) {
  if (amount == null || amount === "") return "—";
  const n = Number(amount);
  if (Number.isNaN(n)) return String(amount);
  return `$${n.toFixed(2)}`;
}

export function BookingDetailsModal({
  visible,
  session,
  isTrainer,
  viewerTimezone,
  onClose,
  onReportIssue,
  onRateSession,
}: Props) {
  const { t } = useAppTranslation();
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);

  const sessionId = String(session?._id ?? session?.id ?? "");

  useEffect(() => {
    if (!visible || !sessionId) return;
    let cancelled = false;
    setLoading(true);
    fetchSessionDetail(sessionId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, sessionId]);

  const merged = useMemo(() => {
    const s = detail?.session ?? {};
    return {
      ...session,
      ...s,
      trainer_info: detail?.trainer
        ? { ...session?.trainer_info, ...detail.trainer }
        : session?.trainer_info,
      trainee_info: detail?.trainee
        ? { ...session?.trainee_info, ...detail.trainee }
        : session?.trainee_info,
      _escrow: detail?.escrow ?? session?._escrow,
      _refund: detail?.refund ?? session?._refund,
    };
  }, [session, detail]);

  if (!session) return null;

  const other = getOtherParty(merged, isTrainer);
  const otherName = other?.fullname || other?.fullName || (isTrainer ? "Trainee" : "Coach");
  const avatar = getS3ImageUrl(other?.profile_picture);
  const { dateLabel, timeLabel } = formatSessionWhen(merged);
  const coachTz =
    merged.trainer_info?.extraInfo?.availabilityInfo?.timeZone ||
    merged.trainer_info?.time_zone ||
    merged.trainer_timezone;
  const dualTz = formatDualTimezoneLine(
    merged.start_time || merged.booked_date,
    coachTz,
    viewerTimezone
  );
  const instant = isInstantLesson(merged);
  const escrow = merged._escrow;
  const completed = normalizeSessionStatus(merged.status) === "completed";
  const outcomeKey = getSessionOutcomeI18nKey(merged);
  const outcomeLabel = outcomeKey ? t(outcomeKey as any) : null;
  const refundReasonRaw =
    merged._refund?.reason ?? merged.refund_reason ?? merged.refundReason ?? null;
  const refundReasonKey = getRefundReasonI18nKey(refundReasonRaw);
  const refundReasonLabel = refundReasonKey
    ? t(refundReasonKey as any)
    : merged._refund?.reason_label ?? merged.refund_reason_label ?? refundReasonRaw;
  const viewerRated = hasViewerRated(merged, isTrainer);
  const ratingSummary = getViewerRatingSummary(merged, isTrainer);
  const refundTransferLabel = formatRefundTransferLabel(merged._refund?.transfer);
  const extensions = Array.isArray(merged.extensions) ? merged.extensions : [];

  const ratings = merged.ratings;
  const trainerRating =
    ratings?.trainer?.sessionRating ?? ratings?.trainer_rating ?? null;
  const traineeRating =
    ratings?.trainee?.sessionRating ?? ratings?.trainee_rating ?? null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>{instant ? "Instant lesson" : "Session details"}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.brandNavy} style={{ marginVertical: space.md }} />
          ) : null}

          <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
            <View style={styles.partyRow}>
              {avatar ? (
                <ImageWithSkeleton uri={avatar} width={56} height={56} borderRadius={28} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={28} color={colors.textMuted} />
                </View>
              )}
              <View style={styles.partyText}>
                <Text style={styles.partyLabel}>{isTrainer ? "Trainee" : "Coach"}</Text>
                <Text style={styles.partyName}>{otherName}</Text>
                {other?.email ? (
                  <Text style={styles.partyEmail}>{other.email}</Text>
                ) : null}
              </View>
            </View>

            <Section title="Schedule">
              <Row label="Date" value={dateLabel} />
              <Row label="Time" value={timeLabel || "—"} />
              <Row label="Requested" value={fmtDate(merged.requested_at || merged.createdAt)} />
              {merged.duration_minutes ? (
                <Row label="Duration" value={`${merged.duration_minutes} min`} />
              ) : null}
              {dualTz ? <Text style={styles.tzLine}>{dualTz}</Text> : null}
            </Section>

            <Section title="Status">
              <Row label="Booking status" value={String(merged.status ?? "—")} />
              {merged.instant_phase ? (
                <Row
                  label="Instant phase"
                  value={String(merged.instant_phase).replace(/_/g, " ")}
                />
              ) : null}
              <Row label="Type" value={instant ? "Instant lesson" : "Scheduled"} />
            </Section>

            {outcomeLabel ? (
              <Section title={t("sessions.outcomeLabel")}>
                <Text style={styles.outcomeBody}>{outcomeLabel}</Text>
              </Section>
            ) : null}

            {(merged.accept_deadline_at ||
              merged.join_deadline_at ||
              merged.accepted_at ||
              merged.both_joined_at) && (
              <Section title="Instant timeline">
                {merged.accept_deadline_at ? (
                  <Row label="Accept by" value={fmtDate(merged.accept_deadline_at)} />
                ) : null}
                {merged.accepted_at ? (
                  <Row label="Accepted" value={fmtDate(merged.accepted_at)} />
                ) : null}
                {merged.join_deadline_at ? (
                  <Row label="Join by" value={fmtDate(merged.join_deadline_at)} />
                ) : null}
                {merged.both_joined_at ? (
                  <Row label="Both joined" value={fmtDate(merged.both_joined_at)} />
                ) : null}
              </Section>
            )}

            {extensions.length > 0 ? (
              <Section title="Extensions">
                {extensions.map((ext: any, idx: number) => (
                  <View key={`ext-${idx}`} style={styles.extensionRow}>
                    <Text style={styles.extensionTitle}>+{ext.minutes} min</Text>
                    <Text style={styles.extensionMeta}>
                      {fmtMoney(ext.amount)} · {String(ext.status ?? "—")} ·{" "}
                      {fmtDate(ext.applied_at || ext.requested_at)}
                    </Text>
                  </View>
                ))}
                {merged.total_extended_minutes ? (
                  <Text style={styles.extensionTotal}>
                    Total extended: {merged.total_extended_minutes} min
                  </Text>
                ) : null}
              </Section>
            ) : null}

            <Section title="Payment">
              <Row label="Session amount" value={fmtMoney(merged.amount)} />
              {escrow?.session_subtotal_minor != null && escrow.session_subtotal_minor > 0 ? (
                <Row
                  label="Session subtotal"
                  value={fmtMoney(escrow.session_subtotal_minor / 100)}
                />
              ) : null}
              {escrow?.trainee_platform_fee_minor ? (
                <Row
                  label="Platform fee"
                  value={fmtMoney(escrow.trainee_platform_fee_minor / 100)}
                />
              ) : null}
              {escrow?.processing_fee_minor ? (
                <Row
                  label="Processing fee"
                  value={fmtMoney(escrow.processing_fee_minor / 100)}
                />
              ) : null}
              {escrow?.tax_minor ? (
                <Row label="Tax" value={fmtMoney(escrow.tax_minor / 100)} />
              ) : null}
              {escrow?.charge_total_minor != null ? (
                <Row
                  label="Total charged"
                  value={fmtMoney(escrow.charge_total_minor / 100)}
                />
              ) : null}
              {merged.coupon_code ? <Row label="Coupon" value={merged.coupon_code} /> : null}
              {merged._refund?.status || merged.refund_status ? (
                <Row
                  label="Refund status"
                  value={String(merged._refund?.status ?? merged.refund_status)}
                />
              ) : null}
              {refundReasonLabel ? (
                <Row label="Refund reason" value={String(refundReasonLabel)} />
              ) : null}
              {refundTransferLabel ? (
                <Row label="Refund transfer" value={refundTransferLabel} />
              ) : null}
              {escrow ? <Row label="Escrow" value={String(escrow.status ?? "—")} /> : null}
            </Section>

            {ratings ? (
              <Section title="Ratings">
                {trainerRating != null ? (
                  <Row label="Coach rating" value={`${trainerRating}/5`} />
                ) : null}
                {traineeRating != null ? (
                  <Row label="Trainee rating" value={`${traineeRating}/5`} />
                ) : null}
                {ratingSummary ? <Row label="Your rating" value={ratingSummary} /> : null}
              </Section>
            ) : null}

            <Text style={styles.bookingId}>Booking ID: {sessionId}</Text>

            {completed ? (
              <View style={styles.footerActions}>
                {!viewerRated && onRateSession ? (
                  <Button label="Rate session" leftIcon="star-outline" onPress={onRateSession} />
                ) : null}
                {onReportIssue ? (
                  <Button
                    label="Report an issue"
                    variant="secondary"
                    leftIcon="flag-outline"
                    onPress={onReportIssue}
                  />
                ) : null}
              </View>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowKey}>{label}</Text>
      <Text style={styles.rowVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: space.lg,
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    padding: space.lg,
    maxHeight: "88%",
    maxWidth: 420,
    width: "100%",
    alignSelf: "center",
  },
  scroll: { maxHeight: 520 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: space.md,
  },
  title: { ...typography.titleSm, color: colors.text },
  partyRow: { flexDirection: "row", alignItems: "center", gap: space.md, marginBottom: space.md },
  partyText: { flex: 1 },
  partyLabel: { ...typography.caption, color: colors.textMuted },
  partyName: { ...typography.titleSm, color: colors.text },
  partyEmail: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  section: { marginTop: space.md, gap: 8 },
  sectionTitle: {
    ...typography.caption,
    color: colors.brandNavy,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  outcomeBody: { ...typography.bodyMd, color: colors.dangerText },
  row: { flexDirection: "row", gap: 12 },
  rowKey: { width: 120, ...typography.bodyMd, fontWeight: "600", color: colors.iconPrimary },
  rowVal: { flex: 1, ...typography.bodyMd, color: colors.text },
  tzLine: { ...typography.caption, color: colors.textMuted },
  extensionRow: { marginBottom: 6 },
  extensionTitle: { ...typography.bodyMd, fontWeight: "700", color: colors.text },
  extensionMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  extensionTotal: {
    ...typography.caption,
    color: colors.brandNavy,
    fontWeight: "600",
    marginTop: 4,
  },
  bookingId: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: space.lg,
  },
  footerActions: { gap: space.sm, marginTop: space.md, marginBottom: space.sm },
});
