import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { LEGAL_RECONSENT_SLUGS, type CmsLegalSlug } from "./cmsApi";

export type LegalAcceptanceStatus = {
  required: Array<{ slug: string; version: number }>;
  accepted: Array<{ slug: string; version: number; accepted_at: string | null }>;
  pending_slugs: string[];
  needs_reconsent: boolean;
};

function unwrap<T>(raw: unknown): T | null {
  const body = raw as Record<string, unknown> | null | undefined;
  if (!body || typeof body !== "object") return null;
  if (body.status === "FAIL" || body.status === "fail") return null;
  return (body.data ?? null) as T | null;
}

export async function fetchLegalAcceptanceStatus(): Promise<LegalAcceptanceStatus | null> {
  try {
    const res = await apiClient.get(API_ROUTES.user.legalStatus);
    return unwrap<LegalAcceptanceStatus>(res.data);
  } catch {
    return null;
  }
}

export async function acceptLegalDocuments(): Promise<LegalAcceptanceStatus | null> {
  const res = await apiClient.post(API_ROUTES.user.legalAccept, { accept_all: true });
  return unwrap<LegalAcceptanceStatus>(res.data);
}

export function readUserLegalVersion(
  user: Record<string, unknown> | null | undefined,
  slug: CmsLegalSlug
): number {
  const acceptances = user?.legal_acceptances as
    | Record<string, { version?: number }>
    | undefined;
  const v = acceptances?.[slug]?.version;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function pendingLegalSlugsFromManifest(
  user: Record<string, unknown> | null | undefined,
  manifestLegal: Array<{ slug: string; version: number }> | undefined
): CmsLegalSlug[] {
  const pending: CmsLegalSlug[] = [];
  for (const slug of LEGAL_RECONSENT_SLUGS) {
    const required = manifestLegal?.find((l) => l.slug === slug)?.version ?? 0;
    const accepted = readUserLegalVersion(user, slug);
    if (required > 0 && accepted < required) pending.push(slug);
  }
  return pending;
}
