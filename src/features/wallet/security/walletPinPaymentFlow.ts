import { Alert } from "react-native";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { navigateToWalletSecurity } from "../../../navigation/navigationRef";
import { verifyWalletPin } from "../walletApi";

type PinGateInput = {
  requiresPinStepUp?: boolean;
  needsPinSetup?: boolean;
  needsPin?: boolean;
  storedPinToken?: string | null;
};

type PinGateResult = { ok: true; token?: string } | { ok: false };

/**
 * Resolves a PIN session token for wallet payments at/above step-up threshold.
 * Guides trainees to create a PIN when none exists yet.
 */
export async function resolveWalletPinSessionForPayment(
  wallet: PinGateInput,
  pin: string,
  pinSessionToken?: string,
  options?: { onSetupPin?: () => void }
): Promise<PinGateResult> {
  if (!wallet.requiresPinStepUp) {
    return {
      ok: true,
      token: pinSessionToken ?? wallet.storedPinToken ?? undefined,
    };
  }

  if (wallet.needsPinSetup) {
    Alert.alert(
      "Set up wallet PIN",
      "Payments this size require a 6-digit wallet PIN. Create one in Wallet security, then return to complete payment.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Set up PIN",
          onPress: () => {
            if (options?.onSetupPin) options.onSetupPin();
            else navigateToWalletSecurity();
          },
        },
      ]
    );
    return { ok: false };
  }

  let token = pinSessionToken ?? wallet.storedPinToken ?? undefined;
  if (wallet.needsPin && !token) {
    if (!/^\d{6}$/.test(pin)) {
      Alert.alert("PIN required", "Enter your 6-digit wallet PIN for this payment.");
      return { ok: false };
    }
    try {
      const res = await verifyWalletPin(pin);
      token = res.pinSessionToken;
      if (!token) {
        Alert.alert("PIN required", "Could not start PIN session. Try again.");
        return { ok: false };
      }
    } catch (e: unknown) {
      Alert.alert("Wallet payment", getApiErrorMessage(e, "Could not verify PIN."));
      return { ok: false };
    }
  }

  return { ok: true, token };
}
