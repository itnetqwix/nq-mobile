import { Ionicons } from "@expo/vector-icons";
import { useStripe } from "@stripe/stripe-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { apiClient } from "../../../../api/client";
import { API_ROUTES } from "../../../../config/apiRoutes";
import { colors, radii, space } from "../../../../theme";
import { INSTANT_LESSON_DURATIONS } from "../constants";
import { sharedStepStyles } from "../sharedStepStyles";

type Props = {
  trainer: Record<string, unknown> | null;
  durationMinutes: number;
  couponCode: string;
  userStripeId: string;
  onPaymentComplete: (paymentIntentId: string | null, chargingPrice: number) => void;
  onNext: () => void;
};

export function WizardStepPayment({
  trainer,
  durationMinutes,
  couponCode,
  userStripeId,
  onPaymentComplete,
  onNext,
}: Props) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(false);
  const [paymentReady, setPaymentReady] = useState(false);
  const [priceInfo, setPriceInfo] = useState<{
    amount: number;
    skip: boolean;
    clientSecret?: string;
  } | null>(null);

  const hourlyRate = Number(
    (trainer as any)?.extraInfo?.hourly_rate ??
      (trainer as any)?.userInfo?.extraInfo?.hourly_rate ??
      0
  );
  const trainerStripeId = String(
    (trainer as any)?.stripe_account_id ??
      (trainer as any)?.userInfo?.stripe_account_id ??
      ""
  );
  const commission = String(
    (trainer as any)?.commission ??
      (trainer as any)?.userInfo?.commission ??
      "0"
  );

  const chargingPrice = Number(((hourlyRate / 60) * durationMinutes).toFixed(2));
  const lengthLabel =
    INSTANT_LESSON_DURATIONS.find((d) => d.minutes === durationMinutes)?.label ??
    `${durationMinutes} min`;

  const createIntent = useCallback(async () => {
    if (chargingPrice <= 0) {
      setPriceInfo({ amount: 0, skip: true });
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.post(API_ROUTES.transaction.createPaymentIntent, {
        amount: chargingPrice,
        destination: trainerStripeId,
        commission,
        customer: userStripeId,
        couponCode: couponCode.trim().toLowerCase() || undefined,
      });
      const data = (res as any)?.data ?? res;
      if (data?.skip) {
        setPriceInfo({ amount: 0, skip: true });
        return;
      }
      const clientSecret = data?.client_secret;
      if (!clientSecret) throw new Error("No client secret returned.");
      setPriceInfo({ amount: chargingPrice, skip: false, clientSecret });

      const { error } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: "NetQwix",
      });
      if (error) {
        Alert.alert("Payment setup error", error.message);
        return;
      }
      setPaymentReady(true);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ?? e?.response?.data?.error ?? e?.message ?? "Could not set up payment.";
      Alert.alert("Payment error", msg);
    } finally {
      setLoading(false);
    }
  }, [
    chargingPrice,
    trainerStripeId,
    commission,
    userStripeId,
    couponCode,
    initPaymentSheet,
  ]);

  useEffect(() => {
    createIntent();
  }, [createIntent]);

  const handlePay = useCallback(async () => {
    if (priceInfo?.skip) {
      onPaymentComplete(null, 0);
      onNext();
      return;
    }
    const { error } = await presentPaymentSheet();
    if (error) {
      if (error.code !== "Canceled") {
        Alert.alert("Payment failed", error.message);
      }
      return;
    }
    const intentId = priceInfo?.clientSecret?.split("_secret_")[0] ?? null;
    onPaymentComplete(intentId, chargingPrice);
    onNext();
  }, [priceInfo, presentPaymentSheet, onPaymentComplete, onNext, chargingPrice]);

  const isFree = priceInfo?.skip === true;

  return (
    <View style={sharedStepStyles.card}>
      <Text style={sharedStepStyles.sectionTitle}>Payment</Text>

      <View style={styles.summaryBox}>
        <View style={styles.summaryLine}>
          <Text style={styles.summaryKey}>Duration</Text>
          <Text style={styles.summaryValue}>{lengthLabel}</Text>
        </View>
        <View style={styles.summaryLine}>
          <Text style={styles.summaryKey}>Hourly rate</Text>
          <Text style={styles.summaryValue}>
            {hourlyRate > 0 ? `$${hourlyRate}/hr` : "Free"}
          </Text>
        </View>
        <View style={styles.summaryLine}>
          <Text style={styles.summaryKey}>Total</Text>
          <Text style={[styles.summaryValue, styles.bold]}>
            {isFree ? "Free" : `$${chargingPrice.toFixed(2)}`}
          </Text>
        </View>
        {couponCode.trim() ? (
          <View style={styles.summaryLine}>
            <Text style={styles.summaryKey}>Promo</Text>
            <Text style={[styles.summaryValue, styles.promoApplied]}>
              {couponCode.trim()}
              {isFree ? " (100% off)" : ""}
            </Text>
          </View>
        ) : null}
      </View>

      {loading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.brandNavy} />
          <Text style={sharedStepStyles.muted}>Setting up payment...</Text>
        </View>
      )}

      {!loading && (
        <Pressable
          style={[
            sharedStepStyles.primaryBtn,
            (!paymentReady && !isFree) && sharedStepStyles.btnDisabled,
          ]}
          disabled={!paymentReady && !isFree}
          onPress={handlePay}
        >
          <Ionicons
            name={isFree ? "checkmark-circle" : "card-outline"}
            size={18}
            color={colors.brandTextOn}
          />
          <Text style={sharedStepStyles.primaryBtnText}>
            {isFree ? "Continue (free)" : `Pay $${chargingPrice.toFixed(2)}`}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  summaryBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: space.md,
    gap: 8,
  },
  summaryLine: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  summaryKey: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.brandNavy,
    width: 100,
  },
  summaryValue: { flex: 1, fontSize: 15, color: colors.text },
  bold: { fontWeight: "700" },
  promoApplied: { color: colors.success },
  loadingBox: {
    alignItems: "center",
    gap: 8,
    paddingVertical: space.md,
  },
});
