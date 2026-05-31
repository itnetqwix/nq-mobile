import { getSessionId } from "../../auth/session/tokenStorage";
import { getClientSessionHeaders } from "../../auth/session/clientSessionHeaders";
import { sanitizeHttpHeaderValue } from "../../../lib/http/sanitizeHttpHeaders";

/** Headers for lesson REST calls — must match socket + `lessonCallSlotStore`. */
export async function getLessonClientHeaders(): Promise<Record<string, string>> {
  const base = getClientSessionHeaders();
  const authSessionId = await getSessionId();
  if (authSessionId) {
    base["X-NQ-Auth-Session-Id"] = sanitizeHttpHeaderValue(authSessionId);
  }
  return base;
}
