import axios, { isAxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";

function enabled(): boolean {
  return __DEV__ && process.env.EXPO_PUBLIC_DEBUG_HTTP === "1";
}

function fullUrl(config: InternalAxiosRequestConfig): string {
  try {
    return axios.getUri(config);
  } catch {
    return `${config.baseURL ?? ""}${config.url ?? ""}`;
  }
}

function redactForLog(data: unknown): unknown {
  if (data == null) return data;
  if (typeof data === "string") {
    try {
      return redactForLog(JSON.parse(data));
    } catch {
      return data.length > 200 ? `${data.slice(0, 200)}…` : data;
    }
  }
  if (typeof data !== "object") return data;
  const o = { ...(data as Record<string, unknown>) };
  if ("password" in o) o.password = "[redacted]";
  if ("token" in o) o.token = "[redacted]";
  if ("access_token" in o) o.access_token = "[redacted]";
  if ("refresh_token" in o) o.refresh_token = "[redacted]";
  return o;
}

function previewJson(data: unknown, max = 800): string {
  try {
    const s = JSON.stringify(data);
    return s.length > max ? `${s.slice(0, max)}…` : s;
  } catch {
    return String(data);
  }
}

/** Call from request interceptor after headers/body are final (Metro terminal). */
export function logHttpRequestDebug(config: InternalAxiosRequestConfig): void {
  if (!enabled()) return;
  const method = (config.method ?? "get").toUpperCase();
  const url = fullUrl(config);
  const body = config.data !== undefined ? redactForLog(config.data) : undefined;
  // eslint-disable-next-line no-console
  console.log(`[nq-mobile HTTP →] ${method} ${url}`, body !== undefined ? body : "");
}

/** Call from response success handler. */
export function logHttpResponseDebug(res: AxiosResponse): void {
  if (!enabled()) return;
  const method = (res.config.method ?? "get").toUpperCase();
  const url = fullUrl(res.config);
  // eslint-disable-next-line no-console
  console.log(
    `[nq-mobile HTTP ←] ${res.status} ${method} ${url}`,
    previewJson(redactForLog(res.data))
  );
}

/** Call from response error handler. */
export function logHttpErrorDebug(error: unknown): void {
  if (!enabled()) return;
  if (isAxiosError(error) && error.config) {
    const method = (error.config.method ?? "get").toUpperCase();
    const url = fullUrl(error.config);
    const status = error.response?.status;
    const data = error.response?.data;
    // eslint-disable-next-line no-console
    console.log(
      `[nq-mobile HTTP ✗] ${method} ${url}`,
      error.message,
      error.code ?? "",
      status != null ? status : "",
      data !== undefined ? previewJson(redactForLog(data)) : ""
    );
  } else {
    // eslint-disable-next-line no-console
    console.log("[nq-mobile HTTP ✗]", error);
  }
}
