import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
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
import { queryKeys } from "../../../lib/queryKeys";
import { useWalletBalance } from "../hooks/useWalletBalance";
import { PinPad } from "../security/PinPad";
import { savePinSession } from "../security/pinSessionStore";
import { useShellHeaderTitle } from "../../../navigation/useShellHeaderTitle";

export function WalletSecurityScreen() {
  const { t } = useTranslation();
  useShellHeaderTitle(t("wallet.security"));
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
  const [bioLabel, setBioLabel] = useState(() => t("wallet.biometricsDefault"));
  const [busy, setBusy] = useState(false);

  const pinSet = balance?.pinSet;

  useEffect(() => {
    void isBiometricWalletEnabled().then(setBiometricOn);
    void biometricWalletLabel().then(setBioLabel);
    void checkDeviceIntegrity().then((r) => {
      if (r.compromised) {
        Alert.alert(
          t("wallet.deviceSecurity"),
          r.reason ?? t("wallet.deviceSecurityCompromised")
        );
      }
    });
    setMode(pinSet ? "verify" : "set");
  }, [pinSet, t]);

  const handleSetFlow = async () => {
    if (mode === "set") {
      if (pin.length !== 6) {
        Alert.alert(t("wallet.pinAlertTitle"), t("wallet.pinEnter6"));
        return;
      }
      setMode("confirm");
      setConfirmPin("");
      return;
    }
    if (mode === "confirm") {
      if (confirmPin !== pin) {
        Alert.alert(t("wallet.pinAlertTitle"), t("wallet.pinMismatch"));
        setPin("");
        setConfirmPin("");
        setMode("set");
        return;
      }
      setBusy(true);
      try {
        await setWalletPin(pin);
        Alert.alert(t("wallet.pinSetAlertTitle"), t("wallet.pinSetSuccess"));
        setPin("");
        setConfirmPin("");
        setMode("verify");
        void queryClient.invalidateQueries({ queryKey: queryKeys.wallet.all });
      } catch (e: unknown) {
        Alert.alert(
          t("wallet.errorTitle"),
          (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
            (e as Error).message
        );
      } finally {
        setBusy(false);
      }
    }
  };

  const handleVerify = async () => {
    if (pin.length !== 6) {
      Alert.alert(t("wallet.pinAlertTitle"), t("wallet.pinEnterYour6"));
      return;
    }
    const okBio = await requireBiometricForWallet(t("wallet.verifyWalletPinPrompt"), {
      failClosed: false,
    });
    if (!okBio) return;
    setBusy(true);
    try {
      const res = await verifyWalletPin(pin);
      if (res.pinSessionToken) await savePinSession(res.pinSessionToken);
      Alert.alert(t("wallet.verified"), t("wallet.verifiedBody"));
      setPin("");
    } catch (e: unknown) {
      Alert.alert(
        t("wallet.errorTitle"),
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          (e as Error).message
      );
    } finally {
      setBusy(false);
    }
  };

  const activePin = mode === "confirm" ? confirmPin : pin;
  const onPinChange = mode === "confirm" ? setConfirmPin : setPin;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.sub}>
        {pinSet ? t("wallet.pinProtects") : t("wallet.createPin")}
      </Text>

      {!pinSet ? (
        <>
          <Text style={styles.step}>
            {mode === "set" ? t("wallet.stepChoosePin") : t("wallet.stepConfirmPin")}
          </Text>
          <PinPad value={activePin} onChange={onPinChange} disabled={busy} />
          <Button
            label={mode === "set" ? t("wallet.continue") : t("wallet.setPin")}
            onPress={handleSetFlow}
            loading={busy}
            fullWidth
          />
        </>
      ) : (
        <>
          <PinPad value={pin} onChange={setPin} disabled={busy} />
          <Button
            label={t("wallet.verifyPinSession")}
            onPress={handleVerify}
            loading={busy}
            fullWidth
          />
          <Button
            label={t("wallet.changePin")}
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
          label={
            biometricOn
              ? t("wallet.biometricProtectionOn", { label: bioLabel })
              : t("wallet.enableBiometricForWallet", { label: bioLabel })
          }
          variant="secondary"
          onPress={async () => {
            const next = !biometricOn;
            if (next) {
              const ok = await requireBiometricForWallet(
                t("wallet.enableBiometricPrompt", { label: bioLabel }),
                { failClosed: true }
              );
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
