import { Ionicons } from "@expo/vector-icons";
import { useStripe } from "@stripe/stripe-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { colors, radii, space, typography } from "../../../theme";
import { useAuth } from "../../auth/context/AuthContext";
import {
  NOTIFICATION_TITLES,
  NOTIFICATION_TYPES,
  useNotifications,
} from "../../notifications/NotificationContext";

type Props = {
  visible: boolean;
  trainer: Record<string, unknown> | null;
  onDismiss: () => void;
};

type Slot = { start: string; end: string; day: string; date: string };

function formatAmPm(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

function getTrainerField(trainer: any, ...keys: string[]): any {
  for (const k of keys) {
    if (trainer?.[k] != null) return trainer[k];
    if (trainer?.userInfo?.[k] != null) return trainer.userInfo[k];
    if (trainer?.extraInfo?.[k] != null) return trainer.extraInfo[k];
    if (trainer?.userInfo?.extraInfo?.[k] != null)
      return trainer.userInfo.extraInfo[k];
  }
  return undefined;
}

export function ScheduledBookingModal({ visible, trainer, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { user } = useAuth();
  const { emitNotification } = useNotifications();

  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [step, setStep] = useState<"slots" | "review" | "paying">("slots");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);

  const trainerId = String(trainer?._id ?? trainer?.id ?? "");
  const trainerName = String(
    trainer?.fullname ?? trainer?.fullName ?? "Trainer"
  );
  const hourlyRate = Number(getTrainerField(trainer, "hourly_rate") ?? 0);
  const trainerStripeId = String(
    getTrainerField(trainer, "stripe_account_id") ?? ""
  );
  const commission = String(getTrainerField(trainer, "commission") ?? "0");
  const userStripeId = String(
    (user as Record<string, unknown>)?.stripe_account_id ?? ""
  );

  useEffect(() => {
    if (!visible) {
      setSelectedSlot(null);
      setStep("slots");
    }
  }, [visible]);

  const slotsQuery = useQuery({
    queryKey: ["trainerAvailability", trainerId],
    queryFn: async () => {
      const res = await apiClient.post(API_ROUTES.trainer.getAvailability, {
        trainer_id: trainerId,
      });
      const body = (res as any)?.data ?? res;
      const result = body?.result ?? body?.data ?? body;
      if (Array.isArray(result)) return result;
      if (result && Array.isArray(result.data)) return result.data;
      return [];
    },
    enabled: visible && !!trainerId,
    staleTime: 30_000,
  });

  const slotsByDay = useMemo(() => {
    const raw = slotsQuery.data ?? [];
    const map = new Map<string, Slot[]>();
    for (const entry of raw) {
      const slots: any[] = entry?.slots ?? [entry];
      for (const s of slots) {
        const day = s?.day ?? entry?.day ?? "";
        const date = s?.date ?? entry?.date ?? "";
        const start = s?.start ?? s?.session_start_time ?? "";
        const end = s?.end ?? s?.session_end_time ?? "";
        if (!start || !end) continue;
        const key = date || day;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({ start, end, day, date });
      }
    }
    return Array.from(map.entries()).map(([key, slots]) => ({
      key,
      label: key,
      slots,
    }));
  }, [slotsQuery.data]);

  const computePrice = useCallback(
    (slot: Slot) => {
      if (hourlyRate <= 0) return 0;
      const [sh, sm] = slot.start.split(":").map(Number);
      const [eh, em] = slot.end.split(":").map(Number);
      let mins = eh * 60 + em - (sh * 60 + sm);
      if (mins < 0) mins += 24 * 60;
      return Number(((hourlyRate / 60) * mins).toFixed(2));
    },
    [hourlyRate]
  );

  const handleSelectSlot = (slot: Slot) => {
    setSelectedSlot(slot);
    setStep("review");
  };

  const handlePayAndBook = useCallback(async () => {
    if (!selectedSlot) return;
    const price = computePrice(selectedSlot);

    if (price > 0) {
      setPaymentLoading(true);
      try {
        const res = await apiClient.post(
          API_ROUTES.transaction.createPaymentIntent,
          {
            amount: price,
            destination: trainerStripeId,
            commission,
            customer: userStripeId,
          }
        );
        const data = (res as any)?.data ?? res;
        if (!data?.skip) {
          const clientSecret = data?.client_secret;
          if (!clientSecret) throw new Error("No client secret returned.");
          const { error: initErr } = await initPaymentSheet({
            paymentIntentClientSecret: clientSecret,
            merchantDisplayName: "NetQwix",
          });
          if (initErr) {
            Alert.alert("Payment setup error", initErr.message);
            setPaymentLoading(false);
            return;
          }
          const { error: payErr } = await presentPaymentSheet();
          if (payErr) {
            if (payErr.code !== "Canceled") {
              Alert.alert("Payment failed", payErr.message);
            }
            setPaymentLoading(false);
            return;
          }
        }
      } catch (e: any) {
        Alert.alert(
          "Payment error",
          e?.response?.data?.message ?? e?.message ?? "Payment failed."
        );
        setPaymentLoading(false);
        return;
      }
      setPaymentLoading(false);
    }

    setBookingLoading(true);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await apiClient.post(API_ROUTES.trainee.bookSession, {
        trainer_id: trainerId,
        status: "confirm",
        booked_date: selectedSlot.date || new Date().toISOString(),
        session_start_time: selectedSlot.start,
        session_end_time: selectedSlot.end,
        charging_price: price,
        time_zone: tz,
      });

      const traineeName = String(
        (user as Record<string, unknown>)?.fullname ??
          (user as Record<string, unknown>)?.fullName ??
          "A trainee"
      );
      emitNotification({
        title: NOTIFICATION_TITLES.newBookingRequest,
        description: `${traineeName} has booked a scheduled session with you.`,
        receiverId: trainerId,
        type: NOTIFICATION_TYPES.TRANSCATIONAL,
      });

      Alert.alert("Session booked", "Your session has been scheduled.", [
        { text: "OK", onPress: onDismiss },
      ]);
    } catch (e: any) {
      Alert.alert(
        "Booking failed",
        e?.response?.data?.message ?? e?.message ?? "Could not book the session."
      );
    } finally {
      setBookingLoading(false);
    }
  }, [
    selectedSlot,
    computePrice,
    trainerStripeId,
    commission,
    userStripeId,
    initPaymentSheet,
    presentPaymentSheet,
    trainerId,
    user,
    emitNotification,
    onDismiss,
  ]);

  if (!trainer) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onDismiss}
    >
      <View
        style={[
          styles.shell,
          {
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              if (step === "review") setStep("slots");
              else onDismiss();
            }}
          >
            <Ionicons
              name={step === "review" ? "arrow-back" : "close"}
              size={24}
              color={colors.text}
            />
          </Pressable>
          <Text style={styles.headerTitle}>Schedule with {trainerName}</Text>
          <View style={{ width: 24 }} />
        </View>

        {step === "slots" && (
          <>
            {slotsQuery.isLoading && (
              <View style={styles.center}>
                <ActivityIndicator color={colors.brandNavy} />
                <Text style={styles.loadingText}>
                  Loading availability...
                </Text>
              </View>
            )}
            {!slotsQuery.isLoading && slotsByDay.length === 0 && (
              <View style={styles.center}>
                <Ionicons
                  name="calendar-outline"
                  size={48}
                  color={colors.textMuted}
                />
                <Text style={styles.emptyTitle}>No slots available</Text>
                <Text style={styles.emptyDesc}>
                  This trainer has no published availability slots right now.
                </Text>
              </View>
            )}
            {!slotsQuery.isLoading && slotsByDay.length > 0 && (
              <FlatList
                data={slotsByDay}
                keyExtractor={(item) => item.key}
                contentContainerStyle={styles.listContent}
                renderItem={({ item: dayGroup }) => (
                  <View style={styles.dayGroup}>
                    <Text style={styles.dayLabel}>{dayGroup.label}</Text>
                    <View style={styles.slotsGrid}>
                      {dayGroup.slots.map((slot, i) => (
                        <Pressable
                          key={`${slot.start}-${slot.end}-${i}`}
                          style={styles.slotTile}
                          onPress={() => handleSelectSlot(slot)}
                        >
                          <Text style={styles.slotTime}>
                            {formatAmPm(slot.start)} - {formatAmPm(slot.end)}
                          </Text>
                          {hourlyRate > 0 && (
                            <Text style={styles.slotPrice}>
                              ${computePrice(slot).toFixed(2)}
                            </Text>
                          )}
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
              />
            )}
          </>
        )}

        {step === "review" && selectedSlot && (
          <ScrollView contentContainerStyle={styles.reviewContent}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Review booking</Text>
              <View style={styles.row}>
                <Text style={styles.rowKey}>Coach</Text>
                <Text style={styles.rowVal}>{trainerName}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowKey}>Date</Text>
                <Text style={styles.rowVal}>
                  {selectedSlot.date || selectedSlot.day}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowKey}>Time</Text>
                <Text style={styles.rowVal}>
                  {formatAmPm(selectedSlot.start)} -{" "}
                  {formatAmPm(selectedSlot.end)}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowKey}>Price</Text>
                <Text style={[styles.rowVal, { fontWeight: "700" }]}>
                  {computePrice(selectedSlot) > 0
                    ? `$${computePrice(selectedSlot).toFixed(2)}`
                    : "Free"}
                </Text>
              </View>
            </View>

            <Pressable
              style={[
                styles.primaryBtn,
                (paymentLoading || bookingLoading) && styles.btnDisabled,
              ]}
              disabled={paymentLoading || bookingLoading}
              onPress={handlePayAndBook}
            >
              {paymentLoading || bookingLoading ? (
                <ActivityIndicator color={colors.brandTextOn} />
              ) : (
                <>
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color={colors.brandTextOn}
                  />
                  <Text style={styles.primaryBtnText}>
                    {computePrice(selectedSlot) > 0
                      ? `Pay & Book ($${computePrice(selectedSlot).toFixed(2)})`
                      : "Book Session"}
                  </Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.titleSm,
    color: colors.brandNavy,
    flex: 1,
    textAlign: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    padding: space.lg,
  },
  loadingText: { ...typography.bodyMd, color: colors.textMuted },
  emptyTitle: { ...typography.titleSm, color: colors.text },
  emptyDesc: {
    ...typography.bodyMd,
    color: colors.textMuted,
    textAlign: "center",
  },
  listContent: { padding: space.md, paddingBottom: space.xl },
  dayGroup: { marginBottom: space.lg },
  dayLabel: {
    ...typography.titleSm,
    color: colors.brandNavy,
    marginBottom: space.sm,
  },
  slotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  slotTile: {
    width: "47%",
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.brandNavy,
    backgroundColor: colors.background,
    alignItems: "center",
  },
  slotTime: { fontSize: 14, fontWeight: "600", color: colors.brandNavy },
  slotPrice: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    fontWeight: "500",
  },
  reviewContent: { padding: space.md, paddingBottom: space.xl },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  cardTitle: { ...typography.titleMd, color: colors.brandNavy },
  row: { flexDirection: "row", gap: 12 },
  rowKey: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.brandNavy,
    width: 80,
  },
  rowVal: { flex: 1, fontSize: 15, color: colors.text },
  primaryBtn: {
    marginTop: space.lg,
    backgroundColor: colors.brandNavy,
    borderRadius: radii.md,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: { ...typography.button, color: colors.brandTextOn },
  btnDisabled: { opacity: 0.65 },
});
