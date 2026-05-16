import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

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

export async function requireBiometricForWallet(actionLabel: string): Promise<boolean> {
  const enabled = await isBiometricWalletEnabled();
  if (!enabled) return true;

  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return true;

  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!enrolled) return true;

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: actionLabel,
    cancelLabel: "Cancel",
    disableDeviceFallback: false,
  });
  return result.success;
}
