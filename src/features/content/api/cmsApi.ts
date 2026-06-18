import axios from "axios";
import { apiClient } from "../../../api/client";
import { API_BASE_URL } from "../../../config/env";
import { API_ROUTES } from "../../../config/apiRoutes";

export type CmsLegalSlug = "terms" | "privacy";

export type CmsLegalDocument = {
  slug: CmsLegalSlug;
  title: string;
  body_html: string;
  version: number;
  published_at?: string | null;
  updatedAt?: string | null;
};

export type CmsPageSummary = {
  _id: string;
  type: "blog" | "page";
  slug: string;
  title: string;
  excerpt: string;
  cover_image_url?: string | null;
  video_url?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  published_at?: string | null;
};

export type CmsPageDetail = CmsPageSummary & {
  body_html: string;
};

export type CmsManifest = {
  content_version: number;
  legal: Array<{ slug: string; version: number }>;
  faq_version?: number;
  updated_at: string;
};

export type CmsFaqItem = { id: string; q: string; a: string };
export type CmsFaqSection = { title: string; items: CmsFaqItem[] };

export type CmsFaqBundle = {
  version: number;
  sections: CmsFaqSection[];
};

function unwrap<T>(raw: unknown): T | null {
  const body = raw as Record<string, unknown> | null | undefined;
  if (!body || typeof body !== "object") return null;
  if (body.status === "FAIL" || body.status === "fail") return null;
  return (body.data ?? null) as T | null;
}

function unwrapList<T>(raw: unknown): T[] {
  const body = raw as Record<string, unknown> | null | undefined;
  if (!body || typeof body !== "object") return [];
  if (body.status === "FAIL" || body.status === "fail") return [];
  const data = body.data;
  return Array.isArray(data) ? (data as T[]) : [];
}

async function publicGet<T>(path: string, opts?: { guest?: boolean }): Promise<T | null> {
  try {
    if (opts?.guest) {
      const res = await axios.get(`${API_BASE_URL}${path}`, { timeout: 15_000 });
      return unwrap<T>(res.data);
    }
    const res = await apiClient.get(path, { _skipAuthSignOut: true });
    return unwrap<T>(res.data);
  } catch {
    return null;
  }
}

async function publicGetList<T>(path: string, opts?: { guest?: boolean }): Promise<T[]> {
  try {
    if (opts?.guest) {
      const res = await axios.get(`${API_BASE_URL}${path}`, { timeout: 15_000 });
      return unwrapList<T>(res.data);
    }
    const res = await apiClient.get(path, { _skipAuthSignOut: true });
    return unwrapList<T>(res.data);
  } catch {
    return [];
  }
}

export async function fetchCmsManifest(): Promise<CmsManifest | null> {
  return publicGet<CmsManifest>(API_ROUTES.cms.manifest);
}

export async function fetchCmsFaq(): Promise<CmsFaqBundle | null> {
  return publicGet<CmsFaqBundle>(API_ROUTES.cms.faq);
}

export async function fetchCmsLegal(
  slug: CmsLegalSlug
): Promise<CmsLegalDocument | null> {
  return publicGet<CmsLegalDocument>(API_ROUTES.cms.legal(slug));
}

export async function fetchCmsBlogs(opts?: {
  guest?: boolean;
}): Promise<CmsPageSummary[]> {
  return publicGetList<CmsPageSummary>(`${API_ROUTES.cms.pages}?type=blog`, opts);
}

export async function fetchCmsBlogPost(
  slug: string,
  opts?: { guest?: boolean }
): Promise<CmsPageDetail | null> {
  return publicGet<CmsPageDetail>(
    `${API_ROUTES.cms.page(slug)}?type=blog`,
    opts
  );
}

export async function fetchCmsStaticPage(
  slug: string,
  opts?: { guest?: boolean }
): Promise<CmsPageDetail | null> {
  return publicGet<CmsPageDetail>(
    `${API_ROUTES.cms.page(slug)}?type=page`,
    opts
  );
}
