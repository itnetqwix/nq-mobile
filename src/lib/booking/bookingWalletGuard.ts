import { Alert } from "react-native";
import { fetchWalletBalance, fetchWalletConfig } from "../../features/wallet/walletApi";

/**
 * Soft guard before the payment step: if wallet pay is enabled and balance
 * is below the lesson price, offer top-up without blocking card payment.
 */
export async function confirmProceedToPaymentIfWalletShort(
  priceDollars: number,
  onAddFunds?: (shortfall: number) => void
): Promise<boolean> {
  if (priceDollars <= 0) return true;
  try {
    const [balance, config] = await Promise.all([fetchWalletBalance(), fetchWalletConfig()]);
    const walletEnabled = config?.walletPayEnabled !== false && config?.enabled !== false;
    if (!walletEnabled) return true;

    const available = balance?.balances?.available ?? 0;
    if (available >= priceDollars) return true;

    const shortfall = Math.max(0, priceDollars - available);
    return await new Promise<boolean>((resolve) => {
      Alert.alert(
        "Wallet balance",
        `You have $${available.toFixed(2)} available but this lesson is $${priceDollars.toFixed(2)}. Add funds or pay with card on the next step.`,
        [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          {
            text: "Add funds",
            onPress: () => {
              onAddFunds?.(shortfall);
              resolve(false);
            },
          },
          { text: "Continue", onPress: () => resolve(true) },
        ]
      );
    });
  } catch {
    return true;
  }
}
