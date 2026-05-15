import { Ionicons } from "@expo/vector-icons";
import { useStripe } from "@stripe/stripe-react-native";
import React, { useCallback, useEffect, useState } from "react";
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
import { INSTANT_LESSON_DURATIONS } from "../../instant-lesson/booking-wizard/constants";
import { useAuth } from "../../auth/context/AuthContext";
import { colors, radii, space, typography } from "../../../theme";
import {
  confirmSessionExtension,
  createSessionExtensionPaymentIntent,
  fetchSessionExtensionQuote,
} from "../sessionExtensionApi";
import { fetchWalletBalance, verifyWalletPin } from "../../wallet/walletApi";

const EXTEND_PROMPT_SECONDS = 120;

type Props = {
  visible: boolean;
  sessionId: string;
  remainingSeconds: number | null;
  onDismiss: () => void;
  onExtended: () => void;
};

export function SessionExtensionModal({
  visible,
  sessionId,
  remainingSeconds,
  onDismiss,
  onExtended,
}: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [minutes, setMinutes] = useState(15);
  const [quoteAmount, setQuoteAmount] = useState<number | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [payWithWallet, setPayWithWallet] = useState(true);
  const [pinSessionToken, setPinSessionToken] = useState<string | null>(null);

  const userStripeId = String((user as Record<string, unknown>)?.stripe_account_id ?? "");

  const loadQuote = useCallback(async () => {
    if (!sessionId || !visible) return;
    setQuoteLoading(true);
    setQuoteError(null);
    try {
      const quote = await fetchSessionExtensionQuote(sessionId, minutes);
      if (!quote.allowed) {
        setQuoteError(quote.reason ?? "Extension not available right now.");
        setQuoteAmount(null);
      } else {
        setQuoteAmount(quote.amount);
      }
    } catch (e: any) {
      setQuoteError(
        e?.response?.data?.error ?? e?.message ?? "Could not load extension price."
      );
      setQuoteAmount(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [sessionId, minutes, visible]);

  useEffect(() => {
    if (visible) void loadQuote();
  }, [visible, loadQuote]);

  const handlePayAndExtend = async () => {
    if (!sessionId) return;
    setPaying(true);
    try {
      let paymentIntentId: string | null = null;

      if (quoteAmount != null && quoteAmount > 0 && payWithWallet) {
        const bal = await fetchWalletBalance();
        const availableMinor = bal.balances?.available_minor ?? 0;
        const needMinor = Math.round(quoteAmount * 100);
        if (availableMinor >= needMinor) {
          await confirmSessionExtension({
            sessionId,
            minutes,
            payment_method: "wallet",
            pin_session_token: pinSessionToken,
          });
          Alert.alert("Session extended", `Added ${minutes} more minutes (paid from wallet).`);
          onExtended();
          onDismiss();
          return;
        }
      }

      if (quoteAmount != null && quoteAmount > 0 && !payWithWallet) {
        const intentData = await createSessionExtensionPaymentIntent({
          sessionId,
          minutes,
          customer: userStripeId || undefined,
        });

        if (!intentData?.skip) {
          const clientSecret = intentData.client_secret;
          if (!clientSecret) throw new Error("No payment client secret returned.");
          const { error: initErr } = await initPaymentSheet({
            paymentIntentClientSecret: clientSecret,
            merchantDisplayName: "NetQwix",
          });
          if (initErr) throw new Error(initErr.message);
          const { error: payErr } = await presentPaymentSheet();
          if (payErr) {
            if (payErr.code !== "Canceled") throw new Error(payErr.message);
            setPaying(false);
            return;
          }
          paymentIntentId = intentData.id ?? null;
        }
      }

      await confirmSessionExtension({
        sessionId,
        minutes,
        payment_intent_id: paymentIntentId,
        payment_method: paymentIntentId ? "card" : undefined,
      });

      Alert.alert("Session extended", `Added ${minutes} more minutes to your lesson.`);
      onExtended();
      onDismiss();
    } catch (e: any) {
      Alert.alert(
        "Extension failed",
        e?.response?.data?.error ??
          e?.response?.data?.message ??
          e?.message ??
          "Could not extend the session."
      );
    } finally {
      setPaying(false);
    }
  };

  const inWindow =
    remainingSeconds != null &&
    (remainingSeconds <= EXTEND_PROMPT_SECONDS || remainingSeconds <= 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={[styles.backdrop, { paddingBottom: insets.bottom + space.md }]}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Ionicons name="time-outline" size={22} color={colors.brandNavy} />
            <Text style={styles.title}>Extend this lesson</Text>
            <Pressable onPress={onDismiss} hitSlop={12}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <Text style={styles.sub}>
            {inWindow
              ? "Add more time without leaving the call. Payment is charged now."
              : "Extension unlocks when 2 minutes or less remain."}
          </Text>

          <View style={styles.chipRow}>
            {INSTANT_LESSON_DURATIONS.map((opt) => (
              <Pressable
                key={opt.minutes}
                style={[styles.chip, minutes === opt.minutes && styles.chipActive]}
                onPress={() => setMinutes(opt.minutes)}
              >
                <Text
                  style={[styles.chipText, minutes === opt.minutes && styles.chipTextActive]}
                >
                  +{opt.minutes}m
                </Text>
              </Pressable>
            ))}
          </View>

          {quoteAmount != null && quoteAmount > 0 ? (
            <View style={styles.payRow}>
              <Pressable
                style={[styles.payChip, payWithWallet && styles.payChipActive]}
                onPress={() => setPayWithWallet(true)}
              >
                <Text style={styles.payChipText}>Wallet</Text>
              </Pressable>
              <Pressable
                style={[styles.payChip, !payWithWallet && styles.payChipActive]}
                onPress={() => setPayWithWallet(false)}
              >
                <Text style={styles.payChipText}>Card</Text>
              </Pressable>
            </View>
          ) : null}

          {quoteLoading ? (
            <ActivityIndicator color={colors.brandNavy} style={{ marginVertical: space.md }} />
          ) : quoteError ? (
            <Text style={styles.error}>{quoteError}</Text>
          ) : (
            <Text style={styles.price}>
              {quoteAmount != null && quoteAmount > 0
                ? `$${quoteAmount.toFixed(2)}`
                : "Free"}
            </Text>
          )}

          <Button
            label={paying ? "Processing…" : `Pay & add ${minutes} min`}
            onPress={handlePayAndExtend}
            disabled={!inWindow || paying || quoteLoading || !!quoteError}
            fullWidth
          />
        </View>
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
