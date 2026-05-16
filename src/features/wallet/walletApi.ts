import { apiClient } from "../../api/client";
import { API_ROUTES } from "../../config/apiRoutes";

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
  minTopUpMinor?: number;
  maxTopUpMinor?: number;
  stepUpThresholdMinor?: number;
  regionCurrency?: string;
};

export async function fetchWalletConfig(): Promise<WalletConfig> {
  const res = await apiClient.get(API_ROUTES.wallet.config);
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
  const res = await apiClient.post(API_ROUTES.wallet.topUpCreateIntent, {
    amount_minor: amountMinor,
  });
  return unwrapData<TopUpIntentResult>(res);
}

export async function fetchTopUpStatus(topupId: string): Promise<TopUpStatusResult> {
  const res = await apiClient.get(API_ROUTES.wallet.topUpStatus(topupId));
  return unwrapData<TopUpStatusResult>(res);
}

export async function confirmTopUp(topupId: string): Promise<{ status: string; processed?: boolean }> {
  const res = await apiClient.post(API_ROUTES.wallet.topUpConfirm(topupId));
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
  const res = await apiClient.post(API_ROUTES.wallet.pinSet, { pin });
  return res.data;
}

export async function verifyWalletPin(pin: string) {
  const res = await apiClient.post(API_ROUTES.wallet.pinVerify, { pin });
  return ((res.data as { data?: { pinSessionToken?: string } })?.data ?? res.data) as {
    pinSessionToken?: string;
  };
}

export async function updatePayoutPreference(preference: "wallet_fast" | "bank_standard") {
  const res = await apiClient.put(API_ROUTES.wallet.payoutPreference, { preference });
  return res.data;
}

export async function requestWithdraw(amountMinor: number, method: "bank" | "wallet_internal") {
  const res = await apiClient.post(API_ROUTES.wallet.withdraw, {
    amount_minor: amountMinor,
    method,
  });
  return res.data;
}

export async function fetchTrainerEarnings() {
  const res = await apiClient.get(API_ROUTES.wallet.earnings);
  return ((res.data as { data?: WalletBalance })?.data ?? res.data) as WalletBalance;
}
