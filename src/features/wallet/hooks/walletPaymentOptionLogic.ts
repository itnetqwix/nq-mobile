export type WalletPaymentOptionInput = {
  priceDollars: number;
  availableDollars: number;
  walletPayEnabled: boolean;
  stepUpThresholdMinor?: number;
  pinSet?: boolean;
  pinCheckDollars?: number;
};

export function computeWalletPaymentOption({
  priceDollars,
  availableDollars,
  walletPayEnabled,
  stepUpThresholdMinor = 10000,
  pinSet = false,
  pinCheckDollars,
}: WalletPaymentOptionInput) {
  const price = Math.max(0, Number(priceDollars) || 0);
  const available = Math.max(0, Number(availableDollars) || 0);
  const enabled = walletPayEnabled !== false;
  const shortfall = Math.max(0, price - available);
  const canPayWithWallet = enabled && price > 0 && available >= price;
  const pinBasis = Math.max(0, Number(pinCheckDollars ?? price) || 0);
  const requiresPinStepUp =
    pinBasis > 0 && stepUpThresholdMinor / 100 <= pinBasis;
  const needsPinSetup = requiresPinStepUp && !pinSet;
  const needsPin = requiresPinStepUp && Boolean(pinSet);

  return {
    available,
    walletPayEnabled: enabled,
    canPayWithWallet,
    shortfall,
    requiresPinStepUp,
    needsPinSetup,
    needsPin,
    pinSet: Boolean(pinSet),
  };
}
