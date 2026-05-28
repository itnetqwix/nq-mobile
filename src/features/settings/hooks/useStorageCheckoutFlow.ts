import { useStripe } from "@stripe/stripe-react-native";
import { useCallback, useState } from "react";
import { Platform } from "react-native";
import { createStorageCheckout } from "../../home/api/homeApi";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { STRIPE_APPLE_MERCHANT_IDENTIFIER } from "../../../config/env";

export type StorageCheckoutInterval = "monthly" | "yearly";

export function useStorageCheckoutFlow() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [busy, setBusy] = useState(false);

  const subscribe = useCallback(
    async (planId: string, interval: StorageCheckoutInterval) => {
      setBusy(true);
      try {
        const intent = await createStorageCheckout(planId, interval);
        if (!intent?.client_secret) {
          throw new Error("Payment could not be started.");
        }
        const { error: initErr } = await initPaymentSheet({
          paymentIntentClientSecret: intent.client_secret,
          merchantDisplayName: "NetQwix",
          allowsDelayedPaymentMethods: false,
          returnURL: "netqwix://storage-checkout",
          applePay:
            Platform.OS === "ios" && !!STRIPE_APPLE_MERCHANT_IDENTIFIER
              ? { merchantCountryCode: "US" }
              : undefined,
          googlePay:
            Platform.OS === "android" ? { merchantCountryCode: "US", testEnv: __DEV__ } : undefined,
        });
        if (initErr) throw new Error(initErr.message);
        const { error: payErr } = await presentPaymentSheet();
        if (payErr) {
          if (payErr.code === "Canceled") return { ok: false as const, canceled: true };
          throw new Error(payErr.message);
        }
        return { ok: true as const };
      } catch (e) {
        return {
          ok: false as const,
          message: getApiErrorMessage(e, "Payment failed."),
        };
      } finally {
        setBusy(false);
      }
    },
    [initPaymentSheet, presentPaymentSheet]
  );

  return { busy, subscribe };
}
