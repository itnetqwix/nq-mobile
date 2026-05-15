import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
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
import type { RootStackParamList } from "../../navigation/types";
import { colors, radii, space, typography } from "../../theme";

type Props = {
  visible: boolean;
  session: any | null;
  onClose: () => void;
};

export function SessionActionModal({ visible, session, onClose }: Props) {
  const { user, accountType } = useAuth();
  const { emitNotification } = useNotifications();
  const queryClient = useQueryClient();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [busy, setBusy] = useState<"confirm" | "decline" | null>(null);
  const [joinHint, setJoinHint] = useState("");

  const isTrainer = accountType === AccountType.TRAINER;
  const sessionId = String(session?._id ?? session?.id ?? "");
  const status = normalizeSessionStatus(session?.status);
  const pending = isPendingBooking(session);
  const instant = isInstantLesson(session);
  const other = getOtherParty(session, isTrainer);
  const otherName = other?.fullname || other?.fullName || (isTrainer ? "Trainee" : "Coach");
  const { dateLabel, timeLabel } = formatSessionWhen(session);
  const price =
    session?.charging_price != null
      ? `$${Number(session.charging_price).toFixed(2)}`
      : session?.amount != null
        ? `$${Number(session.amount).toFixed(2)}`
        : null;

  const joinEnabled = useMemo(
    () => (session ? canJoinSession(session) : false),
    [session]
  );

  useEffect(() => {
    if (!session) return;
    const tick = () => {
      if (canJoinSession(session)) setJoinHint("");
      else if (pending) setJoinHint("Confirm this session before joining.");
      else if (instant) setJoinHint("Instant lessons can be joined within 1 hour of booking.");
      else setJoinHint("Join opens 15 minutes before the scheduled start time.");
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [session, pending, instant]);

  const invalidateSessions = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["sessions"] });
    await queryClient.invalidateQueries({ queryKey: ["onlineUsers"] });
  }, [queryClient]);

  const handleConfirm = useCallback(async () => {
    if (!sessionId) return;
    setBusy("confirm");
    try {
      await updateBookedSessionStatus(sessionId, "confirmed");
      const traineeId = String(session?.trainee_info?._id ?? "");
      if (traineeId) {
        emitNotification({
          title: NOTIFICATION_TITLES.sessionConfirmation,
          description: "Your upcoming training session has been confirmed.",
          senderId: String(user?._id ?? ""),
          receiverId: traineeId,
          type: NOTIFICATION_TYPES.TRANSCATIONAL,
          bookingInfo: session,
        });
      }
      await invalidateSessions();
      Alert.alert("Session confirmed", "The trainee has been notified.", [
        { text: "OK", onPress: onClose },
      ]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not confirm session.";
      Alert.alert("Confirm failed", msg);
    } finally {
      setBusy(null);
    }
  }, [sessionId, session, user, emitNotification, invalidateSessions]);

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
              const traineeId = String(session?.trainee_info?._id ?? "");
              if (traineeId) {
                emitNotification({
                  title: NOTIFICATION_TITLES.sessionCancellation,
                  description: "Your session request was declined by the coach.",
                  senderId: String(user?._id ?? ""),
                  receiverId: traineeId,
                  type: NOTIFICATION_TYPES.TRANSCATIONAL,
                  bookingInfo: session,
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
  }, [sessionId, session, user, emitNotification, invalidateSessions, onClose]);

  const handleJoin = useCallback(() => {
    if (!sessionId || !joinEnabled) return;
    onClose();
    navigation.navigate("Meeting", { lessonId: sessionId });
  }, [sessionId, joinEnabled, onClose, navigation]);

  if (!session) return null;

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

            {!joinEnabled && !!joinHint && !pending ? (
              <Text style={styles.hint}>{joinHint}</Text>
            ) : null}

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
