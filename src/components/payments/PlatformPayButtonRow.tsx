/**
 * Apple Pay / Google Pay button row.
 *
 * Renders Stripe's native `<PlatformPayButton>` (Apple Pay on iOS, Google
 * Pay on Android) when the device + Stripe account both support it, and
 * confirms the payment intent against Stripe's native sheets. Falls back
 * to nothing on platforms that can't show the button (web, unsupported
 * devices, Stripe accounts without the capability enabled).
 *
 * Usage:
 *   <PlatformPayButtonRow
 *     clientSecret={paymentIntent.client_secret}
 *     amount={payableAmount}
 *     currency="USD"
 *     onSuccess={() => completePayment(...)}
 *   />
 *
 * Why a wrapper instead of using Stripe's component directly?
 *   - Centralised capability detection (no duplicate `useEffect` chains).
 *   - One place to translate Stripe error codes into user-readable copy.
 *   - Keeps booking wizards focused on flow, not payments-SDK plumbing.
 */

import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import {
  PlatformPay,
  PlatformPayButton,
  confirmPlatformPayPayment,
  isPlatformPaySupported,
} from "@stripe/stripe-react-native";
import { space, typography, useThemeColors, useThemedStyles } from "../../theme";
import { STRIPE_APPLE_MERCHANT_IDENTIFIER } from "../../config/env";

type Props = {
  /** Stripe PaymentIntent client secret to confirm against the native sheet. */
  clientSecret: string;
  /** Amount in major units (dollars). Converted to minor for Stripe below. */
  amount: number;
  /** ISO-4217 currency code (e.g. "USD", "INR"). */
  currency: string;
  /** Merchant country code (ISO 3166-1 alpha-2). Defaults to "US". */
  merchantCountryCode?: string;
  /** Merchant display name, surfaced inside Google Pay's sheet on Android. */
  merchantName?: string;
  /**
   * Apple Pay merchant identifier (configured in Apple Developer + Stripe
   * dashboard). Defaults to a NetQwix-issued value via env at build time.
   */
  appleMerchantId?: string;
  /** Set to true during checkout flows on staging / non-Play-Store builds. */
  testEnv?: boolean;
  /** Optional label override above the button. */
  label?: string;
  /** Fires when the native sheet confirms the payment intent. */
  onSuccess: (paymentIntentId: string | null) => void;
  /** Fires for non-cancel errors. Cancellations are swallowed silently. */
  onError?: (message: string) => void;
};

/**
 * Render the platform-native pay button when available, otherwise nothing.
 *
 * The capability check (`isPlatformPaySupported`) is async + caches at the
 * native layer, so we run it once on mount and re-run when the currency
 * changes (Google Pay availability is currency-scoped).
 */
export function PlatformPayButtonRow({
  clientSecret,
  amount,
  currency,
  merchantCountryCode = "US",
  merchantName = "NetQwix",
  appleMerchantId,
  testEnv = __DEV__,
  label,
  onSuccess,
  onError,
}: Props) {
  const styles = useStyles();
  const c = useThemeColors();
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const merchantId = appleMerchantId ?? STRIPE_APPLE_MERCHANT_IDENTIFIER;
      if (Platform.OS === "ios" && !merchantId) {
        if (mounted) setSupported(false);
        return;
      }
      try {
        const ok = await isPlatformPaySupported({
          applePay: Platform.OS === "ios" ? { merchantCountryCode: merchantCountryCode } : undefined,
          googlePay: Platform.OS === "android" ? { testEnv } : undefined,
        });
        if (mounted) setSupported(ok);
      } catch {
        if (mounted) setSupported(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [appleMerchantId, merchantCountryCode, testEnv, currency]);

  if (!supported || !clientSecret) return null;

  const handlePress = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await confirmPlatformPayPayment(clientSecret, {
        applePay: {
          cartItems: [
            {
              label: merchantName,
              amount: amount.toFixed(2),
              paymentType: PlatformPay.PaymentType.Immediate,
            },
          ],
          merchantCountryCode,
          currencyCode: currency,
        },
        googlePay: {
          testEnv,
          merchantName,
          merchantCountryCode,
          currencyCode: currency,
        },
      });
      if (result.error) {
        /**
         * Stripe ships the cancel code as the string `"Canceled"` (note
         * single-L American spelling). The PlatformPayError enum lives
         * under `Errors`, not the `PlatformPay` namespace, so we compare
         * by string token to avoid a separate import that may drift across
         * minor versions of the SDK.
         */
        if (String(result.error.code) !== "Canceled") {
          onError?.(result.error.message);
        }
        return;
      }
      onSuccess(result.paymentIntent?.id ?? null);
    } catch (e: any) {
      onError?.(e?.message ?? "Platform Pay failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <PlatformPayButton
        type={PlatformPay.ButtonType.Pay}
        onPress={handlePress}
        appearance={
          c.background === "#FFFFFF"
            ? PlatformPay.ButtonStyle.Black
            : PlatformPay.ButtonStyle.WhiteOutline
        }
        style={styles.button}
        disabled={busy}
      />
    </View>
  );
}

function useStyles() {
  return useThemedStyles((c) =>
    StyleSheet.create({
      wrap: {
        marginTop: space.sm,
        gap: 6,
      },
      label: { ...typography.caption, color: c.textMuted, textAlign: "center" },
      button: {
        // Apple Pay / Google Pay guidelines: minimum 40pt height, hugged width
        // so it sits naturally inside our existing CTA stack.
        height: Platform.OS === "ios" ? 44 : 48,
        width: "100%",
        borderRadius: 12,
      },
    })
  );
}
