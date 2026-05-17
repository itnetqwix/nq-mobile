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
import { updateBookedSessionStatus } from "../home/api/homeApi";
import { getS3ImageUrl } from "../../lib/imageUtils";
import {
  canJoinSession,
  formatSessionWhen,
  getJoinDisabledReason,
  getOtherParty,
  isInstantLesson,
  isPendingBooking,
  normalizeSessionStatus,
} from "../../lib/sessions/sessionUtils";
import {
  NOTIFICATION_TITLES,
  NOTIFICATION_TYPES,
  useNotifications,
} from "../notifications/NotificationContext";
import { navigationRef } from "../../navigation/navigationRef";
import { colors, radii, space, typography } from "../../theme";

type Props = {
  visible: boolean;
  session: any | null;
  onClose: () => void;
  onSessionUpdated?: (session: any) => void;
};

export function SessionActionModal({ visible, session, onClose, onSessionUpdated }: Props) {
  const { user, accountType } = useAuth();
  const { emitNotification } = useNotifications();
  const queryClient = useQueryClient();

  const [busy, setBusy] = useState<"confirm" | "decline" | null>(null);
  const [localSession, setLocalSession] = useState<any | null>(null);

  useEffect(() => {
    setLocalSession(session);
  }, [session]);

  const viewSession = localSession ?? session;

  const isTrainer = accountType === AccountType.TRAINER;
  const sessionId = String(viewSession?._id ?? viewSession?.id ?? "");
  const status = normalizeSessionStatus(viewSession?.status);
  const pending = isPendingBooking(viewSession);
  const instant = isInstantLesson(viewSession);
  const other = getOtherParty(viewSession, isTrainer);
  const otherName = other?.fullname || other?.fullName || (isTrainer ? "Trainee" : "Coach");
  const { dateLabel, timeLabel } = formatSessionWhen(viewSession);
  const price =
    viewSession?.charging_price != null
      ? `$${Number(viewSession.charging_price).toFixed(2)}`
      : viewSession?.amount != null
        ? `$${Number(viewSession.amount).toFixed(2)}`
        : null;

  const [joinHint, setJoinHint] = useState("");

  const joinEnabled = useMemo(
    () => (viewSession ? canJoinSession(viewSession) : false),
    [viewSession]
  );

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

  const invalidateSessions = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["sessions"] });
    await queryClient.invalidateQueries({ queryKey: ["onlineUsers"] });
  }, [queryClient]);

  const handleConfirm = useCallback(async () => {
    if (!sessionId) return;
    setBusy("confirm");
    try {
      await updateBookedSessionStatus(sessionId, "confirmed");
      const confirmed = { ...viewSession, status: "confirmed" };
      setLocalSession(confirmed);
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
      await invalidateSessions();
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
  }, [sessionId, viewSession, user, emitNotification, invalidateSessions, onSessionUpdated]);

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
              await invalidateSessions();
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
  }, [sessionId, viewSession, user, emitNotification, invalidateSessions, onClose]);

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
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
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
              {!!price && <DetailRow icon="card-outline" label="Price" value={price} />}
              <DetailRow
                icon={instant ? "flash-outline" : "bookmark-outline"}
                label="Type"
                value={instant ? "Instant lesson" : "Scheduled session"}
              />
            </View>

            {instant && pending && isTrainer ? (
              <Text style={styles.hint}>
                Instant requests are also handled in the incoming lesson popup. You can confirm here
                or use Accept on the instant lesson card.
              </Text>
            ) : null}

            {pending && isTrainer ? (
              <Text style={styles.hint}>
                Review the details below, then tap Confirm session. Join becomes available after
                confirmation, starting 15 minutes before the scheduled time.
              </Text>
            ) : null}

            {!joinEnabled && !!joinHint ? <Text style={styles.hint}>{joinHint}</Text> : null}

            <View style={styles.actions}>
              {isTrainer && pending && !instant ? (
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

              {isTrainer && pending && instant ? (
                <Button
                  label={busy === "confirm" ? "Confirming…" : "Confirm instant lesson"}
                  leftIcon="checkmark-circle-outline"
                  onPress={handleConfirm}
                  disabled={!!busy}
                  loading={busy === "confirm"}
                />
              ) : null}

              {!pending && (
                <Button
                  label="Join session"
                  leftIcon="videocam-outline"
                  onPress={handleJoin}
                  disabled={!joinEnabled}
                />
              )}

              {pending && !isTrainer ? (
                <View style={styles.waitingBox}>
                  <ActivityIndicator color={colors.brandNavy} />
                  <Text style={styles.waitingText}>
                    Waiting for your coach to confirm this session…
                  </Text>
                </View>
              ) : null}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
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
});
