import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../../../components/ui";
import { space, typography, useThemedStyles } from "../../../theme";
import {
  biometricWalletLabel,
  isBiometricWalletEnabled,
  requireBiometricForWallet,
  setBiometricWalletEnabled,
} from "../../../lib/security/biometricGate";
import { checkDeviceIntegrity } from "../../../lib/security/deviceIntegrity";
import { setWalletPin, verifyWalletPin } from "../walletApi";
import { useWalletBalance } from "../hooks/useWalletBalance";
import { PinPad } from "../security/PinPad";
import { savePinSession } from "../security/pinSessionStore";
import { useShellHeaderTitle } from "../../../navigation/useShellHeaderTitle";

export function WalletSecurityScreen() {
  useShellHeaderTitle("Security");
  const styles = useThemedStyles((c) =>
    StyleSheet.create({
      root: { flex: 1, backgroundColor: c.surface },
      content: { padding: space.lg, gap: space.md },
      sub: { ...typography.bodySm, color: c.textMuted, lineHeight: 20 },
      step: { ...typography.label, color: c.textMuted, fontWeight: "600" },
    })
  );

  const queryClient = useQueryClient();
  const { data: balance } = useWalletBalance();
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [mode, setMode] = useState<"set" | "confirm" | "verify">("verify");
  const [biometricOn, setBiometricOn] = useState(false);
  const [bioLabel, setBioLabel] = useState("Biometrics");
  const [busy, setBusy] = useState(false);

  const pinSet = balance?.pinSet;

  useEffect(() => {
    void isBiometricWalletEnabled().then(setBiometricOn);
    void biometricWalletLabel().then(setBioLabel);
    void checkDeviceIntegrity().then((r) => {
      if (r.compromised) {
        Alert.alert("Device security", r.reason ?? "This device may not be secure for wallet actions.");
      }
    });
    setMode(pinSet ? "verify" : "set");
  }, [pinSet]);

  const handleSetFlow = async () => {
    if (mode === "set") {
      if (pin.length !== 6) {
        Alert.alert("PIN", "Enter a 6-digit PIN");
        return;
      }
      setMode("confirm");
      setConfirmPin("");
      return;
    }
    if (mode === "confirm") {
      if (confirmPin !== pin) {
        Alert.alert("PIN", "PINs do not match. Try again.");
        setPin("");
        setConfirmPin("");
        setMode("set");
        return;
      }
      setBusy(true);
      try {
        await setWalletPin(pin);
        Alert.alert("PIN set", "Your wallet PIN is active.");
        setPin("");
        setConfirmPin("");
        setMode("verify");
        void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      } catch (e: unknown) {
        Alert.alert("Error", (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? (e as Error).message);
      } finally {
        setBusy(false);
      }
    }
  };

  const handleVerify = async () => {
    if (pin.length !== 6) {
      Alert.alert("PIN", "Enter your 6-digit PIN");
      return;
    }
    const okBio = await requireBiometricForWallet("Verify wallet PIN", { failClosed: false });
    if (!okBio) return;
    setBusy(true);
    try {
      const res = await verifyWalletPin(pin);
      if (res.pinSessionToken) await savePinSession(res.pinSessionToken);
      Alert.alert("Verified", "PIN session active for 15 minutes.");
      setPin("");
    } catch (e: unknown) {
      Alert.alert("Error", (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const activePin = mode === "confirm" ? confirmPin : pin;
  const onPinChange = mode === "confirm" ? setConfirmPin : setPin;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.sub}>
        {pinSet
          ? "Your PIN protects larger payments. Verify before booking or withdrawing."
          : "Create a 6-digit PIN to secure wallet payments."}
      </Text>

      {!pinSet ? (
        <>
          <Text style={styles.step}>{mode === "set" ? "Step 1 of 2 — Choose PIN" : "Step 2 of 2 — Confirm PIN"}</Text>
          <PinPad value={activePin} onChange={onPinChange} disabled={busy} />
          <Button
            label={mode === "set" ? "Continue" : "Set PIN"}
            onPress={handleSetFlow}
            loading={busy}
            fullWidth
          />
        </>
      ) : (
        <>
          <PinPad value={pin} onChange={setPin} disabled={busy} />
          <Button label="Verify PIN (15 min session)" onPress={handleVerify} loading={busy} fullWidth />
          <Button
            label="Change PIN"
            variant="secondary"
            onPress={() => {
              setMode("set");
              setPin("");
              setConfirmPin("");
            }}
            fullWidth
          />
        </>
      )}

      <View style={{ marginTop: space.md }}>
        <Button
          label={biometricOn ? `${bioLabel} protection: On` : `Enable ${bioLabel} for wallet`}
          variant="secondary"
          onPress={async () => {
            const next = !biometricOn;
            if (next) {
              const ok = await requireBiometricForWallet(`Enable ${bioLabel}`, { failClosed: true });
              if (!ok) return;
            }
            await setBiometricWalletEnabled(next);
            setBiometricOn(next);
          }}
          fullWidth
        />
      </View>
    </ScrollView>
  );
}
