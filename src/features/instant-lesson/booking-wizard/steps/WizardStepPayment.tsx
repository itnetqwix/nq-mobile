import { Ionicons } from "@expo/vector-icons";
import { useStripe } from "@stripe/stripe-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { apiClient } from "../../../../api/client";
import { API_ROUTES } from "../../../../config/apiRoutes";
import { colors, radii, space } from "../../../../theme";
import { useWalletPaymentOption } from "../../../wallet/hooks/useWalletPaymentOption";
import { verifyWalletPin } from "../../../wallet/walletApi";
import { INSTANT_LESSON_DURATIONS } from "../constants";
import { sharedStepStyles } from "../sharedStepStyles";

export type PaymentCompletePayload = {
  paymentIntentId: string | null;
  chargingPrice: number;
  paymentMethod?: "wallet" | "card";
  pinSessionToken?: string;
};

type Props = {
  trainer: Record<string, unknown> | null;
  durationMinutes: number;
  couponCode: string;
  userStripeId: string;
  onPaymentComplete: (payload: PaymentCompletePayload) => void;
  onNext: () => void;
  onAddFunds?: () => void;
};

export function WizardStepPayment({
  trainer,
  durationMinutes,
  couponCode,
  userStripeId,
  onPaymentComplete,
  onNext,
  onAddFunds,
}: Props) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(false);
  const [paymentReady, setPaymentReady] = useState(false);
  const [pin, setPin] = useState("");
  const [pinSessionToken, setPinSessionToken] = useState<string | undefined>();
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
  const wallet = useWalletPaymentOption(chargingPrice);
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

  useEffect(() => {
    if (wallet.storedPinToken && !pinSessionToken) {
      setPinSessionToken(wallet.storedPinToken);
    }
  }, [wallet.storedPinToken, pinSessionToken]);

  const handleWalletPay = useCallback(async () => {
    try {
      let token = pinSessionToken ?? wallet.storedPinToken ?? undefined;
      if (wallet.needsPin && !token) {
        if (!/^\d{6}$/.test(pin)) {
          Alert.alert("PIN required", "Enter your 6-digit wallet PIN for this payment.");
          return;
        }
        const res = await verifyWalletPin(pin);
        token = res.pinSessionToken;
        setPinSessionToken(token);
        setPin("");
      }
      onPaymentComplete({
        paymentIntentId: null,
        chargingPrice,
        paymentMethod: "wallet",
        pinSessionToken: token,
      });
      onNext();
    } catch (e: any) {
      Alert.alert("Wallet payment", e?.response?.data?.error ?? e?.message ?? "Could not verify PIN.");
    }
  }, [wallet.needsPin, pin, pinSessionToken, onPaymentComplete, onNext, chargingPrice]);

  const handlePay = useCallback(async () => {
    if (priceInfo?.skip) {
      onPaymentComplete({ paymentIntentId: null, chargingPrice: 0 });
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
    onPaymentComplete({
      paymentIntentId: intentId,
      chargingPrice,
      paymentMethod: "card",
    });
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

      {!loading && wallet.walletPayEnabled && !isFree && wallet.canPayWithWallet ? (
        <>
          {wallet.needsPin && !pinSessionToken ? (
            <TextInput
              style={styles.pinInput}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              placeholder="6-digit PIN"
              value={pin}
              onChangeText={setPin}
            />
          ) : null}
          <Pressable style={sharedStepStyles.primaryBtn} onPress={handleWalletPay}>
            <Ionicons name="wallet-outline" size={18} color={colors.brandTextOn} />
            <Text style={sharedStepStyles.primaryBtnText}>
              Pay ${chargingPrice.toFixed(2)} with wallet (${wallet.available.toFixed(2)} available)
            </Text>
          </Pressable>
          <Pressable
            style={[sharedStepStyles.primaryBtn, styles.cardBtn]}
            disabled={!paymentReady}
            onPress={handlePay}
          >
            <Ionicons name="card-outline" size={18} color={colors.brandNavy} />
            <Text style={[sharedStepStyles.primaryBtnText, { color: colors.brandNavy }]}>
              Pay with card
            </Text>
          </Pressable>
        </>
      ) : null}

      {!loading && wallet.walletPayEnabled && !isFree && !wallet.canPayWithWallet && wallet.shortfall > 0 ? (
        <View style={styles.shortfallBox}>
          <Text style={sharedStepStyles.muted}>
            Need ${wallet.shortfall.toFixed(2)} more in your wallet.
          </Text>
          {onAddFunds ? (
            <Pressable onPress={onAddFunds} style={styles.addFundsLink}>
              <Text style={styles.addFundsText}>Add funds</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {!loading && (
        <Pressable
          style={[
            sharedStepStyles.primaryBtn,
            (!paymentReady && !isFree && !(wallet.canPayWithWallet && wallet.walletPayEnabled)) &&
              sharedStepStyles.btnDisabled,
            wallet.canPayWithWallet && wallet.walletPayEnabled && !isFree && styles.cardBtn,
          ]}
          disabled={!paymentReady && !isFree && !(wallet.canPayWithWallet && wallet.walletPayEnabled)}
          onPress={handlePay}
        >
          <Ionicons
            name={isFree ? "checkmark-circle" : "card-outline"}
            size={18}
            color={wallet.canPayWithWallet && !isFree ? colors.brandNavy : colors.brandTextOn}
          />
          <Text
            style={[
              sharedStepStyles.primaryBtnText,
              wallet.canPayWithWallet && !isFree && { color: colors.brandNavy },
            ]}
          >
            {isFree
              ? "Continue (free)"
              : wallet.canPayWithWallet && wallet.walletPayEnabled
                ? "Pay with card"
                : `Pay $${chargingPrice.toFixed(2)}`}
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
  cardBtn: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pinInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: space.md,
    marginBottom: space.sm,
    backgroundColor: colors.surface,
  },
  shortfallBox: { marginBottom: space.sm, gap: 4 },
  addFundsLink: { alignSelf: "flex-start" },
  addFundsText: { color: colors.brandNavy, fontWeight: "600" },
});
