import type { IceServer } from "./types";

/** Normalize `iceServers` from a booked-session API row. */
export function parseIceServersFromSession(session: unknown): IceServer[] | undefined {
  if (!session || typeof session !== "object") return undefined;
  const raw = (session as Record<string, unknown>).iceServers;
  if (!raw) return undefined;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.filter((s) => s && typeof s === "object") as IceServer[];
  }
  return undefined;
}
