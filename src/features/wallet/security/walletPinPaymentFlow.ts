import { Alert } from "react-native";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { navigateToWalletSecurity } from "../../../navigation/navigationRef";
import { verifyWalletPin } from "../walletApi";
import { savePinSession } from "./pinSessionStore";
import { computeWalletPaymentOption } from "../hooks/walletPaymentOptionLogic";
import { getPinSessionToken } from "./pinSessionStore";

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
      await savePinSession(token);
    } catch (e: unknown) {
      Alert.alert("Wallet payment", getApiErrorMessage(e, "Could not verify PIN."));
      return { ok: false };
    }
  }

  return { ok: true, token };
}

/** Last-line guard before booking submit when wallet / mixed pay was selected. */
export function validateWalletPinBeforeSubmit(params: {
  paymentMethod?: "wallet" | "mixed" | "card";
  chargingPrice: number;
  walletAmount?: number;
  pinSet?: boolean;
  pinSessionToken?: string | null;
}): string | null {
  if (params.paymentMethod !== "wallet" && params.paymentMethod !== "mixed") return null;
  const pinCheck =
    params.paymentMethod === "mixed"
      ? Math.max(0, Number(params.walletAmount ?? 0))
      : Math.max(0, Number(params.chargingPrice));
  const gate = computeWalletPaymentOption({
    priceDollars: params.chargingPrice,
    availableDollars: pinCheck,
    walletPayEnabled: true,
    pinSet: params.pinSet,
    pinCheckDollars: pinCheck,
  });
  if (!gate.requiresPinStepUp) return null;
  if (gate.needsPinSetup) {
    return "Set up a wallet PIN in Wallet security before paying with wallet.";
  }
  if (!params.pinSessionToken) {
    return "Verify your wallet PIN on the payment step before continuing.";
  }
  return null;
}

export async function resolvePinSessionTokenForSubmit(
  pinSessionToken?: string | null
): Promise<string | undefined> {
  if (pinSessionToken) return pinSessionToken;
  const stored = await getPinSessionToken();
  return stored ?? undefined;
}
