import { apiClient } from "../../api/client";
import { API_ROUTES } from "../../config/apiRoutes";
import { idempotencyHeaders, stableIdempotencyKey } from "../../lib/idempotency";
import { unwrapApiData } from "../../lib/http/unwrapApiData";

export type CheckSlotResponse = {
  isAvailable?: boolean;
  availableSlots?: Array<{ start: string; end: string }>;
  message?: string;
  trainerTimezone?: string;
  traineeTimezone?: string;
};

export async function fetchDayAvailability(params: {
  trainerId: string;
  bookedDateIso: string;
  traineeTimeZone: string;
}): Promise<CheckSlotResponse> {
  const res = await apiClient.post(API_ROUTES.trainee.checkSlot, {
    trainer_id: params.trainerId,
    booked_date: params.bookedDateIso,
    traineeTimeZone: params.traineeTimeZone,
    slotTime: { from: "00:00", to: "23:59" },
  });
  return unwrapApiData<CheckSlotResponse>(res);
}

export async function validateSlotRange(params: {
  trainerId: string;
  bookedDateIso: string;
  traineeTimeZone: string;
  from: string;
  to: string;
}): Promise<CheckSlotResponse> {
  const res = await apiClient.post(API_ROUTES.trainee.checkSlot, {
    trainer_id: params.trainerId,
    booked_date: params.bookedDateIso,
    traineeTimeZone: params.traineeTimeZone,
    slotTime: { from: params.from, to: params.to },
  });
  return unwrapApiData<CheckSlotResponse>(res);
}

export type HoldSlotResponse = {
  held?: boolean;
  expiresInMinutes?: number;
  message?: string;
};

export async function holdScheduledSlot(params: {
  trainerId: string;
  bookedDateIso: string;
  traineeTimeZone: string;
  from: string;
  to: string;
}): Promise<HoldSlotResponse> {
  const res = await apiClient.post(API_ROUTES.trainee.holdScheduledSlot, {
    trainer_id: params.trainerId,
    booked_date: params.bookedDateIso,
    traineeTimeZone: params.traineeTimeZone,
    session_start_time: params.from,
    session_end_time: params.to,
  });
  return unwrapApiData<HoldSlotResponse>(res);
}

export type BookSessionPayload = {
  trainer_id: string;
  status: "booked";
  booked_date: string;
  session_start_time: string;
  session_end_time: string;
  charging_price: number;
  time_zone: string;
  coupon_code?: string;
  payment_method?: "wallet" | "mixed";
  wallet_amount?: number;
  pin_session_token?: string;
  payment_intent_id?: string;
  quote_id?: string;
};

export async function bookScheduledSession(
  payload: BookSessionPayload,
  idempotencyKey?: string
): Promise<unknown> {
  const key =
    idempotencyKey ??
    stableIdempotencyKey(
      "book-scheduled",
      payload.trainer_id,
      payload.booked_date,
      payload.session_start_time,
      payload.session_end_time
    );
  const res = await apiClient.post(API_ROUTES.trainee.bookSession, payload, {
    headers: idempotencyHeaders(key),
  });
  const body = (res as { data?: unknown })?.data ?? res;
  return (body as { result?: unknown })?.result ?? body;
}
