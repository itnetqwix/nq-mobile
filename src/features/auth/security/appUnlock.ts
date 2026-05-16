import { Alert, Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { getAccessToken } from "../session/tokenStorage";

const APP_UNLOCK_KEY = "nq.app.biometric.unlock";

export async function isAppUnlockEnabled(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(APP_UNLOCK_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function setAppUnlockEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(APP_UNLOCK_KEY, enabled ? "1" : "0");
}

export async function biometricLabel(): Promise<string> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return Platform.OS === "ios" ? "Face ID" : "Face unlock";
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return "Fingerprint";
  }
  return "Biometrics";
}

export async function promptEnableAppUnlock(): Promise<void> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!hasHardware || !enrolled) return;
  if (await isAppUnlockEnabled()) return;

  const label = await biometricLabel();
  return new Promise((resolve) => {
    Alert.alert(
      `Enable ${label}?`,
      `Use ${label} to unlock NetQwix faster next time you open the app.`,
      [
        { text: "Not now", style: "cancel", onPress: () => resolve() },
        {
          text: "Enable",
          onPress: async () => {
            await setAppUnlockEnabled(true);
            resolve();
          },
        },
      ]
    );
  });
}

/** Returns true when the user may proceed into the app. */
export async function requireAppUnlock(): Promise<boolean> {
  const enabled = await isAppUnlockEnabled();
  if (!enabled) return true;

  const token = await getAccessToken();
  if (!token) return true;

  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return true;

  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!enrolled) return true;

  const label = await biometricLabel();
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: `Unlock NetQwix with ${label}`,
    cancelLabel: "Use password",
    disableDeviceFallback: false,
  });
  return result.success;
}
