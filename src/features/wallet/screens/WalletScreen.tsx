import { Ionicons } from "@expo/vector-icons";
import { useStripe } from "@stripe/stripe-react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button } from "../../../components/ui";
import { useAuth } from "../../auth/context/AuthContext";
import { AccountType } from "../../../constants/accountType";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import {
  createTopUpIntent,
  fetchWalletBalance,
  fetchWalletLedger,
  setWalletPin,
  verifyWalletPin,
} from "../walletApi";

export function WalletScreen() {
  const c = useThemeColors();
  const styles = useThemedStyles((c) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },
  content: { padding: space.lg, gap: space.md },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    backgroundColor: c.surfaceElevated,
    borderRadius: radii.lg,
    padding: space.lg,
  },
  label: { ...typography.label, color: c.textMuted },
  amount: { ...typography.displaySm, color: c.brandNavy, marginTop: 4 },
  currency: { ...typography.bodySm, color: c.textMuted },
  sub: { ...typography.bodySm, color: c.textSecondary, marginTop: space.sm },
  section: { ...typography.titleSm, color: c.text, marginTop: space.md },
  hint: { ...typography.bodySm, color: c.textMuted },
  row: { flexDirection: "row", gap: space.sm, alignItems: "center" },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    padding: space.sm,
    backgroundColor: c.surface,
  },
  ledgerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  ledgerType: { ...typography.bodySm, color: c.text },
  ledgerAmt: { ...typography.label, color: c.brandNavy },
  ok: { ...typography.bodySm, color: c.success },
}));

  const { accountType } = useAuth();
  const queryClient = useQueryClient();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [topUpDollars, setTopUpDollars] = useState("25");
  const [pin, setPin] = useState("");
  const [pinSession, setPinSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isTrainee = accountType === AccountType.TRAINEE;

  const { data: balance, isLoading } = useQuery({
    queryKey: ["wallet", "balance"],
    queryFn: fetchWalletBalance,
  });

  const { data: ledger } = useQuery({
    queryKey: ["wallet", "ledger"],
    queryFn: () => fetchWalletLedger(1, 20),
  });

  const handleTopUp = async () => {
    const dollars = parseFloat(topUpDollars);
    if (!Number.isFinite(dollars) || dollars < 5) {
      Alert.alert("Invalid amount", "Minimum top-up is $5.00");
      return;
    }
    setLoading(true);
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
        Alert.alert("Success", "Wallet topped up. Balance updates in a moment.");
        void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      }
    } catch (e: any) {
      Alert.alert("Top-up failed", e?.message ?? "Could not complete payment");
    } finally {
      setLoading(false);
    }
  };

  const handleSetPin = async () => {
    if (!/^\d{6}$/.test(pin)) {
      Alert.alert("PIN", "Enter a 6-digit PIN");
      return;
    }
    try {
      await setWalletPin(pin);
      Alert.alert("PIN set", "Your wallet PIN is active.");
      setPin("");
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.error ?? e?.message);
    }
  };

  const handleVerifyPin = async () => {
    try {
      const res = await verifyWalletPin(pin);
      setPinSession(res.pinSessionToken ?? null);
      Alert.alert("Verified", "PIN session active for 15 minutes.");
      setPin("");
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.error ?? e?.message);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.brandNavy} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.label}>Available balance</Text>
        <Text style={styles.amount}>
          ${(balance?.balances?.available ?? 0).toFixed(2)}{" "}
          <Text style={styles.currency}>{balance?.currency ?? "USD"}</Text>
        </Text>
        {balance?.balances?.pending_release > 0 && (
          <Text style={styles.sub}>
            Pending release: ${balance.balances.pending_release.toFixed(2)}
          </Text>
        )}
      </View>

      {isTrainee && (
        <>
          <Text style={styles.section}>Add funds</Text>
          <View style={styles.row}>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={topUpDollars}
              onChangeText={setTopUpDollars}
              placeholder="Amount (USD)"
            />
            <Button label={loading ? "…" : "Top up"} onPress={handleTopUp} disabled={loading} />
          </View>

          <Text style={styles.section}>Wallet PIN</Text>
          <Text style={styles.hint}>
            {balance?.pinSet
              ? "Verify PIN before large payments."
              : "Set a 6-digit PIN to protect wallet spending."}
          </Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            value={pin}
            onChangeText={setPin}
            placeholder="6-digit PIN"
          />
          <View style={styles.row}>
            {!balance?.pinSet ? (
              <Button label="Set PIN" onPress={handleSetPin} />
            ) : (
              <Button label="Verify PIN" onPress={handleVerifyPin} />
            )}
          </View>
          {pinSession ? (
            <Text style={styles.ok}>PIN session active</Text>
          ) : null}
        </>
      )}

      <Text style={styles.section}>Recent activity</Text>
      {(ledger as { items?: Array<Record<string, unknown>> })?.items?.map((entry) => (
        <View key={String(entry.entry_id)} style={styles.ledgerRow}>
          <Text style={styles.ledgerType}>
            {String(entry.reference_type)} · {String(entry.entry_type)}
          </Text>
          <Text style={styles.ledgerAmt}>
            {(Number(entry.amount_minor) / 100).toFixed(2)} {String(entry.bucket)}
          </Text>
        </View>
      )) ?? (
        <Text style={styles.hint}>No ledger entries yet.</Text>
      )}
    </ScrollView>
  );
}


