/**
 * SessionExtensionModal (trainee)
 * ─────────────────────────────────────────────────────────────────────────────
 * Three-state modal driven by `useSessionExtensionFlow`:
 *
 *   1. "Request"    — chip picker (5/10/15/30) + price preview + "Ask coach"
 *   2. "Awaiting"   — spinner + countdown to trainer auto-decline, cancel CTA
 *   3. "Payment"    — wallet vs. card + amount, kicks off Stripe sheet
 *
 * Phase transitions arrive via socket events through the hook; this component
 * never holds the source of truth for the request itself.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../../../components/ui";
import { useAuth } from "../../auth/context/AuthContext";
import { fetchSessionPricingQuote } from "../../payments/fetchSessionPricingQuote";
import { chargeTotalDollars } from "../../payments/pricingTypes";
import { resolveTraineeBillingAddress } from "../../payments/resolveTraineeBillingAddress";
import { colors, radii, space, typography } from "../../../theme";
import { PricingBreakdownSummary } from "../../payments/PricingBreakdownSummary";
import type { ExtensionOptions, ExtensionQuote } from "../sessionExtensionApi";
import { fetchSessionExtensionOptions } from "../sessionExtensionApi";
import type { UseSessionExtensionFlow } from "../useSessionExtensionFlow";
import { SavedCardHint } from "../../../components/payments/SavedCardHint";
import { useDefaultSavedCard } from "../../wallet/hooks/useDefaultSavedCard";
import { useWalletPaymentOption } from "../../wallet/hooks/useWalletPaymentOption";
import { WalletPinSetupBanner } from "../../wallet/components/WalletPinSetupBanner";
import { resolveWalletPinSessionForPayment } from "../../wallet/security/walletPinPaymentFlow";
import { navigateToWalletSecurity } from "../../../navigation/navigationRef";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";

const FALLBACK_EXTENSION_DURATIONS = [5, 10, 15, 30] as const;

type Props = {
  visible: boolean;
  sessionId: string;
  trainerId?: string;
  remainingSeconds: number | null;
  /** Initial chip selection when the modal opens (defaults to 10 min). */
  defaultMinutes?: number;
  flow: UseSessionExtensionFlow;
  onDismiss: () => void;
  /** Optional: navigate trainee to wallet top-up when balance is short. */
  onAddFunds?: (shortfallDollars: number) => void;
};

function formatCountdown(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function useCountdownToIso(iso: string | null): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!iso) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [iso]);
  if (!iso) return 0;
  const target = new Date(iso).getTime();
  return Math.max(0, Math.floor((target - now) / 1000));
}

export function SessionExtensionModal({
  visible,
  sessionId,
  trainerId,
  remainingSeconds,
  defaultMinutes = 10,
  flow,
  onDismiss,
  onAddFunds,
}: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [minutes, setMinutes] = useState<number>(defaultMinutes);
  const [quote, setQuote] = useState<ExtensionQuote | null>(null);
  const [options, setOptions] = useState<ExtensionOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "card">("wallet");
  const [pin, setPin] = useState("");
  const [pinSessionToken, setPinSessionToken] = useState<string | undefined>();

  const durationChoices = useMemo(() => {
    const fromServer = options?.allowedDurations?.filter((m) => m > 0) ?? [];
    return fromServer.length > 0 ? fromServer : [...FALLBACK_EXTENSION_DURATIONS];
  }, [options?.allowedDurations]);

  const userStripeId = String(
    (user as Record<string, unknown>)?.stripe_account_id ?? ""
  );
  const billingAddress = useMemo(
    () => resolveTraineeBillingAddress(user as Record<string, unknown> | null),
    [user]
  );

  const { state, fetchQuote, requestExtension, cancelRequest, payAndConfirm } = flow;
  const { phase, request, message } = state;

  const extensionChargeTotal = useMemo(() => {
    const fromQuote = chargeTotalDollars(quote?.pricingQuote ?? null);
    if (fromQuote != null) return fromQuote;
    return Number(request?.amount ?? quote?.amount ?? 0);
  }, [quote, request?.amount]);

  const extensionChargeMinor = useMemo(
    () =>
      quote?.pricingQuote?.chargeTotalCents ??
      Math.round(extensionChargeTotal * 100),
    [quote?.pricingQuote?.chargeTotalCents, extensionChargeTotal]
  );

  const wallet = useWalletPaymentOption(extensionChargeTotal, paymentMethod === "wallet", billingAddress.country);
  const payDisabled =
    phase === "paying" ||
    wallet.needsPinSetup ||
    (paymentMethod === "wallet" &&
      extensionChargeTotal > 0 &&
      !wallet.canPayWithWallet);
  const savedCard = useDefaultSavedCard(
    (phase === "awaiting_payment" || phase === "paying") && extensionChargeTotal > 0
  );

  useEffect(() => {
    if (wallet.storedPinToken && !pinSessionToken) {
      setPinSessionToken(wallet.storedPinToken);
    }
  }, [wallet.storedPinToken, pinSessionToken]);

  const expiryCountdown = useCountdownToIso(request?.expiresAt ?? null);

  /** Load server-driven duration chips when the modal opens. */
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setOptionsLoading(true);
    fetchSessionExtensionOptions(sessionId)
      .then((opts) => {
        if (cancelled) return;
        setOptions(opts);
        if (!opts.allowed) {
          setQuoteError(opts.reason ?? "Extension not available right now.");
        } else if (opts.allowedDurations?.length) {
          setMinutes((prev) =>
            opts.allowedDurations.includes(prev)
              ? prev
              : opts.allowedDurations[0] ?? defaultMinutes
          );
        }
      })
      .catch(() => {
        if (!cancelled) setOptions(null);
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, sessionId, defaultMinutes]);

  /** Refresh the price preview whenever the chip changes (only matters in the
   *  request phase; the server snapshot already carries the locked-in price
   *  during awaiting/paying). */
  useEffect(() => {
    if (!visible) return;
    if (phase !== "idle" && phase !== "error" && phase !== "rejected" && phase !== "cancelled" && phase !== "expired") return;
    let cancelled = false;
    setQuoteLoading(true);
    setQuoteError(null);
    fetchQuote(minutes)
      .then(async (q) => {
        if (cancelled) return;
        let enriched = q;
        if (q.allowed && trainerId && q.amount > 0) {
          try {
            const pricingQuote = await fetchSessionPricingQuote({
              productType: "session_extension",
              sessionSubtotalCents: Math.round(q.amount * 100),
              trainerId,
              user: user as Record<string, unknown>,
              paymentMethodHint: paymentMethod === "wallet" ? "wallet_us" : "card_domestic_us",
            });
            enriched = { ...q, pricingQuote };
          } catch {
            enriched = q;
          }
        }
        if (cancelled) return;
        setQuote(enriched);
        if (!enriched.allowed) setQuoteError(enriched.reason ?? "Not available right now.");
      })
      .catch((e: any) => {
        if (cancelled) return;
        setQuoteError(
          e?.response?.data?.error ?? e?.message ?? "Could not load price."
        );
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, minutes, phase, fetchQuote, trainerId, user, paymentMethod]);

  useEffect(() => {
    if (!visible) return;
    if (phase !== "awaiting_payment" && phase !== "paying") return;
    const mins = request?.minutes ?? minutes;
    let cancelled = false;
    fetchQuote(mins)
      .then(async (q) => {
        if (cancelled || !q.allowed) return;
        let enriched = q;
        if (trainerId && q.amount > 0) {
          try {
            const pricingQuote = await fetchSessionPricingQuote({
              productType: "session_extension",
              sessionSubtotalCents: Math.round(q.amount * 100),
              trainerId,
              user: user as Record<string, unknown>,
              paymentMethodHint: paymentMethod === "wallet" ? "wallet_us" : "card_domestic_us",
            });
            enriched = { ...q, pricingQuote };
          } catch {
            enriched = q;
          }
        }
        if (!cancelled) setQuote(enriched);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [visible, phase, request?.minutes, minutes, fetchQuote, trainerId, user, paymentMethod]);

  /** When the trainee dismisses while still pending/awaiting payment, surface
   *  a confirm step instead of silently abandoning a server-side row. */
  const handleClose = useCallback(() => {
    if (phase === "awaiting_trainer" || phase === "awaiting_payment") {
      Alert.alert(
        "Cancel extension?",
        "Closing now will cancel your request and resume the timer.",
        [
          { text: "Keep waiting", style: "cancel" },
          {
            text: "Cancel request",
            style: "destructive",
            onPress: async () => {
              await cancelRequest("user_dismissed_modal");
              onDismiss();
            },
          },
        ]
      );
      return;
    }
    onDismiss();
  }, [cancelRequest, onDismiss, phase]);

  const handleRequest = useCallback(async () => {
    const req = await requestExtension(minutes);
    if (!req) {
      // requestExtension already set an error message; modal stays open.
    }
  }, [minutes, requestExtension]);

  const handlePay = useCallback(async () => {
    if (wallet.needsPinSetup) {
      Alert.alert(
        "Set up wallet PIN",
        "Create a 6-digit wallet PIN in Wallet security before paying with wallet.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Set up PIN", onPress: () => navigateToWalletSecurity() },
        ]
      );
      return;
    }

    if (paymentMethod === "wallet" && extensionChargeMinor > 0) {
      if (!wallet.canPayWithWallet) {
        if (onAddFunds && wallet.shortfall > 0) {
          Alert.alert(
            "Add funds",
            `You need $${wallet.shortfall.toFixed(2)} more in your wallet, or pay with card.`,
            [
              { text: "Pay with card", onPress: () => setPaymentMethod("card") },
              { text: "Add funds", onPress: () => onAddFunds(wallet.shortfall) },
              { text: "Cancel", style: "cancel" },
            ]
          );
        } else {
          Alert.alert(
            "Wallet balance too low",
            "Pay with card or add funds to your wallet first."
          );
        }
        return;
      }
      let token = pinSessionToken ?? wallet.storedPinToken ?? undefined;
      const gate = await resolveWalletPinSessionForPayment(wallet, pin, token, {
        onSetupPin: navigateToWalletSecurity,
      });
      if (!gate.ok) return;
      token = gate.token;
      if (token && token !== pinSessionToken) {
        setPinSessionToken(token);
        setPin("");
      }
      await payAndConfirm({
        method: "wallet",
        pinSessionToken: token,
        quoteId: quote?.pricingQuote?.quoteId,
        chargeTotalCents: extensionChargeMinor,
        billingAddress: {
          country: billingAddress.country,
          state: billingAddress.state,
        },
      });
      return;
    }

    if (paymentMethod === "card") {
      await payAndConfirm({
        method: "card",
        customer: userStripeId || undefined,
        quoteId: quote?.pricingQuote?.quoteId,
        chargeTotalCents: extensionChargeMinor,
        billingAddress: {
          country: billingAddress.country,
          state: billingAddress.state,
        },
      });
    }
  }, [
    payAndConfirm,
    paymentMethod,
    userStripeId,
    quote?.pricingQuote?.quoteId,
    extensionChargeMinor,
    extensionChargeTotal,
    wallet,
    pin,
    pinSessionToken,
    onAddFunds,
    billingAddress,
  ]);

  // Auto-dismiss on terminal success.
  useEffect(() => {
    if (!visible) return;
    if (phase === "applied") {
      const id = setTimeout(() => onDismiss(), 1200);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [phase, visible, onDismiss]);

  const inExtendWindow = useMemo(() => {
    if (remainingSeconds == null) return true;
    return remainingSeconds <= 120 || remainingSeconds <= 0;
  }, [remainingSeconds]);

  const renderHeader = (label: string) => (
    <View style={styles.header}>
      <Ionicons name="time-outline" size={22} color={colors.brandNavy} />
      <Text style={styles.title}>{label}</Text>
      <Pressable onPress={handleClose} hitSlop={12}>
        <Ionicons name="close" size={22} color={colors.textMuted} />
      </Pressable>
    </View>
  );

  let body: React.ReactNode;

  if (phase === "awaiting_trainer") {
    body = (
      <>
        {renderHeader("Waiting for coach")}
        <Text style={styles.sub}>
          We sent your request to extend by {request?.minutes ?? minutes} minutes.
          We'll resume the timer if your coach doesn't answer in time.
        </Text>
        <View style={styles.awaitBlock}>
          <ActivityIndicator color={colors.brandNavy} size="large" />
          <Text style={styles.awaitCountdown}>
            {formatCountdown(expiryCountdown)}
          </Text>
          <Text style={styles.awaitHint}>auto-decline if no response</Text>
        </View>
        <Button
          label="Cancel request"
          onPress={() => cancelRequest("user_cancelled")}
          variant="ghost"
          fullWidth
        />
      </>
    );
  } else if (phase === "awaiting_payment" || phase === "paying") {
    body = (
      <>
        {renderHeader("Pay to extend")}
        <Text style={styles.sub}>
          Coach approved. Complete payment in the next {formatCountdown(expiryCountdown)} to add{" "}
          {request?.minutes ?? minutes} minutes to your lesson.
        </Text>
        <PricingBreakdownSummary
          sessionSubtotal={Number(request?.amount ?? quote?.amount ?? 0)}
          pricingQuote={quote?.pricingQuote ?? null}
          chargeTotal={extensionChargeTotal}
        />
        {request && extensionChargeTotal > 0 ? (
          <View style={styles.payRow}>
            <Pressable
              style={[styles.payChip, paymentMethod === "wallet" && styles.payChipActive]}
              onPress={() => setPaymentMethod("wallet")}
            >
              <Text style={styles.payChipText}>Wallet</Text>
            </Pressable>
            <Pressable
              style={[styles.payChip, paymentMethod === "card" && styles.payChipActive]}
              onPress={() => setPaymentMethod("card")}
            >
              <Text style={styles.payChipText}>Card</Text>
            </Pressable>
          </View>
        ) : null}
        {paymentMethod === "card" && extensionChargeTotal > 0 ? (
          <SavedCardHint label={savedCard.label} loading={savedCard.isLoading} />
        ) : null}
        {paymentMethod === "wallet" && wallet.walletPayEnabled && extensionChargeTotal > 0 ? (
          <>
            {wallet.needsPinSetup ? (
              <WalletPinSetupBanner onSetupPin={navigateToWalletSecurity} />
            ) : wallet.needsPin && !pinSessionToken ? (
              <TextInput
                style={styles.pinInput}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
                placeholder="6-digit wallet PIN"
                value={pin}
                onChangeText={setPin}
              />
            ) : null}
            <Text style={styles.walletHint}>
              Spendable balance: ${wallet.available.toFixed(2)}
            </Text>
            {!wallet.canPayWithWallet && wallet.shortfall > 0 ? (
              <View style={styles.shortfallRow}>
                <Text style={styles.shortfallText}>
                  Need ${wallet.shortfall.toFixed(2)} more for wallet pay.
                </Text>
                {onAddFunds ? (
                  <Pressable onPress={() => onAddFunds(wallet.shortfall)}>
                    <Text style={styles.addFundsLink}>Add funds</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}
        {message ? <Text style={styles.error}>{message}</Text> : null}
        <Button
          label={
            phase === "paying"
              ? "Processing…"
              : `Pay $${extensionChargeTotal.toFixed(2)}`
          }
          onPress={handlePay}
          disabled={payDisabled}
          fullWidth
        />
        <Button
          label="Cancel"
          onPress={() => cancelRequest("user_cancelled_payment")}
          variant="ghost"
          fullWidth
        />
      </>
    );
  } else if (phase === "applied") {
    body = (
      <>
        {renderHeader("Lesson extended")}
        <Text style={styles.sub}>
          Time has been added to your lesson. You can keep going.
        </Text>
      </>
    );
  } else {
    /** Request view: shown for idle / error / terminal-but-fresh phases. */
    const terminalMessage =
      phase === "rejected"
        ? "Coach declined this extension."
        : phase === "expired"
        ? "No response in time, but you can try again."
        : phase === "cancelled"
        ? "Previous request cancelled."
        : null;

    body = (
      <>
        {renderHeader("Extend this lesson")}
        <Text style={styles.sub}>
          {inExtendWindow
            ? "Pick how much extra time you need. Your coach has to approve, then you can pay."
            : "You can extend when 2 minutes or less remain on the lesson."}
        </Text>

        {terminalMessage ? (
          <Text style={styles.notice}>{terminalMessage}</Text>
        ) : null}

        <View style={styles.chipRow}>
          {durationChoices.map((opt) => (
            <Pressable
              key={opt}
              style={[styles.chip, minutes === opt && styles.chipActive]}
              onPress={() => setMinutes(opt)}
            >
              <Text
                style={[styles.chipText, minutes === opt && styles.chipTextActive]}
              >
                +{opt}m
              </Text>
            </Pressable>
          ))}
        </View>

        {optionsLoading ? (
          <ActivityIndicator color={colors.brandNavy} style={{ marginVertical: space.xs }} />
        ) : options?.minutesUntilSlotEnd != null && options.minutesUntilSlotEnd > 0 ? (
          <Text style={styles.notice}>
            Coach availability ends in {options.minutesUntilSlotEnd} min
            {options.maxMinutes ? ` (max +${options.maxMinutes}m)` : ""}.
          </Text>
        ) : null}

        {quoteLoading ? (
          <ActivityIndicator
            color={colors.brandNavy}
            style={{ marginVertical: space.md }}
          />
        ) : quoteError ? (
          <Text style={styles.error}>{quoteError}</Text>
        ) : quote?.allowed ? (
          <PricingBreakdownSummary
            sessionSubtotal={quote.amount}
            pricingQuote={quote.pricingQuote ?? null}
            chargeTotal={chargeTotalDollars(quote.pricingQuote) ?? quote.amount}
          />
        ) : null}

        {message ? <Text style={styles.error}>{message}</Text> : null}

        <Button
          label={
            phase === "requesting" ? "Asking coach…" : `Ask coach to add ${minutes} min`
          }
          onPress={handleRequest}
          disabled={
            !inExtendWindow ||
            phase === "requesting" ||
            quoteLoading ||
            optionsLoading ||
            (options != null && !options.allowed) ||
            (!!quoteError && !quote?.allowed)
          }
          fullWidth
        />
      </>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={[styles.backdrop, { paddingBottom: insets.bottom + space.md }]}>
        <View style={styles.sheet}>{body}</View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: space.lg,
    gap: space.sm,
  },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm },
  title: { ...typography.titleSm, color: colors.text, flex: 1 },
  sub: { ...typography.bodySm, color: colors.textMuted },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: space.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.brandNavy, borderColor: colors.brandNavy },
  chipText: { ...typography.label, color: colors.textSecondary },
  chipTextActive: { color: colors.brandTextOn },
  price: { ...typography.titleMd, color: colors.brandNavy, textAlign: "center" },
  error: { ...typography.bodySm, color: colors.danger, textAlign: "center" },
  notice: { ...typography.bodySm, color: colors.textMuted, textAlign: "center" },
  awaitBlock: { alignItems: "center", gap: 6, marginVertical: space.md },
  awaitCountdown: { ...typography.titleMd, color: colors.text },
  awaitHint: { ...typography.label, color: colors.textMuted },
  priceBlock: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: space.sm,
  },
  priceLabel: { ...typography.label, color: colors.textMuted },
  priceValue: { ...typography.titleMd, color: colors.brandNavy },
  payRow: { flexDirection: "row", gap: 8, marginVertical: space.sm },
  payChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  payChipActive: { backgroundColor: colors.brandNavy, borderColor: colors.brandNavy },
  payChipText: { ...typography.label, color: colors.textSecondary },
  pinInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: space.xs,
  },
  walletHint: { ...typography.caption, color: colors.textMuted },
  shortfallRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  shortfallText: { ...typography.caption, color: colors.danger },
  addFundsLink: { ...typography.caption, color: colors.brandNavy, fontWeight: "700" },
});
