import { useStripe } from "@stripe/stripe-react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLoader } from "../../../components/brand/LoaderProvider";
import { Button } from "../../../components/ui";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { createTopUpIntent, fetchWalletBalance, fetchWalletConfig } from "../walletApi";
import { useWalletBalance } from "../hooks/useWalletBalance";

const PRESETS = [25, 50, 100];

export function WalletTopUpScreen() {
  const c = useThemeColors();
  const styles = useThemedStyles((c) => StyleSheet.create({
  content: { padding: space.lg, gap: space.md },
  label: { ...typography.subtitle, color: c.text, fontWeight: "600" },
  presets: { flexDirection: "row", gap: space.sm },
  presetChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceElevated,
  },
  presetActive: { backgroundColor: c.brandNavy, borderColor: c.brandNavy },
  presetText: { fontWeight: "600", color: c.text },
  presetTextActive: { color: "#fff" },
  input: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    padding: space.md,
    fontSize: 18,
    backgroundColor: c.surfaceElevated,
  },
}));

  const queryClient = useQueryClient();
  const { showLoader, hideLoader } = useLoader();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [amount, setAmount] = useState("25");
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { data: balance } = useWalletBalance();

  const { data: config } = useQuery({
    queryKey: ["wallet", "config"],
    queryFn: fetchWalletConfig,
    staleTime: 300_000,
  });

  const minDollars = (config?.minTopUpMinor ?? 500) / 100;
  const maxDollars = (config?.maxTopUpMinor ?? 50000) / 100;

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const pollBalanceAfterTopUp = () => {
    let attempts = 0;
    const startPending = balance?.balances?.pending_topup ?? 0;
    pollRef.current = setInterval(async () => {
      attempts += 1;
      await queryClient.invalidateQueries({ queryKey: ["wallet", "balance"] });
      const fresh = await fetchWalletBalance();
      const pending = fresh?.balances?.pending_topup ?? 0;
      if (pending <= startPending || attempts >= 4) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, 2000);
  };

  const handleTopUp = async () => {
    const dollars = parseFloat(amount);
    if (!Number.isFinite(dollars) || dollars < minDollars) {
      Alert.alert("Invalid amount", `Minimum top-up is $${minDollars.toFixed(2)}`);
      return;
    }
    if (dollars > maxDollars) {
      Alert.alert("Invalid amount", `Maximum top-up is $${maxDollars.toFixed(2)}`);
      return;
    }
    setLoading(true);
    showLoader("Processing payment…");
    try {
      const amountMinor = Math.round(dollars * 100);
      const intent = await createTopUpIntent(amountMinor);
      if (!intent?.client_secret) throw new Error("No payment secret");
      const { error: initErr } = await initPaymentSheet({
        paymentIntentClientSecret: intent.client_secret,
        merchantDisplayName: "NetQwix",
      });
      if (initErr) throw new Error(initErr.message);
      const { error: payErr } = await presentPaymentSheet();
      if (payErr && payErr.code !== "Canceled") throw new Error(payErr.message);
      if (!payErr) {
        pollBalanceAfterTopUp();
        Alert.alert("Success", "Top-up submitted. Your balance will update shortly.");
        void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      }
    } catch (e: any) {
      Alert.alert("Top-up failed", e?.message ?? "Could not complete payment");
    } finally {
      hideLoader();
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.label}>Amount (USD)</Text>
      <View style={styles.presets}>
        {PRESETS.map((p) => (
          <Pressable
            key={p}
            style={[styles.presetChip, amount === String(p) && styles.presetActive]}
            onPress={() => setAmount(String(p))}
          >
            <Text style={[styles.presetText, amount === String(p) && styles.presetTextActive]}>
              ${p}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
        placeholder={`$${minDollars} – $${maxDollars}`}
      />
      <Button label={loading ? "Processing…" : "Add funds"} onPress={handleTopUp} fullWidth disabled={loading} />
    </ScrollView>
  );
}


