function unwrapBookingPayload(axiosResponse: unknown): Record<string, unknown> | undefined {
  const res = axiosResponse as { data?: Record<string, unknown> } | undefined;
  const inner = res?.data;
  const d =
    inner && typeof inner === "object" && inner !== null && "data" in inner
      ? (inner as { data: Record<string, unknown> }).data
      : inner;
  if (!d || typeof d !== "object") return undefined;
  return d as Record<string, unknown>;
}

export type InstantBookingMeta = {
  lessonId?: string;
  acceptDeadlineAt?: number;
};

/** Axios response from `apiClient.post` — API body is `response.data` (sometimes nested `data`). */
export function parseInstantBookingMeta(axiosResponse: unknown): InstantBookingMeta {
  const d = unwrapBookingPayload(axiosResponse);
  if (!d) return {};

  let lessonId: string | undefined;
  const bid = (d as { bookingId?: unknown }).bookingId;
  if (bid != null) {
    const id =
      typeof bid === "object" && bid !== null
        ? (bid as { _id?: unknown; id?: unknown })._id ?? (bid as { id?: unknown }).id
        : bid;
    if (id != null && id !== "") lessonId = String(id);
  }
  if (!lessonId) {
    const booking =
      (d as { booking?: unknown; result?: unknown }).booking ??
      (d as { result?: unknown }).result;
    const b = booking as { _id?: unknown; id?: unknown } | null | undefined;
    const fromBooking = b?._id ?? b?.id;
    if (fromBooking != null && fromBooking !== "") lessonId = String(fromBooking);
  }
  if (!lessonId && (d as { _id?: unknown })._id) {
    lessonId = String((d as { _id: unknown })._id);
  }

  let acceptDeadlineAt: number | undefined;
  const rawDeadline =
    (d as { acceptDeadlineAt?: unknown }).acceptDeadlineAt ??
    (d as { booking?: { accept_deadline_at?: unknown } }).booking?.accept_deadline_at;
  if (rawDeadline != null) {
    const ms = new Date(String(rawDeadline)).getTime();
    if (!Number.isNaN(ms)) acceptDeadlineAt = ms;
  }

  return { lessonId, acceptDeadlineAt };
}

export function parseInstantBookingLessonId(axiosResponse: unknown): string | undefined {
  return parseInstantBookingMeta(axiosResponse).lessonId;
}
