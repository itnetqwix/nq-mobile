import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";

export type ClipTaxonomySubcategory = {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
};

export type ClipTaxonomyCategory = {
  id: string;
  name: string;
  slug: string;
  subcategories: ClipTaxonomySubcategory[];
};

export type ClipTaxonomy = {
  categories: ClipTaxonomyCategory[];
};

export type LockerClip = Record<string, unknown> & {
  _id?: string;
  title?: string;
  librarySubmission?: {
    id: string;
    status: string;
    rejection_reason?: string | null;
    published_library_clip_id?: string | null;
  } | null;
};

export type NestedSubcategoryGroup = {
  subcategoryId: string | null;
  subcategoryName: string;
  clips: LockerClip[];
};

export type NestedCategoryGroup = {
  categoryId: string | null;
  categoryName: string;
  subcategories: NestedSubcategoryGroup[];
};

export type SharedClipsGroup = {
  sharerId: string | null;
  sharerName: string;
  sharer?: Record<string, unknown>;
  clips: LockerClip[];
};

export type LibrarySubmissionPayload = {
  source_clip_id: string;
  proposed_category_id: string;
  proposed_subcategory_id: string;
};

function extractData<T>(res: { data?: unknown }): T {
  const body = res.data as Record<string, unknown>;
  return (body?.data ?? body) as T;
}

export async function fetchClipTaxonomy(): Promise<ClipTaxonomy> {
  const res = await apiClient.get(API_ROUTES.clips.taxonomy);
  return extractData<ClipTaxonomy>(res);
}

export async function postMyClipsNested(params?: {
  trainee_id?: string;
}): Promise<NestedCategoryGroup[]> {
  const res = await apiClient.post(API_ROUTES.common.getClips, params ?? {});
  const data = extractData<NestedCategoryGroup[]>(res);
  return Array.isArray(data) ? data : [];
}

export async function postSharedClipsBySharer(): Promise<SharedClipsGroup[]> {
  const res = await apiClient.post(API_ROUTES.common.getSharedClips, {});
  const data = extractData<SharedClipsGroup[]>(res);
  return Array.isArray(data) ? data : [];
}

export async function postLibraryClipsNested(): Promise<NestedCategoryGroup[]> {
  const res = await apiClient.post(API_ROUTES.common.getLibraryClips, {});
  const data = extractData<NestedCategoryGroup[]>(res);
  return Array.isArray(data) ? data : [];
}

export async function createLibrarySubmission(
  payload: LibrarySubmissionPayload
): Promise<unknown> {
  const res = await apiClient.post(API_ROUTES.clips.librarySubmissions, payload);
  return extractData(res);
}

export async function reapplyAccount(): Promise<void> {
  await apiClient.post(API_ROUTES.clips.accountReapply, {});
}
