import { Alert } from "react-native";
import { fetchWalletBalance, fetchWalletConfig } from "../../features/wallet/walletApi";

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Math.max(0, amount));
}

/**
 * Soft guard before the payment step: if wallet pay is enabled and balance
 * is below the lesson price, offer top-up without blocking card payment.
 */
/**
 * @param priceDollars Lesson total including fees/taxes when known (quote charge total).
 */
export async function confirmProceedToPaymentIfWalletShort(
  priceDollars: number,
  onAddFunds?: (shortfall: number) => void,
  billingCountry?: string
): Promise<boolean> {
  const required = Math.max(0, Number(priceDollars) || 0);
  if (required <= 0) return true;
  try {
    const [balance, config] = await Promise.all([
      fetchWalletBalance(),
      fetchWalletConfig(billingCountry),
    ]);
    const walletEnabled = config?.walletPayEnabled !== false && config?.enabled !== false;
    if (!walletEnabled) return true;

    const available = balance?.balances?.available ?? 0;
    if (available >= required) return true;

    const shortfall = Math.max(0, required - available);
    return await new Promise<boolean>((resolve) => {
      Alert.alert(
        "Wallet balance",
        `You have ${formatUsd(available)} available but this lesson is ${formatUsd(required)}. Add funds or pay with card on the next step.`,
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
