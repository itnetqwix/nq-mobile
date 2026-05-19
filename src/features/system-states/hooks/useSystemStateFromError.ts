import type { AxiosError } from "axios";
import type { SystemStateId } from "../presets/types";

export function systemStateIdFromHttpStatus(status?: number): SystemStateId | null {
  if (!status) return null;
  if (status === 401) return "session_expired";
  if (status === 403) return "unauthorized";
  if (status === 404) return "not_found";
  if (status === 429) return "too_many_login_attempts";
  if (status === 503) return "service_unavailable";
  if (status >= 500) return "server_error";
  return null;
}

export function systemStateIdFromError(err: unknown): SystemStateId | null {
  const ax = err as AxiosError & { code?: string };
  if (ax?.code === "ERR_NETWORK" || ax?.message === "Network Error") {
    return "offline";
  }
  if (ax?.response?.status) {
    return systemStateIdFromHttpStatus(ax.response.status);
  }
  return null;
}

export function isMaintenanceResponse(err: unknown): boolean {
  const ax = err as AxiosError<{ maintenance?: boolean }>;
  if (ax?.response?.headers?.["x-maintenance"] === "1") return true;
  if (ax?.response?.data?.maintenance) return true;
  if (process.env.EXPO_PUBLIC_MAINTENANCE_MODE === "1") return true;
  return false;
}
