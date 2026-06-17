export type WalletPaymentOptionInput = {
  priceDollars: number;
  availableDollars: number;
  walletPayEnabled: boolean;
  stepUpThresholdMinor?: number;
  pinSet?: boolean;
};

export function computeWalletPaymentOption({
  priceDollars,
  availableDollars,
  walletPayEnabled,
  stepUpThresholdMinor = 5000,
  pinSet = false,
}: WalletPaymentOptionInput) {
  const price = Math.max(0, Number(priceDollars) || 0);
  const available = Math.max(0, Number(availableDollars) || 0);
  const enabled = walletPayEnabled !== false;
  const shortfall = Math.max(0, price - available);
  const canPayWithWallet = enabled && price > 0 && available >= price;
  const needsPin =
    price > 0 && stepUpThresholdMinor / 100 <= price && Boolean(pinSet);

  return {
    available,
    walletPayEnabled: enabled,
    canPayWithWallet,
    shortfall,
    needsPin,
    pinSet: Boolean(pinSet),
  };
}
