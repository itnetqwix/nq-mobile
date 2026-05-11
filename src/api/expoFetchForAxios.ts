import { fetch as expoFetch } from "expo/fetch";
import type { FetchRequestInit } from "expo/fetch";

/**
 * Turn the axios-built `Request` body into bytes once. Do not use `Request.clone()` +
 * `.text()` here: on Hermes/iOS the clone stream can read as empty while Metro still logs
 * `config.data` from the axios interceptor, and the API returns `email should not be empty`.
 */
async function materializeRequestBody(req: Request): Promise<Uint8Array | undefined> {
  if (req.body == null) return undefined;
  const method = (req.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") return undefined;

  const ab = await req.arrayBuffer();
  return ab.byteLength > 0 ? new Uint8Array(ab) : undefined;
}

/**
 * Axios's fetch adapter calls `fetch(new Request(url, init), fetchOptions)`. Expo's
 * `expo/fetch` only accepts a URL string and uses a native client — unwrap `Request`
 * so HTTPS hits the same stack as other Expo networking (often works when RN XHR
 * gets `ERR_NETWORK` against CDN/WAF‑locked APIs).
 */
export async function expoFetchForAxios(
  input: string | URL | Request,
  init?: RequestInit
): Promise<Response> {
  if (typeof input === "string" || input instanceof URL) {
    return expoFetch(String(input), stripNonExpoInit(init)) as unknown as Promise<Response>;
  }

  const req = input as Request;
  const serialized = await materializeRequestBody(req);

  const headers = new Headers(req.headers);
  headers.delete("content-length");

  const base: FetchRequestInit = {
    method: req.method,
    headers,
    signal: req.signal,
    redirect: req.redirect,
    credentials: req.credentials === "include" ? "include" : "omit",
  };

  const extra = stripNonExpoInit(init);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (key === "duplex") continue;
      /** Axios passes the same `Request` as arg1; arg2 must not replace our materialized bytes. */
      if (key === "body") continue;
      if (value !== undefined) {
        (base as Record<string, unknown>)[key] = value;
      }
    }
  }

  if (serialized !== undefined) {
    base.body = serialized as BodyInit;
  }

  return expoFetch(req.url, base) as unknown as Promise<Response>;
}

function stripNonExpoInit(init?: RequestInit): FetchRequestInit | undefined {
  if (!init) return undefined;
  const { duplex: _duplex, ...rest } = init as RequestInit & { duplex?: string };
  return rest as FetchRequestInit;
}
