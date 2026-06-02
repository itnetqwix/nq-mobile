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
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { idempotencyHeaders, newIdempotencyKey } from "../../../lib/idempotency";
import { queryKeys } from "../../../lib/queryKeys";
import { unwrapApiData } from "../../../lib/http/unwrapApiData";
import { colors, radii, space, typography } from "../../../theme";
import { useAuth } from "../../auth/context/AuthContext";
import {
  NOTIFICATION_TITLES,
  NOTIFICATION_TYPES,
  useNotifications,
} from "../../notifications/NotificationContext";
import { useWalletPaymentOption } from "../../wallet/hooks/useWalletPaymentOption";
import { verifyWalletPin } from "../../wallet/walletApi";

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
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState("");
  const [promoValidating, setPromoValidating] = useState(false);
  const [promoResult, setPromoResult] = useState<{
    valid: boolean;
    discount_amount?: number;
    final_amount?: number;
    display_label?: string;
  } | null>(null);
  const [visiblePromos, setVisiblePromos] = useState<any[]>([]);
  const [preferWallet, setPreferWallet] = useState(true);
  const [walletPin, setWalletPin] = useState("");
  const [pinSessionToken, setPinSessionToken] = useState<string | undefined>();

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
      setCouponCode("");
      setCouponError("");
      setPromoResult(null);
    } else {
      apiClient
        .get(API_ROUTES.promo.visible)
        .then((res: any) => setVisiblePromos(res?.data?.data || []))
        .catch(() => {});
    }
  }, [visible]);

  const slotsQuery = useQuery({
    queryKey: queryKeys.trainer.availability(trainerId),
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
      const st = entry?.start_time ? new Date(entry.start_time) : null;
      const et = entry?.end_time ? new Date(entry.end_time) : null;

      if (st && et && !isNaN(st.getTime()) && !isNaN(et.getTime())) {
        const dateKey = st.toISOString().split("T")[0];
        const start = `${st.getHours()}:${String(st.getMinutes()).padStart(2, "0")}`;
        const end = `${et.getHours()}:${String(et.getMinutes()).padStart(2, "0")}`;
        const dayName = st.toLocaleDateString("en-US", { weekday: "long" });
        if (!map.has(dateKey)) map.set(dateKey, []);
        map.get(dateKey)!.push({ start, end, day: dayName, date: dateKey });
        continue;
      }

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

    const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    return sorted.map(([key, slots]) => {
      const d = new Date(key + "T00:00:00");
      const label = !isNaN(d.getTime())
        ? d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
        : key;
      return { key, label, slots };
    });
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
    setCouponCode("");
    setCouponError("");
    setPromoResult(null);
  };

  const handleApplyPromo = useCallback(async () => {
    if (!couponCode.trim()) {
      setCouponError("Please enter a promo code.");
      return;
    }
    if (!selectedSlot) return;
    setPromoValidating(true);
    setPromoResult(null);
    try {
      const price = computePrice(selectedSlot);
      const res = await apiClient.post(API_ROUTES.promo.validate, {
        code: couponCode.trim(),
        booking_type: "scheduled",
        amount: price,
      });
      const data = (res as any)?.data;
      if (data?.valid) {
        setPromoResult(data);
        setCouponError("");
      } else {
        setPromoResult(null);
        setCouponError(data?.reason || "Invalid promo code.");
      }
    } catch {
      setPromoResult(null);
      setCouponError("Failed to validate promo code.");
    } finally {
      setPromoValidating(false);
    }
  }, [couponCode, selectedSlot, computePrice]);

  const handleRemovePromo = useCallback(() => {
    setCouponCode("");
    setPromoResult(null);
    setCouponError("");
  }, []);

  const reviewPrice = useMemo(() => {
    if (!selectedSlot) return 0;
    const originalPrice = computePrice(selectedSlot);
    return promoResult?.final_amount != null ? promoResult.final_amount : originalPrice;
  }, [selectedSlot, promoResult, computePrice]);

  const walletPay = useWalletPaymentOption(reviewPrice, visible);

  const handlePayAndBook = useCallback(async () => {
    if (!selectedSlot) return;
    const originalPrice = computePrice(selectedSlot);
    const price = promoResult?.final_amount != null ? promoResult.final_amount : originalPrice;
    const useWallet =
      preferWallet && walletPay.walletPayEnabled && walletPay.canPayWithWallet;

    let walletToken = pinSessionToken;
    if (price > 0 && useWallet) {
      if (walletPay.needsPin && !walletToken) {
        if (!/^\d{6}$/.test(walletPin)) {
          Alert.alert("PIN required", "Enter your 6-digit wallet PIN.");
          return;
        }
        try {
          const res = await verifyWalletPin(walletPin);
          walletToken = res.pinSessionToken;
          setPinSessionToken(walletToken);
          setWalletPin("");
        } catch (e: any) {
          Alert.alert("PIN error", e?.response?.data?.error ?? e?.message);
          return;
        }
      }
    } else if (price > 0) {
      setPaymentLoading(true);
      try {
        const intentPayload: Record<string, unknown> = {
          amount: originalPrice,
          destination: trainerStripeId,
          commission,
          customer: userStripeId,
          _bookingType: "scheduled",
        };
        if (couponCode.trim()) intentPayload.couponCode = couponCode.trim().toLowerCase();
        const res = await apiClient.post(
          API_ROUTES.transaction.createPaymentIntent,
          intentPayload
        );
        const data = unwrapApiData<{ skip?: boolean; client_secret?: string }>(res);
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
          e?.response?.data?.message ?? e?.response?.data?.error ?? e?.message ?? "Payment failed."
        );
        setPaymentLoading(false);
        return;
      }
      setPaymentLoading(false);
    }

    setBookingLoading(true);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const bookedDateIso = selectedSlot.date || new Date().toISOString();
      try {
        const checkRes = await apiClient.post(API_ROUTES.trainee.checkSlot, {
          trainer_id: trainerId,
          booked_date: bookedDateIso,
          slotTime: { from: selectedSlot.start, to: selectedSlot.end },
          traineeTimeZone: tz,
        });
        const slotCheck = (checkRes.data as { data?: { isAvailable?: boolean; message?: string } })?.data;
        if (slotCheck && slotCheck.isAvailable === false) {
          Alert.alert(
            "Time unavailable",
            slotCheck.message ??
              "This slot conflicts with another booking. Please choose a different time."
          );
          setBookingLoading(false);
          return;
        }
      } catch {
        /* proceed — booking API still validates conflicts */
      }

      const bookPayload: Record<string, unknown> = {
        trainer_id: trainerId,
        status: "booked",
        booked_date: bookedDateIso,
        session_start_time: selectedSlot.start,
        session_end_time: selectedSlot.end,
        charging_price: originalPrice,
        time_zone: tz,
      };
      if (couponCode.trim()) bookPayload.coupon_code = couponCode.trim();
      if (useWallet && price > 0) {
        bookPayload.payment_method = "wallet";
        if (walletToken) bookPayload.pin_session_token = walletToken;
      }
      const { data: bookRes } = await apiClient.post(API_ROUTES.trainee.bookSession, bookPayload, {
        headers: idempotencyHeaders(newIdempotencyKey("book-session")),
      });
      const bookingInfo =
        (bookRes as { result?: unknown })?.result ?? bookRes ?? { trainer_id: trainerId };

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
        bookingInfo,
      });

      Alert.alert("Session booked", "Your session has been scheduled.", [
        { text: "OK", onPress: onDismiss },
      ]);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ??
        e?.response?.data?.error ??
        e?.message ??
        "Could not book the session.";
      const conflict =
        typeof msg === "string" &&
        /booking during this time|conflict|unavailable/i.test(msg);
      Alert.alert(conflict ? "Scheduling conflict" : "Booking failed", msg);
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
    couponCode,
    promoResult,
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
            paddingTop: insets.top + 4,
            paddingBottom: insets.bottom + 8,
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
              <View style={styles.inlineStatus}>
                <ActivityIndicator color={colors.brandNavy} />
                <Text style={styles.loadingText}>
                  Loading availability...
                </Text>
              </View>
            )}
            {!slotsQuery.isLoading && slotsByDay.length === 0 && (
              <View style={styles.inlineStatus}>
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

        {step === "review" && selectedSlot && (() => {
          const originalPrice = computePrice(selectedSlot);
          const finalPrice = promoResult?.final_amount != null ? promoResult.final_amount : originalPrice;
          return (
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
                {promoResult ? (
                  <>
                    <View style={styles.row}>
                      <Text style={styles.rowKey}>Original</Text>
                      <Text style={[styles.rowVal, { textDecorationLine: "line-through", color: colors.textMuted }]}>
                        ${originalPrice.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={[styles.rowKey, { color: colors.success }]}>Discount</Text>
                      <Text style={[styles.rowVal, { color: colors.success, fontWeight: "600" }]}>
                        -${(promoResult.discount_amount ?? 0).toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.rowKey}>Final</Text>
                      <Text style={[styles.rowVal, { fontWeight: "700" }]}>
                        ${finalPrice.toFixed(2)}
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.row}>
                    <Text style={styles.rowKey}>Price</Text>
                    <Text style={[styles.rowVal, { fontWeight: "700" }]}>
                      {originalPrice > 0 ? `$${originalPrice.toFixed(2)}` : "Free"}
                    </Text>
                  </View>
                )}
              </View>

              {/* Promo Code Input */}
              <View style={styles.promoSection}>
                <Text style={styles.promoLabel}>Promo Code (optional)</Text>
                <View style={styles.promoRow}>
                  <TextInput
                    value={couponCode}
                    onChangeText={(t) => {
                      setCouponCode(t);
                      if (couponError) setCouponError("");
                      if (promoResult) setPromoResult(null);
                    }}
                    editable={!promoResult}
                    placeholder="Enter promo code"
                    placeholderTextColor={colors.textMuted}
                    style={[
                      styles.promoInput,
                      couponError ? { borderColor: colors.danger } : null,
                      promoResult ? { borderColor: colors.success } : null,
                    ]}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={50}
                  />
                  {promoResult ? (
                    <Pressable style={styles.promoRemoveBtn} onPress={handleRemovePromo}>
                      <Text style={styles.promoRemoveBtnText}>Remove</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      style={[styles.promoApplyBtn, (!couponCode.trim() || promoValidating) && { opacity: 0.5 }]}
                      onPress={handleApplyPromo}
                      disabled={!couponCode.trim() || promoValidating}
                    >
                      {promoValidating ? (
                        <ActivityIndicator size="small" color={colors.brandTextOn} />
                      ) : (
                        <Text style={styles.promoApplyBtnText}>Apply</Text>
                      )}
                    </Pressable>
                  )}
                </View>
                {!!couponError && <Text style={styles.promoError}>{couponError}</Text>}

                {visiblePromos.length > 0 && !promoResult && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.availableTitle}>Available Promos</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {visiblePromos.map((p: any) => (
                        <Pressable
                          key={p.code}
                          style={[styles.promoChip, couponCode === p.code && { backgroundColor: "#e8e8ff" }]}
                          onPress={() => { setCouponCode(p.code); setCouponError(""); setPromoResult(null); }}
                        >
                          <Text style={styles.promoChipText}>
                            {p.code}{" "}
                            {p.discount_type === "percentage" ? `(${p.discount_value}% off)` : `($${p.discount_value} off)`}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {walletPay.walletPayEnabled && finalPrice > 0 && walletPay.canPayWithWallet ? (
                <>
                  {walletPay.needsPin && !pinSessionToken ? (
                    <TextInput
                      style={styles.promoInput}
                      keyboardType="number-pad"
                      secureTextEntry
                      maxLength={6}
                      placeholder="6-digit wallet PIN"
                      value={walletPin}
                      onChangeText={setWalletPin}
                    />
                  ) : null}
                  <Pressable
                    style={[styles.primaryBtn, preferWallet && styles.walletBtnActive]}
                    disabled={paymentLoading || bookingLoading}
                    onPress={() => {
                      setPreferWallet(true);
                      void handlePayAndBook();
                    }}
                  >
                    <Ionicons name="wallet-outline" size={18} color={colors.brandTextOn} />
                    <Text style={styles.primaryBtnText}>
                      Pay ${finalPrice.toFixed(2)} with wallet
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.primaryBtn, styles.cardPayBtn]}
                    disabled={paymentLoading || bookingLoading}
                    onPress={() => {
                      setPreferWallet(false);
                      void handlePayAndBook();
                    }}
                  >
                    <Ionicons name="card-outline" size={18} color={colors.brandNavy} />
                    <Text style={[styles.primaryBtnText, { color: colors.brandNavy }]}>
                      Pay with card
                    </Text>
                  </Pressable>
                </>
              ) : (
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
                      <Ionicons name="calendar-outline" size={18} color={colors.brandTextOn} />
                      <Text style={styles.primaryBtnText}>
                        {finalPrice > 0
                          ? `Pay & Book ($${finalPrice.toFixed(2)})`
                          : "Book Session"}
                      </Text>
                    </>
                  )}
                </Pressable>
              )}
            </ScrollView>
          );
        })()}
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
  inlineStatus: {
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
  },
  loadingText: { ...typography.bodyMd, color: colors.textMuted },
  emptyTitle: { ...typography.titleSm, color: colors.text },
  emptyDesc: {
    ...typography.bodyMd,
    color: colors.textMuted,
    textAlign: "center",
  },
  listContent: { padding: space.md, paddingBottom: space.lg, paddingTop: space.xs },
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
  reviewContent: { padding: space.md, paddingBottom: space.lg, gap: space.sm },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    padding: space.md,
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
  walletBtnActive: { marginTop: space.lg },
  cardPayBtn: {
    marginTop: space.sm,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  promoSection: { marginTop: space.md },
  promoLabel: { fontSize: 15, fontWeight: "600", color: colors.text, marginBottom: 8 },
  promoRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  promoInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.brandNavy,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  promoApplyBtn: {
    backgroundColor: colors.brandNavy,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radii.md,
    justifyContent: "center",
    alignItems: "center",
  },
  promoApplyBtnText: { color: colors.brandTextOn, fontWeight: "700", fontSize: 14 },
  promoRemoveBtn: {
    backgroundColor: colors.danger,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.md,
    justifyContent: "center",
    alignItems: "center",
  },
  promoRemoveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  promoError: { color: colors.danger, fontSize: 13, marginTop: 4 },
  availableTitle: { fontSize: 13, color: "#666", fontWeight: "600", marginBottom: 8 },
  promoChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.brandNavy,
    backgroundColor: "#f8f9fa",
  },
  promoChipText: { fontSize: 13, fontWeight: "600", color: colors.brandNavy },
});
