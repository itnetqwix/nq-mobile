import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../../components/ui";
import { colors, radii, space, typography } from "../../../theme";
import {
  fetchTrainerEarnings,
  requestWithdraw,
  updatePayoutPreference,
} from "../walletApi";

export function TrainerEarningsScreen() {
  const queryClient = useQueryClient();
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const { data: earnings, isLoading } = useQuery({
    queryKey: ["wallet", "earnings"],
    queryFn: fetchTrainerEarnings,
  });

  const preference = earnings?.payoutPreference ?? "wallet_fast";

  const handlePreference = async (pref: "wallet_fast" | "bank_standard") => {
    try {
      await updatePayoutPreference(pref);
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      Alert.alert(
        "Saved",
        pref === "wallet_fast"
          ? "Fast wallet settlement (~24h after session clearance)."
          : "Bank payout (typically 7–10 business days)."
      );
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

  if (isLoading) return null;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.label}>Available to withdraw</Text>
        <Text style={styles.amount}>${(earnings?.balances?.available ?? 0).toFixed(2)}</Text>
        <Text style={styles.sub}>
          Pending release: ${(earnings?.balances?.pending_release ?? 0).toFixed(2)}
        </Text>
      </View>

      <Text style={styles.section}>Payout preference</Text>
      <View style={styles.chips}>
        <Button
          label="Fast wallet (~24h)"
          onPress={() => handlePreference("wallet_fast")}
          variant={preference === "wallet_fast" ? "primary" : "secondary"}
        />
        <Button
          label="Bank (7–10 days)"
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, gap: space.md },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    padding: space.lg,
  },
  label: { ...typography.label, color: colors.textMuted },
  amount: { ...typography.displaySm, color: colors.brandNavy },
  sub: { ...typography.bodySm, color: colors.textMuted, marginTop: space.sm },
  section: { ...typography.titleSm, color: colors.text },
  chips: { gap: space.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: space.sm,
    backgroundColor: colors.surface,
  },
});
