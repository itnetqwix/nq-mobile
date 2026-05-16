import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getPinSessionToken } from "../security/pinSessionStore";
import { fetchWalletConfig } from "../walletApi";
import { useWalletBalance } from "./useWalletBalance";

export function useWalletPaymentOption(priceDollars: number, enabled = true) {
  const { data: balance, refetch: refetchBalance } = useWalletBalance(enabled);
  const [storedPinToken, setStoredPinToken] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    void getPinSessionToken().then(setStoredPinToken);
  }, [enabled, balance?.pinSet]);
  const { data: config } = useQuery({
    queryKey: ["wallet", "config"],
    queryFn: fetchWalletConfig,
    staleTime: 300_000,
    enabled,
  });

  const available = balance?.balances?.available ?? 0;
  const walletPayEnabled = config?.walletPayEnabled !== false && config?.enabled !== false;
  const shortfall = Math.max(0, priceDollars - available);
  const canPayWithWallet = walletPayEnabled && priceDollars > 0 && available >= priceDollars;
  const needsPin =
    priceDollars > 0 &&
    (config?.stepUpThresholdMinor ?? 5000) / 100 <= priceDollars &&
    balance?.pinSet;

  return {
    available,
    walletPayEnabled,
    canPayWithWallet,
    shortfall,
    needsPin,
    pinSet: balance?.pinSet,
    storedPinToken,
    refetchBalance,
  };
}
