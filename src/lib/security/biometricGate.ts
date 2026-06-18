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

export async function isDeviceBiometricAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && enrolled;
}

export async function biometricWalletLabel(): Promise<string> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const hasFingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
  const hasIris = types.includes(LocalAuthentication.AuthenticationType.IRIS);

  if (hasFace && hasFingerprint) {
    return Platform.OS === "ios" ? "Face ID or Touch ID" : "Face or fingerprint";
  }
  if (hasFace) {
    return Platform.OS === "ios" ? "Face ID" : "Face unlock";
  }
  if (hasFingerprint) {
    return Platform.OS === "ios" ? "Touch ID" : "Fingerprint";
  }
  if (hasIris) {
    return "Iris unlock";
  }
  return "Biometrics";
}

type GateOptions = {
  /** When true, deny action if biometrics unavailable (wallet-sensitive). */
  failClosed?: boolean;
};

/** Prompt the device biometric UI (Face ID, Touch ID, fingerprint, etc.). */
export async function promptDeviceBiometric(
  actionLabel: string,
  options?: GateOptions
): Promise<boolean> {
  const available = await isDeviceBiometricAvailable();
  if (!available) {
    return options?.failClosed ? false : true;
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: actionLabel,
    cancelLabel: "Cancel",
    disableDeviceFallback: options?.failClosed ?? false,
    fallbackLabel: Platform.OS === "ios" ? "Use passcode" : undefined,
  });
  return result.success;
}

export async function requireBiometricForWallet(
  actionLabel: string,
  options?: GateOptions
): Promise<boolean> {
  const enabled = await isBiometricWalletEnabled();
  if (!enabled) return true;
  return promptDeviceBiometric(actionLabel, options);
}
