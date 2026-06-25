/**
 * Admin-driven Tips + Banners (Phase 2 items 5 & 17).
 *
 * Tips render in the dashboard “Tips for you” section (admin + contextual).
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

export type HomeBannerCta = {
  label: string;
  url: string;
  variant?: "primary" | "secondary" | "ghost";
};

export type BannerPlacement = "hero" | "strip" | "sticky_bottom";

export type HomeBanner = {
  _id: string;
  title: string;
  body: string;
  image_url?: string | null;
  background_image_url?: string | null;
  background_color?: string | null;
  image_height?: number;
  image_fit?: "cover" | "contain";
  text_align?: "left" | "center";
  overlay_opacity?: number;
  audience: Array<"guest" | "trainer" | "trainee" | "all">;
  severity: "info" | "promo" | "maintenance" | "critical" | "success";
  placement?: BannerPlacement;
  auto_advance_sec?: number;
  cta_label?: string | null;
  cta_url?: string | null;
  ctas?: HomeBannerCta[];
  dismissible: boolean;
  is_active: boolean;
  sort_order: number;
};

function unwrap<T>(raw: unknown): T[] {
  const body = raw as Record<string, unknown> | null | undefined;
  if (!body || typeof body !== "object") return [];

  if (body.status === "FAIL" || body.status === "fail") return [];

  const data = body.data ?? body.result;
  if (Array.isArray(data)) return data as T[];

  if (data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)) {
    return (data as { items: T[] }).items;
  }

  if (Array.isArray(body)) return body as T[];
  return [];
}

export type CmsHomeBundle = {
  content_version: number;
  updated_at: string;
  banners: {
    hero: HomeBanner[];
    strip: HomeBanner[];
    sticky_bottom: HomeBanner[];
  };
  tips: Tip[];
};

function unwrapRecord<T>(raw: unknown): T | null {
  const body = raw as Record<string, unknown> | null | undefined;
  if (!body || typeof body !== "object") return null;
  if (body.status === "FAIL" || body.status === "fail") return null;
  const data = body.data ?? body.result;
  return data && typeof data === "object" ? (data as T) : null;
}

/** Aggregated home CMS — one request for hero, strip, sticky, tips. */
export async function fetchCmsHome(opts?: { guest?: boolean }): Promise<CmsHomeBundle> {
  const empty: CmsHomeBundle = {
    content_version: 0,
    updated_at: new Date().toISOString(),
    banners: { hero: [], strip: [], sticky_bottom: [] },
    tips: [],
  };
  try {
    if (opts?.guest) {
      const res = await axios.get(`${API_BASE_URL}${API_ROUTES.cms.home}`, {
        timeout: 15_000,
      });
      return unwrapRecord<CmsHomeBundle>(res.data) ?? empty;
    }
    const res = await apiClient.get(API_ROUTES.cms.home, {
      _skipAuthSignOut: true,
    });
    return unwrapRecord<CmsHomeBundle>(res.data) ?? empty;
  } catch {
    return empty;
  }
}

export async function fetchHomeTips(opts?: { guest?: boolean }): Promise<Tip[]> {
  const bundle = await fetchCmsHome(opts);
  return bundle.tips;
}

export async function fetchHomeBanners(opts?: {
  guest?: boolean;
  placement?: BannerPlacement;
}): Promise<HomeBanner[]> {
  const bundle = await fetchCmsHome(opts);
  if (opts?.placement === "hero") return bundle.banners.hero;
  if (opts?.placement === "strip") return bundle.banners.strip;
  if (opts?.placement === "sticky_bottom") return bundle.banners.sticky_bottom;
  return [
    ...bundle.banners.hero,
    ...bundle.banners.strip,
    ...bundle.banners.sticky_bottom,
  ];
}
