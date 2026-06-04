import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { AccountType } from "../../../constants/accountType";

export type ReferralRewardPreview = {
  referrerSignupMinor: number;
  refereeSignupMinor: number;
  referrerFirstBookingMinor: number;
};

export type ReferralRewardPreviewPoints = {
  referrerSignupPoints: number;
  refereeSignupPoints: number;
  referrerFirstBookingPoints: number;
};

export type ReferralProgram = {
  enabled: boolean;
  currency: string;
  accountType: string;
  referrerName: string;
  referralCode: string;
  webLink: string;
  legacyWebLink: string;
  appLink: string;
  rewardMatrix: {
    inviteTrainee: ReferralRewardPreview;
    inviteTrainer: ReferralRewardPreview;
  };
  rewardMatrixPoints?: {
    inviteTrainee: ReferralRewardPreviewPoints;
    inviteTrainer: ReferralRewardPreviewPoints;
  };
  pointsEnabled?: boolean;
  redemptionBlockPoints?: number;
  walletDollarsPer100Points?: number;
  stats: {
    invitesSent: number;
    registered: number;
    totalEarnedMinor?: number;
    totalEarnedPoints?: number;
    pointsBalance?: number;
  };
};

export type ReferralInviteResult = {
  email: string;
  ok: boolean;
  error?: string;
};

export type ReferralInviteRow = {
  _id?: string;
  email?: string;
  createdAt?: string;
  joined?: boolean;
  joinedAt?: string | null;
  joinedUserId?: string | null;
  joinedAccountType?: string | null;
  targetAccountType?: string;
  status?: string;
};

function unwrapData<T>(res: { data?: unknown }): T {
  const root = res.data as Record<string, unknown> | undefined;
  const inner = (root?.data ?? root?.result ?? root) as Record<string, unknown> | undefined;
  const payload = (inner?.data ?? inner) as T;
  return payload;
}

export async function fetchReferralProgram(): Promise<ReferralProgram | null> {
  try {
    const res = await apiClient.get(API_ROUTES.referral.program);
    return unwrapData<ReferralProgram>(res);
  } catch {
    return null;
  }
}

export async function fetchReferralResolve(code: string): Promise<{
  referralCode: string;
  referrerUserId: string;
  referrerName: string;
  referrerAccountType: string;
} | null> {
  try {
    const res = await apiClient.get(API_ROUTES.referral.resolve(code));
    return unwrapData(res);
  } catch {
    return null;
  }
}

export async function postReferralInvites(
  emails: string[],
  targetAccountType: typeof AccountType.TRAINEE | typeof AccountType.TRAINER
): Promise<{ results: ReferralInviteResult[] }> {
  const res = await apiClient.post(API_ROUTES.referral.invite, {
    emails,
    targetAccountType,
  });
  return unwrapData(res);
}

export async function fetchReferralInvites(): Promise<ReferralInviteRow[]> {
  try {
    const res = await apiClient.get(API_ROUTES.referral.invites);
    const rows = unwrapData<ReferralInviteRow[]>(res);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export type CheckoutPreview = {
  originalPrice: number;
  promoDiscount: number;
  referralDiscount: number;
  totalDiscount: number;
  finalPrice: number;
  referralEligible: boolean;
  promoSponsorType?: "platform" | "trainer" | null;
  label?: string | null;
  stacksWithPromo?: boolean;
};

export async function fetchReferralBenefits(): Promise<{
  firstLessonCheckout?: { eligible: boolean; estimatedDiscountDollars?: number };
} | null> {
  try {
    const res = await apiClient.get(API_ROUTES.referral.benefits);
    return unwrapData(res);
  } catch {
    return null;
  }
}

export async function postReferralPreviewCheckout(body: {
  amount: number;
  booking_type: "instant" | "scheduled";
  coupon_code?: string;
  trainer_id?: string;
}): Promise<CheckoutPreview | null> {
  try {
    const res = await apiClient.post(API_ROUTES.referral.previewCheckout, body);
    return unwrapData<CheckoutPreview>(res);
  } catch {
    return null;
  }
}

export function formatUsdFromMinor(minor: number, currency = "USD"): string {
  if (!minor || minor <= 0) return "—";
  const amount = minor / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(0)}`;
  }
}
