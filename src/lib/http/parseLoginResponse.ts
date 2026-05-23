/**
 * Parses NetQwix login JSON from `authController.login` → `res.json(result)` where `result`
 * is a `ResponseBuilder` instance (`nq-backend-main`). The web app reads
 * `response.data.result.data.access_token` (see `auth.slice.js`).
 *
 * Some gateways may wrap the body — we try a few safe shapes.
 */
function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

export type LoginTokens = {
  access_token: string;
  account_type: string;
  refresh_token?: string;
  session_id?: string;
};

function readTokenBlock(block: unknown): LoginTokens | null {
  if (!isRecord(block)) return null;
  const access_token = block.access_token;
  const account_type = block.account_type;
  if (typeof access_token !== "string" || !access_token) return null;
  if (account_type === undefined || account_type === null) return null;
  const out: LoginTokens = { access_token, account_type: String(account_type) };
  if (typeof block.refresh_token === "string" && block.refresh_token) {
    out.refresh_token = block.refresh_token;
  }
  if (typeof block.session_id === "string" && block.session_id) {
    out.session_id = block.session_id;
  }
  return out;
}

export function extractLoginTokens(payload: unknown): LoginTokens | null {
  if (!isRecord(payload)) return null;

  // Primary: { result: { data: { access_token, account_type }, ... }, code, msg, status, ... }
  if (isRecord(payload.result)) {
    const direct = readTokenBlock(payload.result.data);
    if (direct) return direct;
  }

  // Wrapped: { data: { result: { data: { ... } } } }
  const outer = payload.data;
  if (isRecord(outer) && isRecord(outer.result) && isRecord(outer.result.data)) {
    const nested = readTokenBlock(outer.result.data);
    if (nested) return nested;
  }

  // { status, data: { access_token, ... } } — /auth/refresh, /auth/sessions/register
  if (isRecord(outer)) {
    const fromData = readTokenBlock(outer);
    if (fromData) return fromData;
  }

  // Rare flat shape
  const flat = readTokenBlock(payload);
  if (flat) return flat;

  return null;
}

/** For debugging when the server shape changes. */
export function summarizeLoginPayloadKeys(payload: unknown): string {
  if (!isRecord(payload)) return typeof payload;
  const keys = Object.keys(payload);
  const result = payload.result;
  const inner = isRecord(result) ? Object.keys(result) : [];
  return `top:[${keys.join(",")}] result:[${inner.join(",")}]`;
}
