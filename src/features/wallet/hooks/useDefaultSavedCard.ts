import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import {
  fetchSavedPaymentMethods,
  type SavedPaymentMethod,
} from "../walletApi";

function formatBrand(brand: string): string {
  const b = String(brand || "card").toLowerCase();
  if (b === "amex") return "Amex";
  if (b === "mastercard") return "Mastercard";
  if (b === "visa") return "Visa";
  if (b === "discover") return "Discover";
  return b.charAt(0).toUpperCase() + b.slice(1);
}

export function formatSavedCardLabel(card: SavedPaymentMethod): string {
  return `${formatBrand(card.brand)} •••• ${card.last4}`;
}

/** Default saved PM for checkout hints (does not pre-select Payment Sheet). */
export function useDefaultSavedCard(enabled = true) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.wallet.paymentMethods,
    queryFn: fetchSavedPaymentMethods,
    enabled,
    staleTime: 120_000,
  });
  const defaultCard =
    data?.find((c) => c.isDefault) ?? (data && data.length > 0 ? data[0] : undefined);
  return {
    defaultCard,
    label: defaultCard ? formatSavedCardLabel(defaultCard) : null,
    isLoading,
    hasSavedCards: (data?.length ?? 0) > 0,
  };
}
