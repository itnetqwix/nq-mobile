import type { ChatDeliveryStatus } from "../components/ChatMessageStatus";

/** Normalize API / socket status strings for outgoing message ticks. */
export function normalizeOutgoingStatus(
  raw?: string | null,
  pending?: boolean
): ChatDeliveryStatus {
  if (pending) return "sending";
  const s = (raw ?? "sent").toLowerCase();
  if (s === "read" || s === "delivered" || s === "sent" || s === "failed") {
    return s as ChatDeliveryStatus;
  }
  if (s === "sending") return "sending";
  return "sent";
}

/** Apply delivered/read upgrade only forward (never downgrade). */
export function mergeOutgoingStatus(
  current: string | undefined,
  incoming: ChatDeliveryStatus
): ChatDeliveryStatus {
  const order: ChatDeliveryStatus[] = ["sending", "sent", "delivered", "read", "failed"];
  const cur = normalizeOutgoingStatus(current);
  if (cur === "failed" || incoming === "failed") return "failed";
  const curIdx = order.indexOf(cur);
  const incIdx = order.indexOf(incoming);
  return incIdx > curIdx ? incoming : cur;
}
