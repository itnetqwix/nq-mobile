/** Whether a failed extension payment should cancel the accepted request. */
export function shouldCancelExtensionOnPaymentFailure(message: string): boolean {
  const m = message.toLowerCase();
  if (m.includes("expired")) return true;
  if (m.includes("not found")) return true;
  if (m.includes("not ready for payment")) return true;
  if (m.includes("conflict")) return true;
  if (m.includes("invalid minutes")) return true;
  if (m.includes("already applied")) return false;
  return false;
}
