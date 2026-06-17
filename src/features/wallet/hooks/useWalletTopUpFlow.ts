import {
  PlatformPay,
  confirmPlatformPayPayment,
  isPlatformPaySupported,
  useStripe,
} from "@stripe/stripe-react-native";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { STRIPE_APPLE_MERCHANT_IDENTIFIER } from "../../../config/env";
import {
  confirmTopUp,
  createTopUpIntent,
  waitForTopUpSettled,
  type TopUpIntentResult,
} from "../walletApi";
import {
  finalizeTopUpSettlement,
  parseTopUpIntent,
  validateTopUpAmount,
  type TopUpFlowResult,
} from "./walletTopUpFlowLogic";

export type TopUpFlowPhase = "idle" | "presenting" | "confirming" | "succeeded" | "failed" | "canceled";

export type { TopUpFlowResult };

export function useWalletTopUpFlow() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [phase, setPhase] = useState<TopUpFlowPhase>("idle");
  const [nativePaySupported, setNativePaySupported] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (Platform.OS === "ios" && !STRIPE_APPLE_MERCHANT_IDENTIFIER) {
        return;
      }
      try {
        const ok = await isPlatformPaySupported({
          applePay: Platform.OS === "ios" ? { merchantCountryCode: "US" } : undefined,
          googlePay: Platform.OS === "android" ? { testEnv: __DEV__ } : undefined,
        });
        if (mounted) setNativePaySupported(ok);
      } catch {
        // not supported
      }
    })();
    return () => { mounted = false; };
  }, []);

  const presentStripeSheet = useCallback(
    async (intent: TopUpIntentResult, amountDollars: number) => {
      if (!intent.client_secret) {
        throw new Error("Payment could not be started. Missing client secret.");
      }

      const { error: initErr } = await initPaymentSheet({
        paymentIntentClientSecret: intent.client_secret,
        merchantDisplayName: "NetQwix",
        allowsDelayedPaymentMethods: false,
        returnURL: "netqwix://wallet-topup",
        defaultBillingDetails: {
          name: "NetQwix member",
        },
        applePay:
          Platform.OS === "ios" && !!STRIPE_APPLE_MERCHANT_IDENTIFIER
            ? {
                merchantCountryCode: "US",
              }
            : undefined,
        googlePay:
          Platform.OS === "android"
            ? {
                merchantCountryCode: "US",
                testEnv: __DEV__,
              }
            : undefined,
      });

      if (initErr) {
        throw new Error(initErr.message);
      }

      const { error: payErr } = await presentPaymentSheet();
      if (payErr) {
        if (payErr.code === "Canceled") {
          return { canceled: true as const };
        }
        throw new Error(payErr.message);
      }
      return { canceled: false as const };
    },
    [initPaymentSheet, presentPaymentSheet]
  );

  const runTopUp = useCallback(
    async (amountDollars: number): Promise<TopUpFlowResult> => {
      const validation = validateTopUpAmount(amountDollars);
      if (validation) return validation;

      const amountMinor = Math.round(amountDollars * 100);
      setPhase("idle");

      let intent: TopUpIntentResult;
      try {
        intent = await createTopUpIntent(amountMinor);
      } catch (e) {
        return {
          ok: false,
          code: "failed",
          message: getApiErrorMessage(e, "Could not start top-up."),
        };
      }

      const parsed = parseTopUpIntent(intent);
      if ("ok" in parsed) return parsed;
      const { topupId } = parsed;

      setPhase("presenting");
      try {
        const sheet = await presentStripeSheet(intent, amountDollars);
        if (sheet.canceled) {
          setPhase("canceled");
          return { ok: false, code: "canceled", message: "Payment canceled." };
        }
      } catch (e) {
        setPhase("failed");
        return {
          ok: false,
          code: "failed",
          message: getApiErrorMessage(e, "Card payment failed."),
        };
      }

      setPhase("confirming");
      const result = await finalizeTopUpSettlement(topupId, amountDollars, {
        confirmTopUp,
        waitForTopUpSettled,
      });
      if (result.ok) setPhase("succeeded");
      else if (result.code === "failed") setPhase("failed");
      else setPhase("confirming");
      return result;
    },
    [presentStripeSheet]
  );

  const runNativePayTopUp = useCallback(
    async (amountDollars: number): Promise<TopUpFlowResult> => {
      const validation = validateTopUpAmount(amountDollars);
      if (validation) return validation;

      const amountMinor = Math.round(amountDollars * 100);
      setPhase("presenting");

      let intent: TopUpIntentResult;
      try {
        intent = await createTopUpIntent(amountMinor);
      } catch (e) {
        setPhase("failed");
        return {
          ok: false,
          code: "failed",
          message: getApiErrorMessage(e, "Could not start top-up."),
        };
      }

      const parsed = parseTopUpIntent(intent);
      if ("ok" in parsed) {
        setPhase("failed");
        return parsed;
      }
      const { topupId } = parsed;

      try {
        const result = await confirmPlatformPayPayment(intent.client_secret, {
          applePay: {
            cartItems: [
              {
                label: "NetQwix Wallet Top-up",
                amount: amountDollars.toFixed(2),
                paymentType: PlatformPay.PaymentType.Immediate,
              },
            ],
            merchantCountryCode: "US",
            currencyCode: "USD",
          },
          googlePay: {
            testEnv: __DEV__,
            merchantName: "NetQwix",
            merchantCountryCode: "US",
            currencyCode: "USD",
          },
        });

        if (result.error) {
          if (String(result.error.code) === "Canceled") {
            setPhase("canceled");
            return { ok: false, code: "canceled", message: "Payment canceled." };
          }
          setPhase("failed");
          return { ok: false, code: "failed", message: result.error.message };
        }
      } catch (e) {
        setPhase("failed");
        return {
          ok: false,
          code: "failed",
          message: getApiErrorMessage(e, "Payment failed."),
        };
      }

      setPhase("confirming");
      const result = await finalizeTopUpSettlement(topupId, amountDollars, {
        confirmTopUp,
        waitForTopUpSettled,
      });
      if (result.ok) setPhase("succeeded");
      else if (result.code === "failed") setPhase("failed");
      else setPhase("confirming");
      return result;
    },
    []
  );

  return { phase, runTopUp, runNativePayTopUp, nativePaySupported, setPhase };
}
