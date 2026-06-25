import { unwrapApiData } from "../http/unwrapApiData";

export type CreatePaymentIntentPayload = {
  skip?: boolean;
  client_secret?: string;
  id?: string;
  quoteId?: string;
};

/** Normalize create-payment-intent API responses (handles nested envelopes + skip). */
export function parseCreatePaymentIntentResponse(res: unknown): CreatePaymentIntentPayload {
  const data = unwrapApiData<Record<string, unknown>>(res);
  if (!data || typeof data !== "object") {
    throw new Error("Invalid payment response from server.");
  }

  if (data.skip === true) {
    return { skip: true };
  }

  const clientSecret =
    (typeof data.client_secret === "string" && data.client_secret.trim()) ||
    (typeof data.clientSecret === "string" && data.clientSecret.trim()) ||
    null;

  if (!clientSecret) {
    const nested =
      data.data && typeof data.data === "object"
        ? (data.data as Record<string, unknown>)
        : null;
    const nestedSecret =
      nested &&
      ((typeof nested.client_secret === "string" && nested.client_secret.trim()) ||
        (typeof nested.clientSecret === "string" && nested.clientSecret.trim()));
    if (nestedSecret) {
      return {
        skip: false,
        client_secret: nestedSecret,
        id: typeof nested.id === "string" ? nested.id : undefined,
      };
    }

    const serverMsg =
      (typeof data.error === "string" && data.error) ||
      (typeof data.message === "string" && data.message) ||
      null;
    throw new Error(serverMsg || "Payment could not be started. Please try again.");
  }

  return {
    skip: false,
    client_secret: clientSecret,
    id: typeof data.id === "string" ? data.id : undefined,
  };
}

/** Map mobile booking wizard types to backend payment intent kinds. */
export function resolvePaymentIntentBookingType(
  bookingType: "instant" | "scheduled" | "session_booking" | "session_extension"
): string {
  if (bookingType === "scheduled") return "session_booking";
  return bookingType;
}
