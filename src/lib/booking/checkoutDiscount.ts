function finiteAmount(value: number | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function resolveCheckoutDiscountAmount({
  expectedPrice,
  payableAmount,
  reportedTotalDiscount,
}: {
  expectedPrice: number;
  payableAmount: number;
  reportedTotalDiscount?: number | null;
}): number {
  const inferredDiscount = finiteAmount(expectedPrice) - finiteAmount(payableAmount);
  return Math.max(0, finiteAmount(reportedTotalDiscount), inferredDiscount);
}
