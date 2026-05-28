/**
 * Admin-driven Tips + Banners (Phase 2 items 5 & 17).
 *
 * Tips render as a horizontal carousel on the dashboard.
 * Banners render as a single dismissible card at the top of the dashboard
 * (and as a guest-visible banner on the login screen — that fetch is made
 * without auth so the response can include guest-targeted rows).
 */

import axios from "axios";
import { apiClient } from "../../../api/client";
import { API_BASE_URL } from "../../../config/env";
import { API_ROUTES } from "../../../config/apiRoutes";

export type Tip = {
  _id: string;
  title: string;
  body: string;
  image_url?: string | null;
  icon?: string | null;
  audience: "all" | "trainer" | "trainee";
  cta_label?: string | null;
  cta_url?: string | null;
  sort_order: number;
  is_active: boolean;
  start_date?: string | null;
  end_date?: string | null;
};

export type HomeBanner = {
  _id: string;
  title: string;
  body: string;
  image_url?: string | null;
  audience: Array<"guest" | "trainer" | "trainee" | "all">;
  severity: "info" | "promo" | "maintenance" | "critical" | "success";
  cta_label?: string | null;
  cta_url?: string | null;
  dismissible: boolean;
  is_active: boolean;
  sort_order: number;
};

function unwrap<T>(raw: unknown): T[] {
  const body = raw as any;
  const data = body?.data ?? body?.result ?? body;
  if (Array.isArray(data)) return data as T[];
  return [];
}

export async function fetchHomeTips(opts?: { guest?: boolean }): Promise<Tip[]> {
  try {
    if (opts?.guest) {
      const res = await axios.get(`${API_BASE_URL}${API_ROUTES.tips.list}`, {
        timeout: 15_000,
      });
      return unwrap<Tip>(res.data);
    }
    const res = await apiClient.get(API_ROUTES.tips.list, {
      _skipAuthSignOut: true,
    });
    return unwrap<Tip>(res.data);
  } catch {
    return [];
  }
}

export async function fetchHomeBanners(opts?: {
  guest?: boolean;
}): Promise<HomeBanner[]> {
  try {
    if (opts?.guest) {
      const res = await axios.get(`${API_BASE_URL}${API_ROUTES.banners.list}`, {
        timeout: 15_000,
      });
      return unwrap<HomeBanner>(res.data);
    }
    const res = await apiClient.get(API_ROUTES.banners.list, {
      _skipAuthSignOut: true,
    });
    return unwrap<HomeBanner>(res.data);
  } catch {
    return [];
  }
}
