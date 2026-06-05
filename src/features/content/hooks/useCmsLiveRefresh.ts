import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { queryKeys } from "../../../lib/queryKeys";
import { fetchCmsManifest } from "../api/cmsApi";

const POLL_MS = 60_000;

/**
 * Polls CMS manifest and invalidates home bundle + legal/blogs when
 * `content_version` changes — OTA-style updates without app store releases.
 */
export function useCmsLiveRefresh(enabled = true) {
  const queryClient = useQueryClient();
  const lastVersion = useRef<number | null>(null);

  const { data: manifest } = useQuery({
    queryKey: queryKeys.content.cmsManifest,
    queryFn: fetchCmsManifest,
    enabled,
    staleTime: 30_000,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!manifest?.content_version) return;
    const v = manifest.content_version;
    if (lastVersion.current != null && lastVersion.current !== v) {
      void queryClient.invalidateQueries({ queryKey: ["content"] });
    }
    lastVersion.current = v;
  }, [manifest?.content_version, queryClient]);
}
