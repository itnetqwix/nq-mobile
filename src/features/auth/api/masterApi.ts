import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../constants/routes";
import type { MasterRow } from "./types";

/** First row matches web `master.slice` fulfilled shape. */
export async function fetchMasterRow(): Promise<MasterRow | null> {
  const res = await apiClient.get<{ data?: MasterRow[] }>(API_ROUTES.master.masterData);
  const body = res.data;
  const row = body?.data?.[0];
  return row ?? null;
}

/** Sport list from master row — same labels as web category dropdown. */
export async function fetchSportCategories(): Promise<string[]> {
  const row = await fetchMasterRow();
  const raw = row?.category;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is string => typeof c === "string")
    .map((c) => c.trim())
    .filter((c) => c.length > 0 && c !== "Choose Category");
}
