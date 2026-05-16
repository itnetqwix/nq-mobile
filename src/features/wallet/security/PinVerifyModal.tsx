import React, { useState } from "react";
import { Alert, Modal, StyleSheet, Text, View } from "react-native";
import { Button } from "../../../components/ui";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { requireBiometricForWallet } from "../../../lib/security/biometricGate";
import { space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { verifyWalletPin } from "../walletApi";
import { savePinSession } from "./pinSessionStore";
import { PinPad } from "./PinPad";

type Props = {
  visible: boolean;
  title?: string;
  onClose: () => void;
  onVerified: (pinSessionToken: string) => void;
};

export function PinVerifyModal({
  visible,
  title = "Enter wallet PIN",
  onClose,
  onVerified,
}: Props) {
  const c = useThemeColors();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const styles = useThemedStyles((palette) =>
    StyleSheet.create({
      backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
      sheet: {
        backgroundColor: palette.background,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: space.lg,
        paddingBottom: space.xl,
      },
      title: { ...typography.titleSm, color: palette.text, textAlign: "center", marginBottom: space.sm },
      sub: { ...typography.bodySm, color: palette.textMuted, textAlign: "center", marginBottom: space.md },
    })
  );

  const submit = async () => {
    if (pin.length !== 6) {
      Alert.alert("PIN", "Enter your 6-digit PIN");
      return;
    }
    const okBio = await requireBiometricForWallet(title, { failClosed: false });
    if (!okBio) return;
    setBusy(true);
    try {
      const res = await verifyWalletPin(pin);
      const token = res.pinSessionToken;
      if (!token) throw new Error("No PIN session returned");
      await savePinSession(token);
      setPin("");
      onVerified(token);
    } catch (e) {
      Alert.alert("PIN verification failed", getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>Payments over your step-up limit require your PIN.</Text>
          <PinPad value={pin} onChange={setPin} disabled={busy} />
          <Button label="Confirm PIN" onPress={submit} loading={busy} fullWidth />
          <Button label="Cancel" variant="ghost" onPress={onClose} fullWidth style={{ marginTop: space.sm }} />
        </View>
      </View>
    </Modal>
  );
}
