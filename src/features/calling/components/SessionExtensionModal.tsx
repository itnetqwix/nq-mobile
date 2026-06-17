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
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../../../components/ui";
import { useAuth } from "../../auth/context/AuthContext";
import { fetchSessionPricingQuote } from "../../payments/fetchSessionPricingQuote";
import { resolveTraineeBillingAddress } from "../../payments/resolveTraineeBillingAddress";
import { colors, radii, space, typography } from "../../../theme";
import { PricingBreakdownSummary } from "../../payments/PricingBreakdownSummary";
import type { ExtensionQuote } from "../sessionExtensionApi";
import type { UseSessionExtensionFlow } from "../useSessionExtensionFlow";
import { chargeTotalDollars } from "../../payments/pricingTypes";

/** Mobile UI surfaces only the most common picks; the backend still accepts
 *  60/120 for parity with legacy clients. */
const EXTENSION_DURATIONS = [5, 10, 15, 30, 60, 120] as const;

type Props = {
  visible: boolean;
  sessionId: string;
  trainerId?: string;
  remainingSeconds: number | null;
  /** Initial chip selection when the modal opens (defaults to 10 min). */
  defaultMinutes?: number;
  flow: UseSessionExtensionFlow;
  onDismiss: () => void;
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
}: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [minutes, setMinutes] = useState<number>(defaultMinutes);
  const [quote, setQuote] = useState<ExtensionQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "card">("wallet");

  const userStripeId = String(
    (user as Record<string, unknown>)?.stripe_account_id ?? ""
  );
  const billingAddress = useMemo(
    () => resolveTraineeBillingAddress(user as Record<string, unknown> | null),
    [user]
  );

  const { state, fetchQuote, requestExtension, cancelRequest, payAndConfirm } = flow;
  const { phase, request, message } = state;

  const expiryCountdown = useCountdownToIso(request?.expiresAt ?? null);

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

  const handlePay = useCallback(async () => {
    const ok = await payAndConfirm({
      method: paymentMethod,
      customer: userStripeId || undefined,
      quoteId: quote?.pricingQuote?.quoteId,
      chargeTotalCents: extensionChargeMinor,
      billingAddress: {
        country: billingAddress.country,
        state: billingAddress.state,
      },
    });
    if (ok) {
      // SESSION_EXTENSION_APPLIED will flip phase to "applied" -> auto close.
    }
  }, [payAndConfirm, paymentMethod, userStripeId, quote?.pricingQuote?.quoteId, extensionChargeMinor]);

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
        {message ? <Text style={styles.error}>{message}</Text> : null}
        <Button
          label={
            phase === "paying"
              ? "Processing…"
              : `Pay $${extensionChargeTotal.toFixed(2)}`
          }
          onPress={handlePay}
          disabled={phase === "paying"}
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
          {EXTENSION_DURATIONS.map((opt) => (
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
});
