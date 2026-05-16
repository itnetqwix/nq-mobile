import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../../../components/ui";
import { space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import {
  isBiometricWalletEnabled,
  requireBiometricForWallet,
  setBiometricWalletEnabled,
} from "../../../lib/security/biometricGate";
import { checkDeviceIntegrity } from "../../../lib/security/deviceIntegrity";
import { setWalletPin, verifyWalletPin } from "../walletApi";
import { useWalletBalance } from "../hooks/useWalletBalance";

export function WalletSecurityScreen() {
  const c = useThemeColors();
  const styles = useThemedStyles((c) => StyleSheet.create({
  root: { flex: 1, padding: space.lg, gap: space.md, backgroundColor: c.surface },
  title: { ...typography.titleSm, color: c.text },
  sub: { ...typography.bodySm, color: c.textMuted, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 8,
    padding: space.md,
    fontSize: 18,
    letterSpacing: 4,
    backgroundColor: c.surfaceElevated,
  },
}));

  const queryClient = useQueryClient();
  const { data: balance } = useWalletBalance();
  const [pin, setPin] = useState("");
  const [biometricOn, setBiometricOn] = useState(false);

  useEffect(() => {
    void isBiometricWalletEnabled().then(setBiometricOn);
    void checkDeviceIntegrity().then((r) => {
      if (r.compromised) {
        Alert.alert("Device security", r.reason ?? "This device may not be secure for wallet actions.");
      }
    });
  }, []);

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
    const okBio = await requireBiometricForWallet("Verify wallet PIN");
    if (!okBio) return;
    try {
      await verifyWalletPin(pin);
      Alert.alert("Verified", "PIN session active for 15 minutes.");
      setPin("");
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.error ?? e?.message);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Wallet PIN</Text>
      <Text style={styles.sub}>
        {balance?.pinSet
          ? "Your PIN protects larger payments. Verify before booking or withdrawing."
          : "Set a 6-digit PIN to secure wallet payments."}
      </Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={6}
        placeholder="6-digit PIN"
        value={pin}
        onChangeText={setPin}
      />
      <Button label="Set PIN" onPress={handleSetPin} fullWidth />
      {balance?.pinSet ? (
        <Button label="Verify PIN (15 min session)" onPress={handleVerifyPin} variant="secondary" fullWidth />
      ) : null}
      <Button
        label={biometricOn ? "Biometric protection: On" : "Enable biometric for wallet"}
        onPress={async () => {
          const next = !biometricOn;
          await setBiometricWalletEnabled(next);
          setBiometricOn(next);
        }}
        variant="ghost"
        fullWidth
      />
    </View>
  );
}


