import { useStripe } from "@stripe/stripe-react-native";
import { useCallback, useState } from "react";
import { Platform } from "react-native";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { STRIPE_APPLE_MERCHANT_IDENTIFIER } from "../../../config/env";
import {
  confirmTopUp,
  createTopUpIntent,
  waitForTopUpSettled,
  type TopUpIntentResult,
} from "../walletApi";

export type TopUpFlowPhase = "idle" | "presenting" | "confirming" | "succeeded" | "failed" | "canceled";

export type TopUpFlowResult =
  | { ok: true; topupId: string; amountDollars: number }
  | { ok: false; code: "canceled" | "failed" | "timeout" | "validation"; message: string };

export function useWalletTopUpFlow() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [phase, setPhase] = useState<TopUpFlowPhase>("idle");

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
      if (!Number.isFinite(amountDollars) || amountDollars <= 0) {
        return { ok: false, code: "validation", message: "Enter a valid amount." };
      }

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

      const topupId = String(intent.topupId ?? "");
      if (!topupId || !intent.client_secret) {
        return {
          ok: false,
          code: "failed",
          message: "Invalid response from server. Please try again.",
        };
      }

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
      try {
        await confirmTopUp(topupId);
      } catch {
        /* webhook may still complete */
      }

      const settled = await waitForTopUpSettled(topupId, { maxAttempts: 12, intervalMs: 2000 });
      if (settled === "succeeded") {
        setPhase("succeeded");
        return { ok: true, topupId, amountDollars };
      }
      if (settled === "failed") {
        setPhase("failed");
        return {
          ok: false,
          code: "failed",
          message: "Payment was declined or could not be completed.",
        };
      }

      setPhase("confirming");
      return {
        ok: false,
        code: "timeout",
        message:
          "Payment received — your balance may take a minute to update. Check Activity or pull to refresh.",
      };
    },
    [presentStripeSheet]
  );

  return { phase, runTopUp, setPhase };
}
