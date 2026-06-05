/**
 * Single home CMS fetch — GET /cms/home (hero, strip, sticky, tips).
 * React Query dedupes by guest/auth key across all home surfaces.
 */

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import {
  fetchCmsHome,
  type CmsHomeBundle,
  type HomeBanner,
  type Tip,
} from "../api/contentApi";

type CmsHomeQueryOpts = {
  enabled?: boolean;
  refetchOnMount?: boolean | "always";
};

export function useCmsHome(guest = false, opts?: CmsHomeQueryOpts) {
  return useQuery({
    queryKey: queryKeys.content.home(guest),
    queryFn: () => fetchCmsHome({ guest }),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 2,
    enabled: opts?.enabled ?? true,
    refetchOnMount: opts?.refetchOnMount,
  });
}

export function useCmsHomeHero(guest = false, opts?: CmsHomeQueryOpts) {
  const q = useCmsHome(guest, opts);
  return {
    ...q,
    data: q.data?.banners.hero ?? [],
    contentVersion: q.data?.content_version,
  };
}

export function useCmsHomeStrip(guest = false, opts?: CmsHomeQueryOpts) {
  const q = useCmsHome(guest, opts);
  return {
    ...q,
    data: q.data?.banners.strip ?? [],
    contentVersion: q.data?.content_version,
  };
}

export function useCmsHomeSticky(guest = false, opts?: CmsHomeQueryOpts) {
  const q = useCmsHome(guest, opts);
  return {
    ...q,
    data: q.data?.banners.sticky_bottom ?? [],
    contentVersion: q.data?.content_version,
  };
}

export function useCmsHomeTips(guest = false, opts?: CmsHomeQueryOpts) {
  const q = useCmsHome(guest, opts);
  return {
    ...q,
    data: q.data?.tips ?? [],
    contentVersion: q.data?.content_version,
  };
}

export type { CmsHomeBundle, HomeBanner, Tip };
