import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useEffect, useState } from "react";
import { getPinSessionToken } from "../security/pinSessionStore";
import { fetchWalletConfig } from "../walletApi";
import { useWalletBalance } from "./useWalletBalance";
import { computeWalletPaymentOption } from "./walletPaymentOptionLogic";

export function useWalletPaymentOption(priceDollars: number, enabled = true) {
  const { data: balance, refetch: refetchBalance } = useWalletBalance(enabled);
  const [storedPinToken, setStoredPinToken] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    void getPinSessionToken().then(setStoredPinToken);
  }, [enabled, balance?.pinSet]);
  const { data: config } = useQuery({
    queryKey: queryKeys.wallet.config,
    queryFn: fetchWalletConfig,
    staleTime: 300_000,
    enabled,
  });

  const walletPayEnabled =
    config?.walletPayEnabled !== false && config?.enabled !== false;
  const option = computeWalletPaymentOption({
    priceDollars,
    availableDollars: balance?.balances?.available ?? 0,
    walletPayEnabled,
    stepUpThresholdMinor: config?.stepUpThresholdMinor,
    pinSet: balance?.pinSet,
  });

  return {
    ...option,
    storedPinToken,
    refetchBalance,
  };
}
