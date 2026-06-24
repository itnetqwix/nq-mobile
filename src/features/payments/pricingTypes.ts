/** Mirrors `POST /payments/quote` and extension `pricingQuote` payloads. */

export type PricingBreakdownRow = {
  key: string;
  label: string;
  amountMinor: number;
};

export type PricingQuote = {
  quoteId: string;
  chargeTotalCents: number;
  breakdown: PricingBreakdownRow[];
  trainerNetCents?: number;
  surgeCents?: number;
  surgeLabel?: string;
  walletPortionCents?: number;
  cardPortionCents?: number;
};

export function chargeTotalDollars(quote: PricingQuote | null | undefined): number | null {
  if (quote?.chargeTotalCents == null) return null;
  return quote.chargeTotalCents / 100;
}

export function feeRowsFromQuote(quote: PricingQuote | null | undefined): PricingBreakdownRow[] {
  if (!quote?.breakdown?.length) return [];
  return quote.breakdown.filter(
    (row) => row.key !== "session_subtotal" && row.key !== "total"
  );
}
