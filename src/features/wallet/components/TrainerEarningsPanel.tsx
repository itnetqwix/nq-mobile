import React, { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../../components/ui";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import {
  fetchTrainerEarnings,
  requestWithdraw,
  updatePayoutPreference,
} from "../walletApi";

export function TrainerEarningsPanel() {
  const c = useThemeColors();
  const styles = useThemedStyles((c) => StyleSheet.create({
  card: {
    backgroundColor: c.surfaceElevated,
    borderRadius: radii.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: c.border,
    gap: space.sm,
  },
  label: { ...typography.caption, color: c.textMuted },
  amount: { fontSize: 32, fontWeight: "700", color: c.text },
  sub: { ...typography.bodySm, color: c.textMuted },
  section: { ...typography.subtitle, marginTop: space.md, fontWeight: "600", color: c.text },
  chips: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
  input: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    padding: space.md,
    backgroundColor: c.surface,
  },
}));

  const queryClient = useQueryClient();
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const { data: earnings } = useQuery({
    queryKey: ["wallet", "earnings"],
    queryFn: fetchTrainerEarnings,
  });

  const preference = earnings?.payoutPreference ?? "wallet_fast";

  const handlePreference = async (pref: "wallet_fast" | "bank_standard") => {
    try {
      await updatePayoutPreference(pref);
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      Alert.alert("Saved", pref === "wallet_fast" ? "Fast wallet settlement enabled." : "Bank payout selected.");
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.error ?? e?.message);
    }
  };

  const handleWithdraw = async () => {
    const dollars = parseFloat(withdrawAmount);
    if (!Number.isFinite(dollars) || dollars < 1) {
      Alert.alert("Invalid amount", "Enter a valid withdrawal amount.");
      return;
    }
    try {
      await requestWithdraw(
        Math.round(dollars * 100),
        preference === "bank_standard" ? "bank" : "wallet_internal"
      );
      Alert.alert("Submitted", "Withdrawal request submitted.");
      setWithdrawAmount("");
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.error ?? e?.message);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Available to withdraw</Text>
      <Text style={styles.amount}>${(earnings?.balances?.available ?? 0).toFixed(2)}</Text>
      <Text style={styles.sub}>
        Pending release: ${(earnings?.balances?.pending_release ?? 0).toFixed(2)}
      </Text>

      <Text style={styles.section}>Payout preference</Text>
      <View style={styles.chips}>
        <Button
          label="Fast wallet"
          onPress={() => handlePreference("wallet_fast")}
          variant={preference === "wallet_fast" ? "primary" : "secondary"}
        />
        <Button
          label="Bank"
          onPress={() => handlePreference("bank_standard")}
          variant={preference === "bank_standard" ? "primary" : "secondary"}
        />
      </View>

      <Text style={styles.section}>Withdraw</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        placeholder="Amount (USD)"
        value={withdrawAmount}
        onChangeText={setWithdrawAmount}
      />
      <Button label="Request withdrawal" onPress={handleWithdraw} fullWidth />
    </View>
  );
}


