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
