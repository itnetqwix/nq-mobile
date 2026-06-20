import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../../../components/ui";
import { space, typography, useThemedStyles } from "../../../theme";
import {
  biometricWalletLabel,
  isBiometricWalletEnabled,
  isDeviceBiometricAvailable,
  promptDeviceBiometric,
  requireBiometricForWallet,
  setBiometricWalletEnabled,
} from "../../../lib/security/biometricGate";
import { checkDeviceIntegrity } from "../../../lib/security/deviceIntegrity";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
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
      loading: { paddingVertical: space.xl, alignItems: "center" },
    })
  );

  const queryClient = useQueryClient();
  const { data: balance, isLoading: balanceLoading, isFetching: balanceFetching } =
    useWalletBalance();
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [mode, setMode] = useState<"set" | "confirm" | "verify">("set");
  const [biometricOn, setBiometricOn] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioLabel, setBioLabel] = useState(() => t("wallet.biometricsDefault"));
  const [busy, setBusy] = useState(false);

  const pinSet = balance?.pinSet === true;
  const balanceReady = !balanceLoading && balance != null;
  const inPinCreation = !pinSet || mode === "set" || mode === "confirm";

  useEffect(() => {
    void isBiometricWalletEnabled().then(setBiometricOn);
    void biometricWalletLabel().then(setBioLabel);
    void isDeviceBiometricAvailable().then(setBioAvailable);
    void checkDeviceIntegrity().then((r) => {
      if (r.compromised) {
        Alert.alert(
          t("wallet.deviceSecurity"),
          r.reason ?? t("wallet.deviceSecurityCompromised")
        );
      }
    });
  }, [t]);

  useEffect(() => {
    if (!balanceReady) return;
    setMode((current) => {
      if (current === "set" || current === "confirm") return current;
      return pinSet ? "verify" : "set";
    });
  }, [pinSet, balanceReady]);

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
        await queryClient.invalidateQueries({ queryKey: queryKeys.wallet.all });
        Alert.alert(t("wallet.pinSetAlertTitle"), t("wallet.pinSetSuccess"));
        setPin("");
        setConfirmPin("");
        setMode("verify");
      } catch (e: unknown) {
        Alert.alert(
          t("wallet.errorTitle"),
          getApiErrorMessage(e, t("wallet.pinSetFailed", { defaultValue: "Could not set PIN." }))
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
      if (!res.pinSessionToken) {
        throw new Error("No PIN session returned. Try again.");
      }
      await savePinSession(res.pinSessionToken);
      Alert.alert(t("wallet.verified"), t("wallet.verifiedBody"));
      setPin("");
    } catch (e: unknown) {
      Alert.alert(
        t("wallet.errorTitle"),
        getApiErrorMessage(e, t("wallet.pinVerifyFailed", { defaultValue: "Could not verify PIN." }))
      );
    } finally {
      setBusy(false);
    }
  };

  const activePin = mode === "confirm" ? confirmPin : pin;
  const onPinChange = mode === "confirm" ? setConfirmPin : setPin;

  if (!balanceReady) {
    return (
      <View style={[styles.root, styles.loading]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.sub}>
        {inPinCreation && pinSet
          ? t("wallet.changePinHint", {
              defaultValue: "Choose a new 6-digit PIN, then confirm it.",
            })
          : pinSet
            ? t("wallet.pinProtects")
            : t("wallet.createPin")}
      </Text>

      {inPinCreation ? (
        <>
          <Text style={styles.step}>
            {mode === "set" ? t("wallet.stepChoosePin") : t("wallet.stepConfirmPin")}
          </Text>
          <PinPad value={activePin} onChange={onPinChange} disabled={busy || balanceFetching} />
          <Button
            label={mode === "set" ? t("wallet.continue") : t("wallet.setPin")}
            onPress={handleSetFlow}
            loading={busy}
            fullWidth
          />
          {pinSet ? (
            <Button
              label={t("wallet.cancel", { defaultValue: "Cancel" })}
              variant="secondary"
              onPress={() => {
                setMode("verify");
                setPin("");
                setConfirmPin("");
              }}
              disabled={busy}
              fullWidth
            />
          ) : null}
        </>
      ) : (
        <>
          <PinPad value={pin} onChange={setPin} disabled={busy || balanceFetching} />
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
        {bioAvailable ? (
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
                const ok = await promptDeviceBiometric(
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
        ) : (
          <Text style={styles.sub}>
            {t("wallet.biometricsUnavailable", {
              defaultValue: "Biometric unlock is not available on this device.",
            })}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}
