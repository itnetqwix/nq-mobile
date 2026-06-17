import { Ionicons } from "@expo/vector-icons";
import { useStripe } from "@stripe/stripe-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { unwrapApiData } from "../../../../lib/http/unwrapApiData";
import { getApiErrorMessage } from "../../../../lib/http/getApiErrorMessage";
import { radii, space, useStaticStyles, useThemeColors } from "../../../../theme";
import { useAuth } from "../../../auth/context/AuthContext";
import { fetchSessionPricingQuote } from "../../../payments/fetchSessionPricingQuote";
import { resolveTraineeBillingAddress } from "../../../payments/resolveTraineeBillingAddress";
import { useWalletPaymentOption } from "../../../wallet/hooks/useWalletPaymentOption";
import { verifyWalletPin } from "../../../wallet/walletApi";
import { INSTANT_LESSON_DURATIONS } from "../constants";
import { useSharedStepStyles } from "../sharedStepStyles";
import { PlatformPayButtonRow } from "../../../../components/payments/PlatformPayButtonRow";
import { useActiveCurrency, useCurrencyFormatter } from "../../../../lib/intl";

import { PricingBreakdownSummary } from "../../../payments/PricingBreakdownSummary";
import type { PricingQuote } from "../../../payments/pricingTypes";
import { chargeTotalDollars } from "../../../payments/pricingTypes";

export type PaymentCompletePayload = {
  paymentIntentId: string | null;
  chargingPrice: number;
  paymentMethod?: "wallet" | "card";
  pinSessionToken?: string;
  quoteId?: string;
  pricingQuote?: PricingQuote | null;
};

export type PromoResultShape = {
  valid: boolean;
  discount_amount?: number;
  final_amount?: number;
  display_label?: string;
  sponsor_type?: "platform" | "trainer";
};

type Props = {
  trainer: Record<string, unknown> | null;
  durationMinutes: number;
  expectedPrice: number;
  promoResult: PromoResultShape | null;
  couponCode: string;
  userStripeId: string;
  bookingType?: "instant" | "scheduled";
  durationLabel?: string;
  payableAmount?: number;
  promoDiscountAmount?: number;
  promoSponsorType?: "platform" | "trainer";
  promoLabel?: string;
  onPaymentComplete: (payload: PaymentCompletePayload) => void;
  onNext: () => void;
  onAddFunds?: (shortfallDollars: number) => void;
};

export function WizardStepPayment({
  trainer,
  durationMinutes,
  expectedPrice,
  promoResult,
  couponCode,
  userStripeId,
  bookingType = "instant",
  durationLabel,
  payableAmount: payableAmountProp,
  promoDiscountAmount = 0,
  promoSponsorType,
  promoLabel,
  onPaymentComplete,
  onNext,
  onAddFunds,
}: Props) {
  const c = useThemeColors();
  const sharedStepStyles = useSharedStepStyles();
  const styles = usePaymentStyles();
  const { user } = useAuth();
  const billing = useMemo(
    () => resolveTraineeBillingAddress(user as Record<string, unknown> | null),
    [user]
  );
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const fmt = useCurrencyFormatter();
  /** Server-side payment intent is denominated in this currency; trainee
   *  locale picks the symbol if the server didn't return one explicitly. */
  const activeCurrency = useActiveCurrency();
  const [loading, setLoading] = useState(false);
  const [paymentReady, setPaymentReady] = useState(false);
  const [pin, setPin] = useState("");
  const [pinSessionToken, setPinSessionToken] = useState<string | undefined>();
  const [priceInfo, setPriceInfo] = useState<{
    amount: number;
    skip: boolean;
    clientSecret?: string;
    quoteId?: string;
  } | null>(null);
  const [pricingQuote, setPricingQuote] = useState<PricingQuote | null>(null);

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
    (trainer as any)?.commission ?? (trainer as any)?.userInfo?.commission ?? "0"
  );

  const payableAmount = useMemo(() => {
    if (payableAmountProp != null) return payableAmountProp;
    if (promoResult?.valid && promoResult.final_amount != null) {
      return Number(promoResult.final_amount);
    }
    return expectedPrice;
  }, [payableAmountProp, promoResult, expectedPrice]);

  const totalToCharge =
    chargeTotalDollars(pricingQuote) ?? (priceInfo?.amount ?? payableAmount);
  const wallet = useWalletPaymentOption(totalToCharge);
  const lengthLabel =
    durationLabel ??
    INSTANT_LESSON_DURATIONS.find((d) => d.minutes === durationMinutes)?.label ??
    `${durationMinutes} min`;

  const createIntent = useCallback(async () => {
    if (payableAmount <= 0) {
      setPriceInfo({ amount: 0, skip: true });
      setPaymentReady(true);
      return;
    }
    if (expectedPrice <= 0) {
      setPriceInfo({ amount: 0, skip: true });
      setPaymentReady(true);
      return;
    }
    setLoading(true);
    try {
      const trainerId = String((trainer as any)?._id ?? (trainer as any)?.userInfo?._id ?? "");
      const quote = await fetchSessionPricingQuote({
        productType: bookingType === "instant" ? "instant_lesson" : "session_booking",
        sessionSubtotalCents: Math.round(expectedPrice * 100),
        trainerId,
        promoDiscountCents: Math.round(promoDiscountAmount * 100),
        promoSponsorType,
        user: user as Record<string, unknown>,
        paymentMethodHint: wallet.canPayWithWallet ? "wallet_us" : "card_domestic_us",
      });
      setPricingQuote(quote);

      const res = await apiClient.post(API_ROUTES.transaction.createPaymentIntent, {
        amount: expectedPrice,
        destination: trainerStripeId,
        commission,
        customer: userStripeId,
        couponCode: couponCode.trim().toLowerCase() || undefined,
        _bookingType: bookingType,
        trainer_id: trainerId,
        quoteId: quote?.quoteId,
        billingAddress: { country: billing.country, state: billing.state },
      });
      const data = unwrapApiData<{
        skip?: boolean;
        client_secret?: string;
      }>(res);
      if (data?.skip) {
        setPriceInfo({ amount: 0, skip: true });
        setPaymentReady(true);
        return;
      }
      const clientSecret = data?.client_secret;
      if (!clientSecret) throw new Error("No client secret returned.");
      const chargeTotal = quote?.chargeTotalCents != null ? quote.chargeTotalCents / 100 : payableAmount;
      setPriceInfo({
        amount: chargeTotal,
        skip: false,
        clientSecret,
        quoteId: quote?.quoteId,
      });

      const { error } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: "NetQwix",
      });
      if (error) {
        Alert.alert("Payment setup error", error.message);
        return;
      }
      setPaymentReady(true);
    } catch (e: unknown) {
      Alert.alert("Payment error", getApiErrorMessage(e, "Could not set up payment."));
    } finally {
      setLoading(false);
    }
  }, [
    payableAmount,
    expectedPrice,
    trainerStripeId,
    commission,
    userStripeId,
    couponCode,
    initPaymentSheet,
    bookingType,
    billing.country,
    billing.state,
    user,
    trainer,
    promoDiscountAmount,
    promoSponsorType,
    wallet.canPayWithWallet,
  ]);

  useEffect(() => {
    createIntent();
  }, [createIntent, wallet.canPayWithWallet]);

  useEffect(() => {
    if (wallet.storedPinToken && !pinSessionToken) {
      setPinSessionToken(wallet.storedPinToken);
    }
  }, [wallet.storedPinToken, pinSessionToken]);

  const completePayment = useCallback(
    (payload: PaymentCompletePayload) => {
      onPaymentComplete(payload);
      onNext();
    },
    [onPaymentComplete, onNext]
  );

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
      completePayment({
        paymentIntentId: null,
        chargingPrice: totalToCharge,
        paymentMethod: "wallet",
        pinSessionToken: token,
        quoteId: pricingQuote?.quoteId ?? priceInfo?.quoteId,
        pricingQuote,
      });
    } catch (e: unknown) {
      Alert.alert("Wallet payment", getApiErrorMessage(e, "Could not verify PIN."));
    }
  }, [
    wallet.needsPin,
    pin,
    pinSessionToken,
    wallet.storedPinToken,
    completePayment,
    totalToCharge,
    pricingQuote,
    priceInfo,
  ]);

  const handlePay = useCallback(async () => {
    if (priceInfo?.skip || payableAmount <= 0) {
      completePayment({ paymentIntentId: null, chargingPrice: 0 });
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
    completePayment({
      paymentIntentId: intentId,
      chargingPrice: totalToCharge,
      paymentMethod: "card",
      quoteId: pricingQuote?.quoteId ?? priceInfo?.quoteId,
      pricingQuote,
    });
  }, [priceInfo, presentPaymentSheet, completePayment, totalToCharge, pricingQuote]);

  const isFree = payableAmount <= 0 || priceInfo?.skip === true;
  const hasDiscount =
    promoResult?.valid &&
    promoResult.discount_amount != null &&
    promoResult.discount_amount > 0;

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
        {hasDiscount ? (
          <>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryKey}>Subtotal</Text>
              <Text style={styles.summaryValue}>
                {fmt(expectedPrice, { currency: activeCurrency })}
              </Text>
            </View>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryKey}>Discount</Text>
              <Text style={[styles.summaryValue, styles.promoApplied]}>
                -{fmt(promoResult!.discount_amount!, { currency: activeCurrency })}
                {promoResult?.display_label ? ` (${promoResult.display_label})` : ""}
              </Text>
            </View>
          </>
        ) : null}
        {couponCode.trim() ? (
          <View style={styles.summaryLine}>
            <Text style={styles.summaryKey}>Promo</Text>
            <Text style={[styles.summaryValue, styles.promoApplied]}>{couponCode.trim()}</Text>
          </View>
        ) : null}
      </View>

      {!isFree && payableAmount > 0 ? (
        <PricingBreakdownSummary
          sessionSubtotal={expectedPrice}
          pricingQuote={pricingQuote}
          chargeTotal={totalToCharge}
          currency={activeCurrency}
          promoDiscount={promoDiscountAmount > 0 ? promoDiscountAmount : undefined}
          promoLabel={promoLabel}
        />
      ) : null}

      {loading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={c.iconPrimary} />
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
            <Ionicons name="wallet-outline" size={18} color={c.brandTextOn} />
            <Text style={sharedStepStyles.primaryBtnText}>
              Pay {fmt(totalToCharge, { currency: activeCurrency })} with wallet (
              {fmt(wallet.available, { currency: activeCurrency })} available)
            </Text>
          </Pressable>
          <Pressable
            style={[sharedStepStyles.primaryBtn, styles.cardBtn]}
            disabled={!paymentReady}
            onPress={handlePay}
          >
            <Ionicons name="card-outline" size={18} color={c.iconPrimary} />
            <Text style={[sharedStepStyles.primaryBtnText, { color: c.iconPrimary }]}>
              Pay with card
            </Text>
          </Pressable>
        </>
      ) : null}

      {!loading && wallet.walletPayEnabled && !isFree && !wallet.canPayWithWallet && wallet.shortfall > 0 ? (
        <View style={styles.shortfallBox}>
          <Text style={sharedStepStyles.muted}>
            Need {fmt(wallet.shortfall, { currency: activeCurrency })} more in your wallet.
          </Text>
          {onAddFunds ? (
            <Pressable onPress={() => onAddFunds(wallet.shortfall)} style={styles.addFundsLink}>
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
            color={wallet.canPayWithWallet && !isFree ? c.iconPrimary : c.brandTextOn}
          />
          <Text
            style={[
              sharedStepStyles.primaryBtnText,
              wallet.canPayWithWallet && !isFree && { color: c.iconPrimary },
            ]}
          >
            {isFree
              ? "Continue (free)"
              : wallet.canPayWithWallet && wallet.walletPayEnabled
                ? "Pay with card"
                : `Pay ${fmt(payableAmount, { currency: activeCurrency })}`}
          </Text>
        </Pressable>
      )}

      {/**
       * Apple Pay / Google Pay sits *below* the card CTA so it doesn't
       * out-compete the primary action for shoppers that don't have a
       * platform wallet set up. The button hides itself when unsupported,
       * so users on plain Android phones / web don't see an empty row.
       */}
      {!loading && !isFree && priceInfo?.clientSecret ? (
        <PlatformPayButtonRow
          clientSecret={priceInfo.clientSecret}
          amount={totalToCharge}
          currency={activeCurrency}
          merchantName="NetQwix"
          onSuccess={(intentId) => {
            completePayment({
              paymentIntentId: intentId,
              chargingPrice: totalToCharge,
              paymentMethod: "card",
              quoteId: pricingQuote?.quoteId ?? priceInfo?.quoteId,
              pricingQuote,
            });
          }}
          onError={(msg) => Alert.alert("Payment failed", msg)}
        />
      ) : null}
    </View>
  );
}

function usePaymentStyles() {
  return useStaticStyles((palette) =>
    StyleSheet.create({
      summaryBox: {
        backgroundColor: palette.surfaceMuted,
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
        color: palette.iconPrimary,
        width: 100,
      },
      summaryValue: { flex: 1, fontSize: 15, color: palette.text },
      bold: { fontWeight: "700" },
      promoApplied: { color: palette.success },
      loadingBox: {
        alignItems: "center",
        gap: 8,
        paddingVertical: space.md,
      },
      cardBtn: {
        backgroundColor: palette.surfaceElevated,
        borderWidth: 1,
        borderColor: palette.border,
      },
      pinInput: {
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: radii.md,
        padding: space.md,
        marginBottom: space.sm,
        backgroundColor: palette.input,
        color: palette.text,
      },
      shortfallBox: { marginBottom: space.sm, gap: 4 },
      addFundsLink: { alignSelf: "flex-start" },
      addFundsText: { color: palette.iconPrimary, fontWeight: "600" },
    })
  );
}
