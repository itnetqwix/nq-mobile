import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { unwrapApiData } from "../../../lib/http/unwrapApiData";

export type TrainerPromoRow = {
  _id: string;
  code: string;
  description?: string;
  display_label?: string;
  discount_type: "percentage" | "fixed_amount";
  discount_value: number;
  min_order_amount?: number;
  max_discount_amount?: number;
  start_date: string;
  end_date: string;
  usage_limit: number;
  usage_count: number;
  per_user_limit: number;
  applicable_booking_types?: string[];
  is_active: boolean;
  is_visible: boolean;
  sponsor_type: "trainer";
};

export type TrainerPromoForm = {
  code: string;
  description?: string;
  display_label?: string;
  discount_type: "percentage" | "fixed_amount";
  discount_value: number;
  min_order_amount?: number;
  max_discount_amount?: number;
  start_date: string;
  end_date: string;
  usage_limit?: number;
  per_user_limit?: number;
  applicable_booking_types?: ("instant" | "scheduled" | "all")[];
  is_active?: boolean;
  is_visible?: boolean;
};

export async function fetchTrainerPromoCodes(): Promise<TrainerPromoRow[]> {
  const res = await apiClient.get(API_ROUTES.trainer.promoCodes);
  const data = unwrapApiData<{ promos?: TrainerPromoRow[] }>(res);
  return Array.isArray(data?.promos) ? data.promos : [];
}

export async function createTrainerPromoCode(body: TrainerPromoForm): Promise<TrainerPromoRow> {
  const res = await apiClient.post(API_ROUTES.trainer.promoCodes, {
    ...body,
    start_date: new Date(body.start_date).toISOString(),
    end_date: new Date(`${body.end_date}T23:59:59`).toISOString(),
  });
  return unwrapApiData<TrainerPromoRow>(res);
}

export async function updateTrainerPromoCode(
  id: string,
  body: Partial<TrainerPromoForm>
): Promise<TrainerPromoRow> {
  const payload = { ...body };
  if (body.start_date) payload.start_date = new Date(body.start_date).toISOString() as any;
  if (body.end_date) {
    payload.end_date = new Date(`${body.end_date}T23:59:59`).toISOString() as any;
  }
  const res = await apiClient.put(`${API_ROUTES.trainer.promoCodes}/${id}`, payload);
  return unwrapApiData<TrainerPromoRow>(res);
}

export async function toggleTrainerPromoCode(id: string): Promise<TrainerPromoRow> {
  const res = await apiClient.patch(API_ROUTES.trainer.promoCodeToggle(id));
  return unwrapApiData<TrainerPromoRow>(res);
}

export function buildCoachPromoShareMessage(code: string, label?: string): string {
  const hint = label?.trim() ? ` (${label})` : "";
  return `Book a session with me on NetQwix and use code ${code}${hint} at checkout. Valid for my sessions only.`;
}
