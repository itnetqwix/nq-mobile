import { apiClient } from "../../api/client";
import { API_ROUTES } from "../../config/apiRoutes";
import { idempotencyHeaders, newIdempotencyKey } from "../../lib/idempotency";

export type WalletBalance = {
  walletAccountId: string;
  currency: string;
  status: string;
  pinSet: boolean;
  payoutPreference?: string;
  balances: {
    available: number;
    available_minor: number;
    pending_topup: number;
    pending_release: number;
    pending_payout: number;
  };
};

export async function fetchWalletBalance(): Promise<WalletBalance> {
  const res = await apiClient.get(API_ROUTES.wallet.balance);
  return ((res.data as { data?: WalletBalance })?.data ?? res.data) as WalletBalance;
}

export type WalletLedgerPage = {
  items: Array<{
    entry_id: string;
    entry_type: string;
    amount_minor: number;
    reference_type?: string;
    reference_id?: string;
    createdAt?: string;
  }>;
  total: number;
  page: number;
  limit: number;
};

export async function fetchWalletLedger(page = 1, limit = 25): Promise<WalletLedgerPage> {
  const res = await apiClient.get(API_ROUTES.wallet.ledger, { params: { page, limit } });
  return ((res.data as { data?: WalletLedgerPage })?.data ?? res.data) as WalletLedgerPage;
}

export type WalletConfig = {
  enabled?: boolean;
  escrowEnabled?: boolean;
  walletPayEnabled?: boolean;
  topUpEnabled?: boolean;
  region?: string;
  currency?: string;
  minTopUpMinor?: number;
  maxTopUpMinor?: number;
  stepUpThresholdMinor?: number;
  regionCurrency?: Record<
    string,
    { currency: string; topUpEnabled: boolean; walletPayEnabled: boolean }
  >;
};

export async function fetchWalletConfig(billingCountry?: string): Promise<WalletConfig> {
  const res = await apiClient.get(API_ROUTES.wallet.config, {
    params: billingCountry ? { country: billingCountry } : undefined,
  });
  return ((res.data as { data?: WalletConfig })?.data ?? res.data) as WalletConfig;
}

export async function fetchWalletTransactionDetail(entryId: string) {
  const res = await apiClient.get(API_ROUTES.wallet.transactionDetail(entryId));
  return ((res.data as { data?: unknown })?.data ?? res.data) as Record<string, any>;
}

export async function fetchBookingDetail(bookingId: string) {
  const res = await apiClient.get(API_ROUTES.user.bookingById(bookingId));
  return ((res.data as { data?: unknown })?.data ?? res.data) as Record<string, any>;
}

export type TopUpIntentResult = {
  topupId?: string;
  client_secret?: string;
  id?: string;
  amount_minor?: number;
};

export type TopUpStatusResult = {
  topupId?: string;
  status: "pending" | "succeeded" | "failed" | string;
  amount_minor?: number;
  currency?: string;
  payment_intent_status?: string | null;
};

function unwrapData<T>(res: { data: unknown }): T {
  const root = res.data as { data?: T };
  return (root?.data ?? res.data) as T;
}

export async function createTopUpIntent(amountMinor: number): Promise<TopUpIntentResult> {
  const res = await apiClient.post(
    API_ROUTES.wallet.topUpCreateIntent,
    { amount_minor: amountMinor },
    { headers: idempotencyHeaders(newIdempotencyKey("topup-intent")) }
  );
  return unwrapData<TopUpIntentResult>(res);
}

export async function fetchTopUpStatus(topupId: string): Promise<TopUpStatusResult> {
  const res = await apiClient.get(API_ROUTES.wallet.topUpStatus(topupId));
  return unwrapData<TopUpStatusResult>(res);
}

export async function confirmTopUp(topupId: string): Promise<{ status: string; processed?: boolean }> {
  const res = await apiClient.post(API_ROUTES.wallet.topUpConfirm(topupId), undefined, {
    headers: idempotencyHeaders(`topup-confirm-${topupId}`),
  });
  return unwrapData<{ status: string; processed?: boolean }>(res);
}

/** Poll until top-up succeeds or times out (webhook + client confirm). */
export async function waitForTopUpSettled(
  topupId: string,
  options?: { maxAttempts?: number; intervalMs?: number }
): Promise<"succeeded" | "failed" | "timeout"> {
  const maxAttempts = options?.maxAttempts ?? 15;
  const intervalMs = options?.intervalMs ?? 2000;

  for (let i = 0; i < maxAttempts; i++) {
    await confirmTopUp(topupId).catch(() => undefined);
    const status = await fetchTopUpStatus(topupId);
    if (status.status === "succeeded") return "succeeded";
    if (status.status === "failed") return "failed";
    if (status.payment_intent_status === "canceled") return "failed";
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return "timeout";
}

export async function setWalletPin(pin: string) {
  const normalized = String(pin ?? "").trim();
  if (!/^\d{6}$/.test(normalized)) {
    throw new Error("PIN must be exactly 6 digits.");
  }
  const res = await apiClient.post(API_ROUTES.wallet.pinSet, { pin: normalized });
  const body = res.data as { status?: string; error?: string; data?: unknown };
  if (body?.status === "FAIL" || body?.error) {
    throw new Error(body.error ?? "Could not set wallet PIN.");
  }
  return res.data;
}

export async function verifyWalletPin(pin: string) {
  const normalized = String(pin ?? "").trim();
  if (!/^\d{6}$/.test(normalized)) {
    throw new Error("PIN must be exactly 6 digits.");
  }
  const res = await apiClient.post(API_ROUTES.wallet.pinVerify, { pin: normalized });
  return ((res.data as { data?: { pinSessionToken?: string } })?.data ?? res.data) as {
    pinSessionToken?: string;
  };
}

export async function updatePayoutPreference(preference: "wallet_fast" | "bank_standard") {
  const res = await apiClient.put(API_ROUTES.wallet.payoutPreference, { preference });
  return res.data;
}

export async function requestWithdraw(amountMinor: number, method: "bank" | "wallet_internal") {
  const res = await apiClient.post(
    API_ROUTES.wallet.withdraw,
    { amount_minor: amountMinor, method },
    { headers: idempotencyHeaders(newIdempotencyKey("withdraw")) }
  );
  return res.data;
}

export async function fetchTrainerEarnings() {
  const res = await apiClient.get(API_ROUTES.wallet.earnings);
  return ((res.data as { data?: WalletBalance })?.data ?? res.data) as WalletBalance;
}

export type TrainerPulse = {
  currency: string;
  earnings_this_week: number;
  earnings_last_week: number;
  delta_amount: number;
  delta_percent: number | null;
  active_students_30d: number;
  new_students_this_week: number;
  sessions_this_week: number;
};

export async function fetchTrainerPulse(): Promise<TrainerPulse> {
  const res = await apiClient.get(API_ROUTES.wallet.trainerPulse);
  const data = (res.data as { data?: TrainerPulse })?.data ?? res.data;
  return data as TrainerPulse;
}

export type EarningsSeriesPoint = {
  key: string;
  label: string;
  start: string | null;
  end: string | null;
  total: number;
};

export type EarningsSeries = {
  range: "weekly" | "monthly";
  currency: string;
  series: EarningsSeriesPoint[];
  total: number;
};

export async function fetchTrainerEarningsSeries(
  range: "weekly" | "monthly"
): Promise<EarningsSeries> {
  const res = await apiClient.get(API_ROUTES.wallet.trainerEarningsSeries, {
    params: { range },
  });
  const data = (res.data as { data?: EarningsSeries })?.data ?? res.data;
  return data as EarningsSeries;
}

export function buildTrainerEarningsCsvUrl(
  range: "weekly" | "monthly"
): string {
  return `${API_ROUTES.wallet.trainerEarningsCsv}?range=${range}`;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Saved payment methods
 * ─────────────────────────────────────────────────────────────────────────
 * The backend mirrors what Stripe returns on `PaymentMethod.list` plus a
 * `default` flag. We keep the shape small and stable so older app versions
 * keep working even if Stripe adds more brands.
 */

export type SavedPaymentMethod = {
  id: string;
  brand: "visa" | "mastercard" | "amex" | "discover" | "diners" | "jcb" | "unionpay" | "unknown" | string;
  last4: string;
  expMonth?: number;
  expYear?: number;
  isDefault?: boolean;
  /** ISO timestamp from Stripe for "added on" rows in the saved-cards UI. */
  addedAt?: string;
  /** Optional wallet provider for non-card methods (e.g. apple_pay). */
  walletType?: "apple_pay" | "google_pay" | null;
};

export async function fetchSavedPaymentMethods(): Promise<SavedPaymentMethod[]> {
  try {
    const res = await apiClient.get(API_ROUTES.wallet.paymentMethods);
    const root = res.data as { data?: SavedPaymentMethod[] | { items?: SavedPaymentMethod[] } };
    const inner = root?.data;
    if (Array.isArray(inner)) return inner;
    if (inner && Array.isArray((inner as { items?: SavedPaymentMethod[] }).items)) {
      return (inner as { items: SavedPaymentMethod[] }).items;
    }
    return Array.isArray(res.data) ? (res.data as SavedPaymentMethod[]) : [];
  } catch {
    /**
     * Returning [] keeps the saved-cards screen rendering its empty state
     * instead of an error banner — endpoint is optional on legacy backends.
     */
    return [];
  }
}

export async function deleteSavedPaymentMethod(id: string): Promise<void> {
  await apiClient.delete(API_ROUTES.wallet.paymentMethod(id));
}

export async function makePaymentMethodDefault(id: string): Promise<void> {
  await apiClient.post(API_ROUTES.wallet.paymentMethodDefault(id));
}

/* ─────────────────────────────────────────────────────────────────────────
 * Auto top-up rule
 * ─────────────────────────────────────────────────────────────────────────
 * Server stores one rule per wallet. Trainees can set a threshold (when
 * balance drops below) and a reload amount. `paymentMethodId` lets us
 * charge silently — falls back to the default card if missing.
 */

export type AutoTopUpRule = {
  enabled: boolean;
  /** Threshold in minor units of the wallet currency. */
  thresholdMinor: number;
  /** Reload amount in minor units. */
  reloadMinor: number;
  /** Stripe payment-method id used for the silent charge. */
  paymentMethodId?: string | null;
  /** Server-issued snapshot of when the rule last fired. */
  lastTriggeredAt?: string | null;
  /** "succeeded" | "failed" | "pending" for the last attempt. */
  lastStatus?: "succeeded" | "failed" | "pending" | null;
  currency?: string;
};

export async function fetchAutoTopUpRule(): Promise<AutoTopUpRule | null> {
  try {
    const res = await apiClient.get(API_ROUTES.wallet.autoTopUp);
    const root = res.data as { data?: AutoTopUpRule | null };
    return (root?.data ?? null) as AutoTopUpRule | null;
  } catch {
    return null;
  }
}

export async function saveAutoTopUpRule(rule: Partial<AutoTopUpRule>): Promise<AutoTopUpRule> {
  const res = await apiClient.put(API_ROUTES.wallet.autoTopUp, rule);
  return ((res.data as { data?: AutoTopUpRule })?.data ?? res.data) as AutoTopUpRule;
}

export async function disableAutoTopUpRule(): Promise<void> {
  await apiClient.delete(API_ROUTES.wallet.autoTopUp);
}

/* ─────────────────────────────────────────────────────────────────────────
 * Refund + payment timeline
 * ─────────────────────────────────────────────────────────────────────────
 * One transaction can produce multiple events: charged → refund initiated
 * → bank settlement → received. Each event has an ISO timestamp and an
 * optional payload (Stripe charge id, bank reference, etc.).
 */

export type RefundTimelineEvent = {
  id?: string;
  /**
   * Backend uses a short kebab key like "charge", "refund-initiated",
   * "refund-bank", "refund-completed", "withdrawal-bank", "payout-paid".
   * Unknown keys fall through to a generic icon so future event types
   * still render gracefully.
   */
  type: string;
  /** Human label fallback if the client doesn't translate `type`. */
  label?: string;
  timestamp?: string | null;
  status?: "pending" | "completed" | "failed" | string;
  detail?: string | null;
  /** Optional Stripe / bank reference id. */
  reference?: string | null;
};

export type RefundTimelineResponse = {
  /** Sorted oldest → newest. */
  events: RefundTimelineEvent[];
  /** Mirror of the underlying transaction's currency. */
  currency?: string;
};

export async function fetchRefundTimeline(id: string): Promise<RefundTimelineResponse> {
  try {
    const res = await apiClient.get(API_ROUTES.wallet.refundTimeline(id));
    const root = (res.data as { data?: RefundTimelineResponse })?.data ?? res.data;
    const events = (root as { events?: RefundTimelineEvent[] })?.events ?? [];
    const currency = (root as { currency?: string })?.currency;
    return { events: Array.isArray(events) ? events : [], currency };
  } catch {
    /**
     * Returning empty keeps the timeline UI hidden gracefully on backends
     * that don't expose the endpoint yet — same behaviour as before but
     * without a thrown error logged in dev.
     */
    return { events: [] };
  }
}
