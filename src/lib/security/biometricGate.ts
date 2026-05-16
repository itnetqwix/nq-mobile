import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const BIOMETRIC_WALLET_KEY = "nq.wallet.biometric.enabled";

export async function isBiometricWalletEnabled(): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(BIOMETRIC_WALLET_KEY);
    return v === "1";
  } catch {
    return false;
  }
}

export async function setBiometricWalletEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_WALLET_KEY, enabled ? "1" : "0");
}

export async function biometricWalletLabel(): Promise<string> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return Platform.OS === "ios" ? "Face ID" : "Face unlock";
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return "Fingerprint";
  }
  return "Biometrics";
}

type GateOptions = {
  /** When true, deny action if biometrics unavailable (wallet-sensitive). */
  failClosed?: boolean;
};

export async function requireBiometricForWallet(
  actionLabel: string,
  options?: GateOptions
): Promise<boolean> {
  const enabled = await isBiometricWalletEnabled();
  if (!enabled) return true;

  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();

  if (!hasHardware || !enrolled) {
    return options?.failClosed ? false : true;
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: actionLabel,
    cancelLabel: "Cancel",
    disableDeviceFallback: options?.failClosed ?? false,
  });
  return result.success;
}
