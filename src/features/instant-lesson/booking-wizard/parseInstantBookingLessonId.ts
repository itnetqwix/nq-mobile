/** Axios response from `apiClient.post` — API body is `response.data` (sometimes nested `data`). */
export function parseInstantBookingLessonId(axiosResponse: unknown): string | undefined {
  const res = axiosResponse as { data?: Record<string, unknown> } | undefined;
  const inner = res?.data;
  const d =
    inner && typeof inner === "object" && inner !== null && "data" in inner
      ? (inner as { data: Record<string, unknown> }).data
      : inner;
  if (!d || typeof d !== "object") return undefined;
  const bid = (d as { bookingId?: unknown }).bookingId;
  if (bid != null) {
    const id =
      typeof bid === "object" && bid !== null
        ? (bid as { _id?: unknown; id?: unknown })._id ?? (bid as { id?: unknown }).id
        : bid;
    if (id != null && id !== "") return String(id);
  }
  const booking = (d as { booking?: unknown; result?: unknown }).booking ?? (d as { result?: unknown }).result;
  const b = booking as { _id?: unknown; id?: unknown } | null | undefined;
  const fromBooking = b?._id ?? b?.id;
  if (fromBooking != null && fromBooking !== "") return String(fromBooking);
  if ((d as { _id?: unknown })._id) return String((d as { _id: unknown })._id);
  return undefined;
}
