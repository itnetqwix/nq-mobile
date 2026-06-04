import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { unwrapApiData } from "../../../lib/http/unwrapApiData";

export type PointsBalance = {
  balance: number;
  redeemBlockPoints: number;
  minRedeemPoints: number;
  pointsPerDollar: number;
  redeemableBlocks: number;
  redeemablePoints: number;
  walletCreditPerBlock: number;
};

export type PointsLedgerEntry = {
  _id: string;
  action_key: string;
  points: number;
  balance_after: number;
  reference_type: string;
  createdAt?: string;
};

export type EarnRule = {
  actionKey: string;
  label: string;
  description: string;
  points: number;
};

export async function fetchPointsBalance(): Promise<PointsBalance | null> {
  try {
    const res = await apiClient.get(API_ROUTES.points.balance);
    return unwrapApiData<PointsBalance>(res);
  } catch {
    return null;
  }
}

export async function fetchPointsCatalog(): Promise<{
  redemption: Record<string, number>;
  earnRules: EarnRule[];
  referralNote?: string;
} | null> {
  try {
    const res = await apiClient.get(API_ROUTES.points.catalog);
    return unwrapApiData(res);
  } catch {
    return null;
  }
}

export async function fetchPointsLedger(page = 1, limit = 25) {
  try {
    const res = await apiClient.get(API_ROUTES.points.ledger, { params: { page, limit } });
    return unwrapApiData<{
      entries: PointsLedgerEntry[];
      total: number;
    }>(res);
  } catch {
    return { entries: [], total: 0 };
  }
}

export async function postRedeemPoints(points: number) {
  const res = await apiClient.post(API_ROUTES.points.redeem, { points });
  return unwrapApiData<{
    pointsSpent: number;
    walletCreditDollars: number;
    balance: number;
  }>(res);
}
