import axios from "axios";
import { API_BASE_URL } from "../config/env";
import { getBrowserLikeRequestHeaders } from "./browserRequestHeaders";
import { emitSessionExpired, emitUnauthorized } from "../lib/auth/sessionEvents";
import { isMaintenanceResponse } from "../features/system-states/hooks/useSystemStateFromError";
import { assertCertificatePinningAllowed } from "../lib/security/certPinning";
import { getAccessToken, getSessionId } from "../features/auth/session/tokenStorage";
import { getClientSessionHeaders } from "../features/auth/session/clientSessionHeaders";
import { expoFetchForAxios } from "./expoFetchForAxios";
import { logHttpErrorDebug, logHttpRequestDebug, logHttpResponseDebug } from "./httpDebug";

/** Opt in with `EXPO_PUBLIC_USE_EXPO_FETCH=1` — Expo native fetch can drop POST bodies on some iOS/Hermes paths; default uses RN’s stack (reliable JSON login). */
const useExpoNativeFetch = process.env.EXPO_PUBLIC_USE_EXPO_FETCH === "1";

/**
 * TLS + HTTP fingerprint that matches the production website (see browser devtools / curl).
 * Bare RN requests (no Origin / browser UA) are often dropped by edge WAFs → `ERR_NETWORK`
 * with no HTTP status even though curl and the web app work.
 */
const axiosDefaults = {
  baseURL: API_BASE_URL,
  timeout: 60_000,
  /** Expo native client does not support `same-origin` credentials the way browsers do. */
  withCredentials: false,
  headers: {
    ...getBrowserLikeRequestHeaders(),
    "Content-Type": "application/json",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "cross-site",
  },
} as const;

/** Set `EXPO_PUBLIC_USE_EXPO_FETCH=1` for Expo native fetch (TLS / some WAFs); leave unset for default RN networking. */
export const apiClient = axios.create(
  useExpoNativeFetch
    ? {
        ...axiosDefaults,
        adapter: "fetch" as const,
        env: { fetch: expoFetchForAxios },
      }
    : { ...axiosDefaults }
);

apiClient.interceptors.request.use(async (config) => {
  if (!assertCertificatePinningAllowed()) {
    return Promise.reject(
      Object.assign(new Error("Secure connection unavailable. Update the app or contact support."), {
        code: "CERT_PINNING_BLOCKED",
      })
    );
  }
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const sessionId = await getSessionId();
  if (sessionId) {
    config.headers["X-NQ-Session-Id"] = sessionId;
  }
  Object.assign(config.headers, getClientSessionHeaders());
  logHttpRequestDebug(config);
  return config;
});

apiClient.interceptors.response.use(
  (res) => {
    logHttpResponseDebug(res);
    return res;
  },
  async (error) => {
    logHttpErrorDebug(error);
    if (error?.response?.status === 401) {
      error.isUnauthorized = true;
      emitSessionExpired();
      emitUnauthorized();
    }
    if (isMaintenanceResponse(error)) {
      error.isMaintenance = true;
    }
    return Promise.reject(error);
  }
);
