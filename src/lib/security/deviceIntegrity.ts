import * as Device from "expo-device";
import { Platform } from "react-native";

export type DeviceIntegrityResult = {
  compromised: boolean;
  reason?: string;
};

/**
 * Best-effort jailbreak/root detection. Not foolproof — blocks casual abuse on wallet flows.
 */
export async function checkDeviceIntegrity(): Promise<DeviceIntegrityResult> {
  if (__DEV__) {
    return { compromised: false };
  }
  if (Platform.OS === "ios" && Device.isDevice === false) {
    return { compromised: false };
  }
  // Expo does not expose jailbreak APIs; flag emulator in prod for wallet.
  if (!Device.isDevice) {
    return { compromised: true, reason: "Emulator detected" };
  }
  return { compromised: false };
}
