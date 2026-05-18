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
import { ImageWithSkeleton } from "../../../components/ui";
import { fetchSessionDetail } from "../../home/api/homeApi";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import {
  formatSessionWhen,
  getOtherParty,
  isInstantLesson,
} from "../../../lib/sessions/sessionUtils";
import { formatDualTimezoneLine } from "../../../lib/sessions/formatDualTimezone";
import { colors, radii, space, typography } from "../../../theme";

type Props = {
  visible: boolean;
  session: any;
  isTrainer: boolean;
  viewerTimezone?: string;
  onClose: () => void;
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
}: Props) {
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

            <Section title="Payment">
              <Row label="Amount" value={fmtMoney(merged.amount)} />
              {merged.coupon_code ? <Row label="Coupon" value={merged.coupon_code} /> : null}
              {merged.refund_status ? (
                <Row label="Refund status" value={String(merged.refund_status)} />
              ) : null}
              {merged.refund_reason_label || merged.refund_reason ? (
                <Row
                  label="Refund reason"
                  value={String(merged.refund_reason_label || merged.refund_reason)}
                />
              ) : null}
              {escrow ? (
                <Row label="Escrow" value={String(escrow.status ?? "—")} />
              ) : null}
            </Section>

            {merged.ratings ? (
              <Section title="Ratings">
                {merged.ratings.trainer_rating != null ? (
                  <Row label="Coach rating" value={`${merged.ratings.trainer_rating}/5`} />
                ) : null}
                {merged.ratings.trainee_rating != null ? (
                  <Row label="Trainee rating" value={`${merged.ratings.trainee_rating}/5`} />
                ) : null}
              </Section>
            ) : null}

            <Text style={styles.bookingId}>Booking ID: {sessionId}</Text>
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
  row: { flexDirection: "row", gap: 12 },
  rowKey: { width: 120, ...typography.bodyMd, fontWeight: "600", color: colors.iconPrimary },
  rowVal: { flex: 1, ...typography.bodyMd, color: colors.text },
  tzLine: { ...typography.caption, color: colors.textMuted },
  bookingId: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: space.lg,
    marginBottom: space.sm,
  },
});
