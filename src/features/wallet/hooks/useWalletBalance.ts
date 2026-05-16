import { useQuery } from "@tanstack/react-query";
import { fetchWalletBalance, type WalletBalance } from "../walletApi";

export function useWalletBalance(enabled = true) {
  return useQuery<WalletBalance>({
    queryKey: ["wallet", "balance"],
    queryFn: fetchWalletBalance,
    staleTime: 45_000,
    enabled,
  });
}
