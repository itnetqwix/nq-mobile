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

export async function createTopUpIntent(amountMinor: number) {
  const res = await apiClient.post(API_ROUTES.wallet.topUpCreateIntent, {
    amount_minor: amountMinor,
  });
  return ((res.data as { data?: { client_secret?: string; id?: string } })?.data ??
    res.data) as { client_secret?: string; id?: string };
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
