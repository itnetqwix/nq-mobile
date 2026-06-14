import { updateBookedSessionStatus } from "../home/api/homeApi";
import {
  enqueueOfflineAction,
  registerOfflineActionExecutor,
  type OfflineAction,
  type OfflineActionResult,
} from "../../lib/offline/offlineActionQueue";

export const SESSION_STATUS_OFFLINE_KIND = "session.status";

type SessionStatusPayload = {
  sessionId: string;
  status: "confirmed" | "canceled";
};

function isSessionStatusPayload(
  payload: Record<string, unknown>
): payload is SessionStatusPayload {
  const status = payload.status;
  return (
    typeof payload.sessionId === "string" &&
    payload.sessionId.length > 0 &&
    (status === "confirmed" || status === "canceled")
  );
}

async function executeSessionStatus(
  action: OfflineAction
): Promise<OfflineActionResult> {
  if (!isSessionStatusPayload(action.payload)) return "drop";
  await updateBookedSessionStatus(
    action.payload.sessionId,
    action.payload.status
  );
  return "done";
}

registerOfflineActionExecutor(SESSION_STATUS_OFFLINE_KIND, executeSessionStatus);

export async function enqueueOfflineSessionStatusUpdate(
  sessionId: string,
  status: SessionStatusPayload["status"]
): Promise<void> {
  await enqueueOfflineAction(
    SESSION_STATUS_OFFLINE_KIND,
    { sessionId, status },
    `session-status:${sessionId}:${status}`
  );
}

export function isNetworkRequestError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  if ("response" in err && (err as { response?: unknown }).response) return false;
  const code = (err as { code?: string }).code;
  const message = (err as { message?: string }).message;
  return (
    code === "ERR_NETWORK" ||
    code === "ECONNABORTED" ||
    message === "Network Error"
  );
}
