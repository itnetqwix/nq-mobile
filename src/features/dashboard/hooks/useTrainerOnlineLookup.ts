import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { fetchOnlineUsers } from "../../home/api/homeApi";
import { useOnlinePresence } from "../../socket/useOnlinePresence";
import { queryKeys } from "../../../lib/queryKeys";

/** Merges REST online-users list with live socket presence for trainer ids. */
export function useTrainerOnlineLookup(enabled = true) {
  const { data: onlineRaw = [] } = useQuery({
    queryKey: queryKeys.presence.bookExpertOnline,
    queryFn: fetchOnlineUsers,
    staleTime: 30_000,
    refetchInterval: enabled ? 30_000 : false,
    enabled,
  });

  const { isOnline } = useOnlinePresence();

  const apiOnlineIds = useMemo(
    () => new Set(onlineRaw.map((row: { _id?: string }) => String(row._id))),
    [onlineRaw]
  );

  const isTrainerOnline = useCallback(
    (trainerId: string | undefined | null) => {
      if (!trainerId || !enabled) return false;
      return apiOnlineIds.has(trainerId) || isOnline(trainerId);
    },
    [apiOnlineIds, isOnline, enabled]
  );

  return { isTrainerOnline, apiOnlineIds };
}
