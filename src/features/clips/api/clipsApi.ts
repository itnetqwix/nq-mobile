import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { dedupeNestedClipGroups } from "../../../lib/lists/clipListUtils";

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

export type LibrarySubmissionStatus =
  | "submitted"
  | "under_review"
  | "accepted"
  | "rejected";

export type LibrarySubmissionRow = {
  _id: string;
  status: LibrarySubmissionStatus;
  rejection_reason?: string | null;
  reviewed_at?: string | null;
  published_library_clip_id?: string | null;
  createdAt?: string;
  source_clip_id?:
    | string
    | {
        _id?: string;
        title?: string;
        file_name?: string;
        thumbnail?: string;
        thumbnail_url?: string;
      };
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
  return Array.isArray(data) ? dedupeNestedClipGroups(data) : [];
}

/**
 * Trainer-only: a trainee's full locker (own + shared-in clips) for live
 * lesson review. Backend gates on the trainer↔trainee session relationship.
 */
export async function postSessionTraineeClipsNested(params: {
  session_id?: string;
  trainee_id?: string;
}): Promise<NestedCategoryGroup[]> {
  const res = await apiClient.post(API_ROUTES.common.sessionTraineeClips, params);
  const data = extractData<NestedCategoryGroup[]>(res);
  return Array.isArray(data) ? dedupeNestedClipGroups(data) : [];
}

export async function postSharedClipsBySharer(): Promise<SharedClipsGroup[]> {
  const res = await apiClient.post(API_ROUTES.common.getSharedClips, {});
  const data = extractData<SharedClipsGroup[]>(res);
  return Array.isArray(data) ? data : [];
}

export async function postLibraryClipsNested(): Promise<NestedCategoryGroup[]> {
  const res = await apiClient.post(API_ROUTES.common.getLibraryClips, {});
  const data = extractData<NestedCategoryGroup[]>(res);
  return Array.isArray(data) ? dedupeNestedClipGroups(data) : [];
}

export async function createLibrarySubmission(
  payload: LibrarySubmissionPayload
): Promise<unknown> {
  const res = await apiClient.post(API_ROUTES.clips.librarySubmissions, payload);
  return extractData(res);
}

export async function fetchMyLibrarySubmissions(): Promise<LibrarySubmissionRow[]> {
  const res = await apiClient.get(API_ROUTES.clips.librarySubmissionsMine);
  const data = extractData<LibrarySubmissionRow[]>(res);
  return Array.isArray(data) ? data : [];
}

export async function reapplyAccount(): Promise<void> {
  await apiClient.post(API_ROUTES.clips.accountReapply, {});
}

export async function deleteLockerClip(clipId: string): Promise<void> {
  const res = await apiClient.delete(API_ROUTES.common.deleteClip(clipId));
  const body = res.data as { success?: number; message?: string };
  if (body?.success !== 1) {
    throw new Error(body?.message ?? "Could not remove clip.");
  }
}
